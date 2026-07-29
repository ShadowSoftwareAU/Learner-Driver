/**
 * Instructor-link management for the hybrid school/independent model.
 *
 * Two workflows:
 *  1. Link by code  — school admin enters an instructor's 6-char uniqueLinkCode
 *                     → creates an active schoolInstructorLinksTable record immediately.
 *  2. Invite by email — school admin sends an invite; instructor clicks the link,
 *                     creates a Learner Log account if needed, then claims the token
 *                     → creates an active schoolInstructorLinksTable record.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  instructorsTable,
  schoolInstructorLinksTable,
  instructorInviteTokensTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { sendExternalEmail } from "../lib/notifications/emailChannel";
import { isSchoolAdmin } from "../lib/config";
import crypto from "crypto";

const router = Router();

// ── Guard helper ──────────────────────────────────────────────────────────────

async function requireSchoolAdmin(req: any, res: any): Promise<{ user: any } | null> {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSchoolAdmin(user.role)) {
    res.status(403).json({ error: "school_admin required" });
    return null;
  }
  return { user };
}

// ── GET /instructor-links ─────────────────────────────────────────────────────
// List all active/pending links + pending invites for the current school admin.

router.get("/instructor-links", requireAuth, async (req: any, res): Promise<void> => {
  const ctx = await requireSchoolAdmin(req, res);
  if (!ctx) return;
  const { user } = ctx;

  // Fetch links
  const links = await db.select().from(schoolInstructorLinksTable)
    .where(eq(schoolInstructorLinksTable.schoolAdminId, user.id));

  // Enrich with instructor details
  const enrichedLinks = await Promise.all(
    links.map(async (link) => {
      const [instructor] = await db.select({
        id: instructorsTable.id,
        fullName: instructorsTable.fullName,
        email: instructorsTable.email,
        uniqueLinkCode: instructorsTable.uniqueLinkCode,
      }).from(instructorsTable).where(eq(instructorsTable.id, link.instructorId));
      return {
        id: link.id,
        instructorId: link.instructorId,
        instructorName: instructor?.fullName ?? "Unknown",
        instructorEmail: instructor?.email ?? "",
        instructorLinkCode: instructor?.uniqueLinkCode ?? null,
        status: link.status,
        invitedAt: link.invitedAt,
        activatedAt: link.activatedAt ?? null,
        revokedAt: link.revokedAt ?? null,
      };
    }),
  );

  // Fetch pending invites (those not yet claimed or cancelled)
  const pendingInvites = await db.select({
    id: instructorInviteTokensTable.id,
    inviteeEmail: instructorInviteTokensTable.inviteeEmail,
    status: instructorInviteTokensTable.status,
    expiresAt: instructorInviteTokensTable.expiresAt,
    createdAt: instructorInviteTokensTable.createdAt,
  }).from(instructorInviteTokensTable)
    .where(and(
      eq(instructorInviteTokensTable.schoolAdminId, user.id),
      eq(instructorInviteTokensTable.status, "pending"),
    ));

  res.json({ links: enrichedLinks, pendingInvites });
});

// ── POST /instructor-links/link-by-code ───────────────────────────────────────
// Immediately creates an active link by an instructor's 6-char uniqueLinkCode.

router.post("/instructor-links/link-by-code", requireAuth, async (req: any, res): Promise<void> => {
  const ctx = await requireSchoolAdmin(req, res);
  if (!ctx) return;
  const { user } = ctx;

  const { linkCode } = req.body as { linkCode?: string };
  if (!linkCode?.trim()) {
    res.status(400).json({ error: "linkCode is required" }); return;
  }
  const code = linkCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    res.status(400).json({ error: "Link code must be 6 alphanumeric characters" }); return;
  }

  // Find instructor by code
  const [instructor] = await db.select().from(instructorsTable)
    .where(eq(instructorsTable.uniqueLinkCode, code));
  if (!instructor) {
    res.status(404).json({ error: "No instructor found with that link code" }); return;
  }

  // Prevent self-linking (if the school admin also has an instructor profile)
  if (instructor.userId === user.id) {
    res.status(400).json({ error: "You cannot link to your own instructor profile" }); return;
  }

  // Upsert: if a record already exists (any status), reactivate it
  const [existing] = await db.select().from(schoolInstructorLinksTable)
    .where(and(
      eq(schoolInstructorLinksTable.schoolAdminId, user.id),
      eq(schoolInstructorLinksTable.instructorId, instructor.id),
    ));

  if (existing) {
    if (existing.status === "active") {
      res.status(409).json({ error: "This instructor is already linked to your account" }); return;
    }
    const [updated] = await db.update(schoolInstructorLinksTable)
      .set({ status: "active", activatedAt: new Date(), revokedAt: null })
      .where(eq(schoolInstructorLinksTable.id, existing.id))
      .returning();
    res.json({
      link: updated,
      instructorName: instructor.fullName,
      instructorEmail: instructor.email,
    });
    return;
  }

  const [link] = await db.insert(schoolInstructorLinksTable).values({
    schoolAdminId: user.id,
    instructorId: instructor.id,
    status: "active",
    activatedAt: new Date(),
  }).returning();

  res.status(201).json({
    link,
    instructorName: instructor.fullName,
    instructorEmail: instructor.email,
  });
});

// ── POST /instructor-links/invite ─────────────────────────────────────────────
// Sends an invite email and records a pending token.

router.post("/instructor-links/invite", requireAuth, async (req: any, res): Promise<void> => {
  const ctx = await requireSchoolAdmin(req, res);
  if (!ctx) return;
  const { user } = ctx;

  const { email, joinBaseUrl } = req.body as { email?: string; joinBaseUrl?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "email is required" }); return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    res.status(400).json({ error: "Invalid email address" }); return;
  }

  const inviteeEmail = email.trim().toLowerCase();

  // Generate a URL-safe token (UUID v4)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invite] = await db.insert(instructorInviteTokensTable).values({
    token,
    schoolAdminId: user.id,
    inviteeEmail,
    status: "pending",
    expiresAt,
  }).returning();

  // Construct the invite link
  const baseUrl = joinBaseUrl?.replace(/\/$/, "") ?? "";
  const inviteUrl = `${baseUrl}/join/${token}`;
  const adminName = user.name ?? user.email;

  const { delivered } = await sendExternalEmail(
    inviteeEmail,
    "You've been invited to join Learner Log as an instructor",
    buildInviteEmailHtml(adminName, inviteUrl),
    buildInviteEmailText(adminName, inviteUrl),
  );

  res.status(201).json({
    invite: {
      id: invite.id,
      inviteeEmail: invite.inviteeEmail,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    },
    emailDelivered: delivered,
    inviteUrl,
  });
});

// ── GET /instructor-links/invite/:token ───────────────────────────────────────
// Public preview — no auth required. Returns invite details for the join page.

router.get("/instructor-links/invite/:token", async (req: any, res): Promise<void> => {
  const { token } = req.params as { token: string };

  const [invite] = await db.select().from(instructorInviteTokensTable)
    .where(eq(instructorInviteTokensTable.token, token));

  if (!invite) {
    res.status(404).json({ error: "Invite not found or already used" }); return;
  }

  const isExpired = new Date() > invite.expiresAt;
  const isValid = invite.status === "pending" && !isExpired;

  // Get the inviting admin's name
  const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, invite.schoolAdminId));

  res.json({
    valid: isValid,
    status: invite.status,
    expired: isExpired,
    invitedBy: adminUser?.name ?? adminUser?.email ?? "A school admin",
    inviteeEmail: invite.inviteeEmail,
    expiresAt: invite.expiresAt,
  });
});

// ── POST /instructor-links/invite/:token/claim ────────────────────────────────
// Auth required. Authenticated user claims the invite and is linked to the school admin.

router.post("/instructor-links/invite/:token/claim", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { token } = req.params as { token: string };

  const [invite] = await db.select().from(instructorInviteTokensTable)
    .where(eq(instructorInviteTokensTable.token, token));

  if (!invite) {
    res.status(404).json({ error: "Invite not found" }); return;
  }
  if (invite.status !== "pending") {
    res.status(409).json({ error: `Invite has already been ${invite.status}` }); return;
  }
  if (new Date() > invite.expiresAt) {
    await db.update(instructorInviteTokensTable)
      .set({ status: "expired" })
      .where(eq(instructorInviteTokensTable.id, invite.id));
    res.status(410).json({ error: "This invite link has expired" }); return;
  }

  // Get or create the instructor profile for this user
  let [instructor] = await db.select().from(instructorsTable)
    .where(eq(instructorsTable.userId, user.id));

  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({
      userId: user.id,
      fullName: user.name ?? "Instructor",
      email: user.email ?? invite.inviteeEmail,
      isIndependent: true,
    }).returning();
  }

  // Check for an existing link (prevent duplicates)
  const [existingLink] = await db.select().from(schoolInstructorLinksTable)
    .where(and(
      eq(schoolInstructorLinksTable.schoolAdminId, invite.schoolAdminId),
      eq(schoolInstructorLinksTable.instructorId, instructor.id),
    ));

  if (existingLink?.status === "active") {
    // Already linked — mark invite as accepted anyway and return success
    await db.update(instructorInviteTokensTable)
      .set({ status: "accepted", usedAt: new Date(), claimedByInstructorId: instructor.id })
      .where(eq(instructorInviteTokensTable.id, invite.id));
    res.json({ ok: true, alreadyLinked: true });
    return;
  }

  // Create or reactivate the link
  if (existingLink) {
    await db.update(schoolInstructorLinksTable)
      .set({ status: "active", activatedAt: new Date(), revokedAt: null })
      .where(eq(schoolInstructorLinksTable.id, existingLink.id));
  } else {
    await db.insert(schoolInstructorLinksTable).values({
      schoolAdminId: invite.schoolAdminId,
      instructorId: instructor.id,
      status: "active",
      activatedAt: new Date(),
    });
  }

  // Consume the token
  await db.update(instructorInviteTokensTable)
    .set({ status: "accepted", usedAt: new Date(), claimedByInstructorId: instructor.id })
    .where(eq(instructorInviteTokensTable.id, invite.id));

  // Get the admin's name for the response
  const [adminUser] = await db.select({ name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, invite.schoolAdminId));

  res.json({ ok: true, linkedToAdmin: adminUser?.name ?? "School Admin" });
});

// ── DELETE /instructor-links/:id ──────────────────────────────────────────────
// Revoke an active or pending link.

router.delete("/instructor-links/:id", requireAuth, async (req: any, res): Promise<void> => {
  const ctx = await requireSchoolAdmin(req, res);
  if (!ctx) return;
  const { user } = ctx;
  const id = parseInt(req.params.id as string, 10);

  const [link] = await db.select().from(schoolInstructorLinksTable)
    .where(and(
      eq(schoolInstructorLinksTable.id, id),
      eq(schoolInstructorLinksTable.schoolAdminId, user.id),
    ));

  if (!link) { res.status(404).json({ error: "Link not found" }); return; }

  await db.update(schoolInstructorLinksTable)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(schoolInstructorLinksTable.id, id));

  res.json({ ok: true });
});

// ── DELETE /instructor-links/invite/:id ───────────────────────────────────────
// Cancel a pending invite (before it is claimed).

router.delete("/instructor-links/invite/:id", requireAuth, async (req: any, res): Promise<void> => {
  const ctx = await requireSchoolAdmin(req, res);
  if (!ctx) return;
  const { user } = ctx;
  const id = parseInt(req.params.id as string, 10);

  const [invite] = await db.select().from(instructorInviteTokensTable)
    .where(and(
      eq(instructorInviteTokensTable.id, id),
      eq(instructorInviteTokensTable.schoolAdminId, user.id),
    ));

  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status !== "pending") {
    res.status(409).json({ error: `Invite is already ${invite.status}` }); return;
  }

  await db.update(instructorInviteTokensTable)
    .set({ status: "cancelled" })
    .where(eq(instructorInviteTokensTable.id, id));

  res.json({ ok: true });
});

// ── Email templates ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildInviteEmailHtml(adminName: string, inviteUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You've been invited to Learner Log</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .header { background: #1e40af; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; }
    .body { padding: 28px 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .cta { display: inline-block; background: #1e40af; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 20px; }
    .note { font-size: 13px; color: #6b7280; }
    .footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Learner Log</h1></div>
    <div class="body">
      <p><strong>${escapeHtml(adminName)}</strong> has invited you to join Learner Log as an instructor.</p>
      <p>Learner Log is an instructor management platform that helps you track student progress, log sessions, and manage your teaching schedule.</p>
      <a href="${escapeHtml(inviteUrl)}" class="cta">Accept Invitation</a>
      <p class="note">This link expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
      <p class="note">If the button above doesn't work, copy and paste this URL into your browser:<br>${escapeHtml(inviteUrl)}</p>
    </div>
    <div class="footer">Learner Log &mdash; Instructor Management Platform</div>
  </div>
</body>
</html>`;
}

function buildInviteEmailText(adminName: string, inviteUrl: string): string {
  return `${adminName} has invited you to join Learner Log as an instructor.

Accept your invitation here:
${inviteUrl}

This link expires in 7 days. If you did not expect this invitation, you can safely ignore this email.

---
Learner Log — Instructor Management Platform`;
}

export default router;
