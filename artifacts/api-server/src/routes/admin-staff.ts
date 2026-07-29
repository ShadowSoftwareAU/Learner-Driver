/**
 * Admin staff management routes.
 *
 * Permission model:
 *   Master tier  = admin users with adminSubRole: "owner" | "manager"
 *                  → full access to everything, can manage staff
 *   Staff        = admin users with no subRole or "coordinator"
 *                  → access gated by adminStaffPermissionsTable flags
 */
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import {
  db,
  usersTable,
  adminStaffPermissionsTable,
  adminStaffInvitesTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { sendExternalEmail } from "../lib/notifications/emailChannel";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMasterTier(user: any): boolean {
  return (
    user.role === "admin" &&
    ["owner", "manager"].includes(user.adminSubRole ?? "")
  );
}

// ─── GET /admin/permissions/me ────────────────────────────────────────────────

router.get(
  "/admin/permissions/me",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    if (isMasterTier(user)) {
      res.json({
        isMasterTier: true,
        canViewBilling: true,
        canManageInstructors: true,
        canManageCompliance: true,
        canViewAuditLog: true,
        canManageBookings: true,
      });
      return;
    }

    const [perms] = await db
      .select()
      .from(adminStaffPermissionsTable)
      .where(eq(adminStaffPermissionsTable.userId, user.id));

    res.json({
      isMasterTier: false,
      canViewBilling: perms?.canViewBilling ?? false,
      canManageInstructors: perms?.canManageInstructors ?? false,
      canManageCompliance: perms?.canManageCompliance ?? false,
      canViewAuditLog: perms?.canViewAuditLog ?? false,
      canManageBookings: perms?.canManageBookings ?? false,
    });
  }
);

// ─── GET /admin/staff ─────────────────────────────────────────────────────────

router.get(
  "/admin/staff",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (!isMasterTier(user)) {
      res.status(403).json({ error: "Owner or Manager access required" });
      return;
    }

    const staffRows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        adminSubRole: usersTable.adminSubRole,
        createdAt: usersTable.createdAt,
        canViewBilling: adminStaffPermissionsTable.canViewBilling,
        canManageInstructors: adminStaffPermissionsTable.canManageInstructors,
        canManageCompliance: adminStaffPermissionsTable.canManageCompliance,
        canViewAuditLog: adminStaffPermissionsTable.canViewAuditLog,
        canManageBookings: adminStaffPermissionsTable.canManageBookings,
      })
      .from(usersTable)
      .leftJoin(
        adminStaffPermissionsTable,
        eq(adminStaffPermissionsTable.userId, usersTable.id)
      )
      .where(eq(usersTable.role, "admin"))
      .orderBy(usersTable.createdAt);

    const staff = staffRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      adminSubRole: row.adminSubRole,
      createdAt: row.createdAt,
      permissions: {
        isMasterTier: ["owner", "manager"].includes(row.adminSubRole ?? ""),
        canViewBilling: row.canViewBilling ?? false,
        canManageInstructors: row.canManageInstructors ?? false,
        canManageCompliance: row.canManageCompliance ?? false,
        canViewAuditLog: row.canViewAuditLog ?? false,
        canManageBookings: row.canManageBookings ?? false,
      },
    }));

    const pendingInvites = await db
      .select()
      .from(adminStaffInvitesTable)
      .where(eq(adminStaffInvitesTable.status, "pending"))
      .orderBy(desc(adminStaffInvitesTable.createdAt));

    res.json({ staff, pendingInvites });
  }
);

// ─── POST /admin/staff/invite ─────────────────────────────────────────────────

