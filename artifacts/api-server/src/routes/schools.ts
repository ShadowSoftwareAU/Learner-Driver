/**
 * Driving school / tenant management routes.
 * Roles: super_admin can manage any school; school_admin is scoped to their school.
 * SCIM is deferred — all provisioning is manual.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  drivingSchoolsTable,
  schoolInstructorsTable,
  instructorsTable,
  usersTable,
  auditLogsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { requireRole, requireSchoolScope } from "../lib/authz";
import { isSchoolAdmin, isSuperAdmin } from "../lib/config";

const router = Router();

// ─── Create school (super_admin only) ────────────────────────────────────────

router.post("/schools", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireRole({ user, res }, "super_admin")) return;

  const { name, abn, billingContactEmail, billingContactName, billingContactPhone, seatLimit } = req.body as {
    name: string;
    abn?: string;
    billingContactEmail?: string;
    billingContactName?: string;
    billingContactPhone?: string;
    seatLimit?: number;
  };

  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const [school] = await db.insert(drivingSchoolsTable).values({
    name: name.trim(),
    abn: abn ?? null,
    billingContactEmail: billingContactEmail ?? null,
    billingContactName: billingContactName ?? null,
    billingContactPhone: billingContactPhone ?? null,
    contractOwnerUserId: user.id,
    seatLimit: seatLimit ?? 5,
    status: "active",
  }).returning();

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "school_created",
    resourceType: "school",
    resourceId: school.id,
    actorRole: user.role,
    result: "success",
    route: "/schools",
  }).catch(() => null);

  res.status(201).json(school);
});

// ─── Get my school (school_admin) ────────────────────────────────────────────

router.get("/schools/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin or super_admin required" });
    return;
  }

  if (!user.schoolId) {
    res.status(404).json({ error: "No school associated with your account" });
    return;
  }

  const [school] = await db.select().from(drivingSchoolsTable).where(eq(drivingSchoolsTable.id, user.schoolId));
  if (!school) { res.status(404).json({ error: "School not found" }); return; }

  const instructors = await db
    .select({ id: schoolInstructorsTable.id, instructorId: schoolInstructorsTable.instructorId, roleWithinSchool: schoolInstructorsTable.roleWithinSchool, status: schoolInstructorsTable.status, isPrimary: schoolInstructorsTable.isPrimary })
    .from(schoolInstructorsTable)
    .where(and(eq(schoolInstructorsTable.schoolId, school.id), eq(schoolInstructorsTable.status, "active")));

  res.json({ ...school, instructorCount: instructors.length, instructors });
});

// ─── Get school by id ─────────────────────────────────────────────────────────

router.get("/schools/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const schoolId = parseInt(req.params.id as string, 10);
  if (!requireSchoolScope({ user, res }, schoolId)) return;

  const [school] = await db.select().from(drivingSchoolsTable).where(eq(drivingSchoolsTable.id, schoolId));
  if (!school) { res.status(404).json({ error: "School not found" }); return; }

  res.json(school);
});

// ─── Update school settings ───────────────────────────────────────────────────

router.patch("/schools/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const schoolId = parseInt(req.params.id as string, 10);
  if (!requireSchoolScope({ user, res }, schoolId)) return;
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin or super_admin required" }); return;
  }

  const { name, abn, logoPath, primaryColor, secondaryColor, billingContactEmail, billingContactName, billingContactPhone, seatLimit, operatingStates, rspRegistrationNumber } = req.body as Partial<{
    name: string; abn: string; logoPath: string; primaryColor: string; secondaryColor: string;
    billingContactEmail: string; billingContactName: string; billingContactPhone: string; seatLimit: number;
    operatingStates: string[]; rspRegistrationNumber: string;
  }>;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (abn !== undefined) updates.abn = abn;
  if (logoPath !== undefined) updates.logoPath = logoPath;
  if (primaryColor !== undefined) updates.primaryColor = primaryColor;
  if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor;
  if (billingContactEmail !== undefined) updates.billingContactEmail = billingContactEmail;
  if (billingContactName !== undefined) updates.billingContactName = billingContactName;
  if (billingContactPhone !== undefined) updates.billingContactPhone = billingContactPhone;
  if (seatLimit !== undefined && isSuperAdmin(user.role)) updates.seatLimit = seatLimit;
  if (operatingStates !== undefined && (isSchoolAdmin(user.role) || isSuperAdmin(user.role))) updates.operatingStates = operatingStates;
  if (rspRegistrationNumber !== undefined && (isSchoolAdmin(user.role) || isSuperAdmin(user.role))) updates.rspRegistrationNumber = rspRegistrationNumber;

  const [updated] = await db.update(drivingSchoolsTable).set(updates as any).where(eq(drivingSchoolsTable.id, schoolId)).returning();

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "school_updated",
    resourceType: "school",
    resourceId: schoolId,
    actorRole: user.role,
    result: "success",
    route: `/schools/${schoolId}`,
    metadataJson: { fields: Object.keys(updates) } as any,
  }).catch(() => null);

  res.json(updated);
});

// ─── Add instructor to school ─────────────────────────────────────────────────

router.post("/schools/:id/instructors", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const schoolId = parseInt(req.params.id as string, 10);
  if (!requireSchoolScope({ user, res }, schoolId)) return;
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin or super_admin required" }); return;
  }

  const { instructorId, roleWithinSchool, isPrimary } = req.body as {
    instructorId: number;
    roleWithinSchool?: string;
    isPrimary?: boolean;
  };

  if (!instructorId) { res.status(400).json({ error: "instructorId required" }); return; }

  const [existing] = await db.select({ id: schoolInstructorsTable.id })
    .from(schoolInstructorsTable)
    .where(and(eq(schoolInstructorsTable.schoolId, schoolId), eq(schoolInstructorsTable.instructorId, instructorId)));

  if (existing) {
    await db.update(schoolInstructorsTable)
      .set({ status: "active", roleWithinSchool: roleWithinSchool ?? "instructor", isPrimary: isPrimary ?? false })
      .where(eq(schoolInstructorsTable.id, existing.id));
    res.json({ ok: true, reactivated: true });
    return;
  }

  const [row] = await db.insert(schoolInstructorsTable).values({
    schoolId,
    instructorId,
    roleWithinSchool: roleWithinSchool ?? "instructor",
    isPrimary: isPrimary ?? false,
    status: "active",
  }).returning();

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "school_instructor_added",
    resourceType: "school_instructor",
    resourceId: row.id,
    actorRole: user.role,
    result: "success",
    route: `/schools/${schoolId}/instructors`,
    metadataJson: { instructorId } as any,
  }).catch(() => null);

  res.status(201).json(row);
});

// ─── Remove instructor from school ───────────────────────────────────────────

router.delete("/schools/:id/instructors/:instructorId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const schoolId = parseInt(req.params.id as string, 10);
  const instructorId = parseInt(req.params.instructorId as string, 10);
  if (!requireSchoolScope({ user, res }, schoolId)) return;
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin or super_admin required" }); return;
  }

  await db.update(schoolInstructorsTable)
    .set({ status: "inactive", endedAt: new Date() })
    .where(and(eq(schoolInstructorsTable.schoolId, schoolId), eq(schoolInstructorsTable.instructorId, instructorId)));

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "school_instructor_removed",
    resourceType: "school_instructor",
    actorRole: user.role,
    result: "success",
    route: `/schools/${schoolId}/instructors/${instructorId}`,
    metadataJson: { instructorId } as any,
  }).catch(() => null);

  res.json({ ok: true });
});

// ─── Assign school to user (super_admin: bind a user to this school) ──────────

router.post("/schools/:id/admins", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSuperAdmin(user.role)) { res.status(403).json({ error: "super_admin required" }); return; }

  const schoolId = parseInt(req.params.id as string, 10);
  const { userId, role } = req.body as { userId: number; role?: string };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const validRoles = ["school_admin", "instructor"];
  const assignedRole = validRoles.includes(role ?? "") ? (role as string) : "school_admin";

  await db.update(usersTable).set({ schoolId, role: assignedRole }).where(eq(usersTable.id, userId));

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "school_admin_assigned",
    resourceType: "user",
    resourceId: userId,
    actorRole: user.role,
    result: "success",
    route: `/schools/${schoolId}/admins`,
    metadataJson: { schoolId, assignedRole } as any,
  }).catch(() => null);

  res.json({ ok: true });
});

// ─── Feedback settings ────────────────────────────────────────────────────────

router.get("/schools/mine/feedback-settings", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin required" }); return;
  }
  if (!user.schoolId) { res.status(400).json({ error: "No school associated" }); return; }

  const [school] = await db.select().from(drivingSchoolsTable).where(eq(drivingSchoolsTable.id, user.schoolId));
  if (!school) { res.status(404).json({ error: "School not found" }); return; }

  res.json({
    feedbackEnabled: school.feedbackEnabled,
    feedbackReminderDays: school.feedbackReminderDays,
    feedbackShareWithMentor: school.feedbackShareWithMentor,
    mentorGroupEmail: school.mentorGroupEmail ?? null,
  });
});

router.patch("/schools/mine/feedback-settings", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "school_admin required" }); return;
  }
  if (!user.schoolId) { res.status(400).json({ error: "No school associated" }); return; }

  const { feedbackEnabled, feedbackReminderDays, feedbackShareWithMentor, mentorGroupEmail } = req.body as {
    feedbackEnabled?: boolean;
    feedbackReminderDays?: number;
    feedbackShareWithMentor?: boolean;
    mentorGroupEmail?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (feedbackEnabled !== undefined) updates.feedbackEnabled = feedbackEnabled;
  if (feedbackReminderDays !== undefined) updates.feedbackReminderDays = Math.max(1, Math.min(30, feedbackReminderDays));
  if (feedbackShareWithMentor !== undefined) updates.feedbackShareWithMentor = feedbackShareWithMentor;
  if (mentorGroupEmail !== undefined) updates.mentorGroupEmail = mentorGroupEmail ?? null;

  const [updated] = await db.update(drivingSchoolsTable)
    .set(updates)
    .where(eq(drivingSchoolsTable.id, user.schoolId))
    .returning();

  res.json({
    feedbackEnabled: updated.feedbackEnabled,
    feedbackReminderDays: updated.feedbackReminderDays,
    feedbackShareWithMentor: updated.feedbackShareWithMentor,
    mentorGroupEmail: updated.mentorGroupEmail ?? null,
  });
});

export default router;