router.post(
  "/admin/staff/invite",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (!isMasterTier(user)) {
      res.status(403).json({ error: "Owner or Manager access required" });
      return;
    }

    const {
      email,
      canViewBilling = false,
      canManageInstructors = false,
      canManageCompliance = false,
      canViewAuditLog = false,
      canManageBookings = false,
      joinBaseUrl,
    } = req.body as {
      email: string;
      canViewBilling?: boolean;
      canManageInstructors?: boolean;
      canManageCompliance?: boolean;
      canViewAuditLog?: boolean;
      canManageBookings?: boolean;
      joinBaseUrl?: string;
    };

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(adminStaffInvitesTable)
      .values({
        invitedByUserId: user.id,
        inviteeEmail: email.toLowerCase().trim(),
        token,
        status: "pending",
        canViewBilling,
        canManageInstructors,
        canManageCompliance,
        canViewAuditLog,
        canManageBookings,
        expiresAt,
      })
      .returning();

    const inviteUrl = joinBaseUrl ? `${joinBaseUrl}/admin-join/${token}` : null;
    const inviterName = user.name ?? user.email;

    let emailDelivered = false;
    if (inviteUrl) {
      const permLabels = [
        canViewBilling && "View Billing & Finance",
        canManageInstructors && "Manage Instructors & Students",
        canManageCompliance && "Manage Compliance",
        canViewAuditLog && "View Audit Log",
        canManageBookings && "Manage Bookings",
      ].filter(Boolean) as string[];

      const permissionsHtml =
        permLabels.length > 0
          ? `<ul style="margin:8px 0;padding-left:20px;color:#374151;">${permLabels.map((p) => `<li style="margin-bottom:4px;">${p}</li>`).join("")}</ul>`
          : `<p style="color:#6b7280;font-style:italic;">Read-only dashboard access</p>`;

      const html = `
<div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <div style="margin-bottom:24px;">
    <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;">You've been invited to Learner Log</h2>
    <p style="color:#374151;margin:0;font-size:15px;"><strong>${inviterName}</strong> has invited you to join as a staff administrator.</p>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="color:#374151;font-weight:600;margin:0 0 8px;font-size:14px;">Your access permissions:</p>
    ${permissionsHtml}
  </div>
  <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;">Accept Invitation →</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:20px;">This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
</div>`;

      try {
        const result = await sendExternalEmail({
          to: email,
          subject: "You've been invited to Learner Log",
          html,
        });
        emailDelivered = result.delivered;
      } catch {
        // non-fatal
      }
    }

    res.status(201).json({
      invite,
      emailDelivered,
      inviteUrl: inviteUrl ?? `token: ${token}`,
    });
  }
);

// ─── GET /admin/staff/invite/:token (public) ──────────────────────────────────

router.get(
  "/admin/staff/invite/:token",
  async (req: any, res): Promise<void> => {
    const { token } = req.params as { token: string };

    const rows = await db
      .select({
        invite: adminStaffInvitesTable,
        inviterName: usersTable.name,
        inviterEmail: usersTable.email,
      })
      .from(adminStaffInvitesTable)
      .leftJoin(
        usersTable,
        eq(usersTable.id, adminStaffInvitesTable.invitedByUserId)
      )
      .where(eq(adminStaffInvitesTable.token, token));

    if (!rows.length) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    const { invite, inviterName, inviterEmail } = rows[0];
    const expired =
      invite.status !== "pending" || new Date() > new Date(invite.expiresAt);

    res.json({
      valid: !expired && invite.status === "pending",
      status: invite.status,
      expired,
      invitedByName: inviterName ?? inviterEmail ?? "Learner Log Admin",
      inviteeEmail: invite.inviteeEmail,
      expiresAt: invite.expiresAt,
      permissions: {
        canViewBilling: invite.canViewBilling,
        canManageInstructors: invite.canManageInstructors,
        canManageCompliance: invite.canManageCompliance,
        canViewAuditLog: invite.canViewAuditLog,
        canManageBookings: invite.canManageBookings,
      },
    });
  }
);

// ─── POST /admin/staff/invite/:token/claim ────────────────────────────────────

router.post(
  "/admin/staff/invite/:token/claim",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const { token } = req.params as { token: string };
    const auth = getAuth(req);
    const user = await getOrCreateUser(
      req.clerkUserId,
      (auth?.sessionClaims?.email as string) ?? ""
    );

    const [invite] = await db
      .select()
      .from(adminStaffInvitesTable)
      .where(eq(adminStaffInvitesTable.token, token));

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    if (invite.status !== "pending") {
      res.status(409).json({ error: "Invite already used or cancelled" });
      return;
    }
    if (new Date() > new Date(invite.expiresAt)) {
      await db
        .update(adminStaffInvitesTable)
        .set({ status: "expired" })
        .where(eq(adminStaffInvitesTable.id, invite.id));
      res.status(410).json({ error: "Invite has expired" });
      return;
    }

    // Promote user to admin
    await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, user.id));

    // Upsert permissions record
    const [existing] = await db
      .select()
      .from(adminStaffPermissionsTable)
      .where(eq(adminStaffPermissionsTable.userId, user.id));

    const permValues = {
      canViewBilling: invite.canViewBilling,
      canManageInstructors: invite.canManageInstructors,
      canManageCompliance: invite.canManageCompliance,
      canViewAuditLog: invite.canViewAuditLog,
      canManageBookings: invite.canManageBookings,
    };

    if (existing) {
      await db
        .update(adminStaffPermissionsTable)
        .set(permValues)
        .where(eq(adminStaffPermissionsTable.userId, user.id));
    } else {
      await db
        .insert(adminStaffPermissionsTable)
        .values({ userId: user.id, ...permValues });
    }

    // Mark invite accepted
    await db
      .update(adminStaffInvitesTable)
      .set({ status: "accepted", usedAt: new Date() })
      .where(eq(adminStaffInvitesTable.id, invite.id));

    res.json({ success: true });
  }
);

// ─── PATCH /admin/staff/:id/permissions ──────────────────────────────────────

router.patch(
  "/admin/staff/:id/permissions",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (!isMasterTier(user)) {
      res.status(403).json({ error: "Owner or Manager access required" });
      return;
    }

    const targetId = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10
    );
    const [target] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, targetId), eq(usersTable.role, "admin")));

    if (!target) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }
    if (["owner", "manager"].includes(target.adminSubRole ?? "")) {
      res.status(400).json({ error: "Cannot modify Owner or Manager permissions" });
      return;
    }

    const {
      canViewBilling,
      canManageInstructors,
      canManageCompliance,
      canViewAuditLog,
      canManageBookings,
    } = req.body as Partial<{
      canViewBilling: boolean;
      canManageInstructors: boolean;
      canManageCompliance: boolean;
      canViewAuditLog: boolean;
      canManageBookings: boolean;
    }>;

    const updates: Record<string, boolean> = {};
    if (canViewBilling !== undefined) updates.canViewBilling = canViewBilling;
    if (canManageInstructors !== undefined) updates.canManageInstructors = canManageInstructors;
    if (canManageCompliance !== undefined) updates.canManageCompliance = canManageCompliance;
    if (canViewAuditLog !== undefined) updates.canViewAuditLog = canViewAuditLog;
    if (canManageBookings !== undefined) updates.canManageBookings = canManageBookings;

    const [existing] = await db
      .select()
      .from(adminStaffPermissionsTable)
      .where(eq(adminStaffPermissionsTable.userId, targetId));

    if (existing) {
      await db
        .update(adminStaffPermissionsTable)
        .set(updates)
        .where(eq(adminStaffPermissionsTable.userId, targetId));
    } else {
      await db
        .insert(adminStaffPermissionsTable)
        .values({ userId: targetId, ...updates });
    }

    res.json({ success: true });
  }
);

// ─── DELETE /admin/staff/:id ──────────────────────────────────────────────────

router.delete(
  "/admin/staff/:id",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (!isMasterTier(user)) {
      res.status(403).json({ error: "Owner or Manager access required" });
      return;
    }

    const targetId = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10
    );
    const [target] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, targetId), eq(usersTable.role, "admin")));

    if (!target) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }
    if (["owner", "manager"].includes(target.adminSubRole ?? "")) {
      res.status(400).json({ error: "Cannot remove Owner or Manager" });
      return;
    }

    await db
      .update(usersTable)
      .set({ role: "unassigned" })
      .where(eq(usersTable.id, targetId));
    await db
      .delete(adminStaffPermissionsTable)
      .where(eq(adminStaffPermissionsTable.userId, targetId));

    res.json({ success: true });
  }
);

// ─── DELETE /admin/staff/invite/:id ──────────────────────────────────────────

router.delete(
  "/admin/staff/invite/:id",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const user = await getOrCreateUser(req.clerkUserId, "");
    if (!isMasterTier(user)) {
      res.status(403).json({ error: "Owner or Manager access required" });
      return;
    }

    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10
    );
    const [invite] = await db
      .select()
      .from(adminStaffInvitesTable)
      .where(eq(adminStaffInvitesTable.id, id));

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    await db
      .update(adminStaffInvitesTable)
      .set({ status: "cancelled" })
      .where(eq(adminStaffInvitesTable.id, id));

    res.json({ success: true });
  }
);

export default router;
