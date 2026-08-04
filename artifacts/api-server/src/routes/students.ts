import { Router } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, studentsTable, usersTable, assessmentsTable, maneuverResultsTable, maneuversTable, instructorsTable, bookingsTable, studentMilestonesTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";
import { sendExternalEmail } from "../lib/notifications/emailChannel";
import { encrypt, decrypt, derivePreview } from "../lib/crypto";
import { canViewRestrictedMedicalData } from "../lib/authz";
import { isSchoolAdmin, isSuperAdmin } from "../lib/config";
import { MILESTONE_DEFINITIONS, MILESTONE_MAP } from "../lib/milestones/definitions";

const router = Router();

async function instructorHasStudent(instructorId: number, studentId: number): Promise<boolean> {
  const [created] = await db.select({ id: studentsTable.id }).from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.createdByInstructorId, instructorId))).limit(1);
  if (created) return true;
  const [assessment] = await db.select({ id: assessmentsTable.id }).from(assessmentsTable)
    .where(and(eq(assessmentsTable.instructorId, instructorId), eq(assessmentsTable.studentId, studentId))).limit(1);
  if (assessment) return true;
  const [booking] = await db.select({ id: bookingsTable.id }).from(bookingsTable)
    .where(and(eq(bookingsTable.instructorId, instructorId), eq(bookingsTable.studentId, studentId))).limit(1);
  return !!booking;
}

async function getInstructor(userId: number, res: any) {
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, userId));
  if (!instructor) { res.status(403).json({ error: "Instructor record not found" }); return null; }
  return instructor;
}

// ─── List ──────────────────────────────────────────────────────────────────────

router.get("/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let rows;

  if (isSchoolAdmin(user.role) || isSuperAdmin(user.role)) {
    rows = await db.select().from(studentsTable).orderBy(studentsTable.fullName);
    if (user.schoolId && !isSuperAdmin(user.role)) {
      rows = rows.filter(r => r.schoolId === user.schoolId);
    }
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    const assessed = await db.selectDistinct({ studentId: assessmentsTable.studentId }).from(assessmentsTable)
      .where(eq(assessmentsTable.instructorId, instructor.id));
    const booked = await db.selectDistinct({ studentId: bookingsTable.studentId }).from(bookingsTable)
      .where(and(eq(bookingsTable.instructorId, instructor.id)));
    const created = await db.select({ id: studentsTable.id }).from(studentsTable)
      .where(eq(studentsTable.createdByInstructorId, instructor.id));
    const studentIds = [...new Set([
      ...assessed.map(r => r.studentId),
      ...booked.map(r => r.studentId),
      ...created.map(r => r.id),
    ])];
    if (studentIds.length === 0) { res.json([]); return; }
    rows = await db.select().from(studentsTable)
      .where(sql`${studentsTable.id} = ANY(${sql.raw(`ARRAY[${studentIds.join(",")}]::integer[]`)})`)
      .orderBy(studentsTable.fullName);
  } else {
    rows = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  }

  res.json(rows.map(s => formatStudent(s)));
});

// ─── Create ────────────────────────────────────────────────────────────────────

router.post("/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { fullName, email, phone, dateOfBirth, licenseStatus, transmissionPreference, medicalNotes, guardianName, guardianPhone, guardianEmail, pcycSchoolEmail, licenseNumber, licenceClass, licenceType, licenceEffectiveDate, licenceExpiry, licenceCardNumber, address, licenceFrontPath, licenceBackPath, headshotPath, notes, region, state, country, sendInvite } = req.body;
  if (!fullName || !email) { res.status(400).json({ error: "fullName and email required" }); return; }

  const validLicenseStatuses = ["learner", "provisional", "open", "overseas"];
  const validTransmissions = ["automatic", "manual"];
  if (licenseStatus && !validLicenseStatuses.includes(licenseStatus)) {
    res.status(400).json({ error: `licenseStatus must be one of: ${validLicenseStatuses.join(", ")}` }); return;
  }
  if (transmissionPreference && !validTransmissions.includes(transmissionPreference)) {
    res.status(400).json({ error: `transmissionPreference must be one of: ${validTransmissions.join(", ")}` }); return;
  }

  let userId: number | null = null;
  let createdByInstructorId: number | null = null;
  if (user.role === "student") {
    userId = user.id;
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    createdByInstructorId = instructor.id;
  }

  const [s] = await db.insert(studentsTable).values({
    userId, createdByInstructorId,
    schoolId: user.schoolId ?? null,
    fullName, email,
    phone: phone ?? null, dateOfBirth: dateOfBirth ?? null,
    licenseStatus: licenseStatus ?? null, transmissionPreference: transmissionPreference ?? null,
    medicalNotes: medicalNotes ?? null,
    guardianName: guardianName ?? null, guardianPhone: guardianPhone ?? null,
    guardianEmail: guardianEmail ?? null, pcycSchoolEmail: pcycSchoolEmail ?? null,
    licenseNumber: licenseNumber ?? null,
    licenceClass: licenceClass ?? null,
    licenceType: licenceType ?? null,
    licenceEffectiveDate: licenceEffectiveDate ?? null,
    licenceExpiry: licenceExpiry ?? null,
    licenceCardNumber: licenceCardNumber ?? null,
    address: address ?? null,
    licenceFrontPath: licenceFrontPath ?? null,
    licenceBackPath: licenceBackPath ?? null, headshotPath: headshotPath ?? null,
    notes: notes ?? null, region: region ?? null, state: state ?? null, country: country ?? null,
  }).returning();
  await logAudit({ actorId: user.id, actorRole: user.role, action: "create_student", resourceType: "student", resourceId: s.id, studentId: s.id }, req);

  // Optionally send a welcome / login invitation email to the student
  if (sendInvite && email) {
    const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "steps2drive.app"}`;
    await sendExternalEmail({
      to: email,
      subject: `Welcome to Steps2Drive — ${fullName}`,
      title: `Welcome to Steps2Drive, ${fullName.split(" ")[0]}!`,
      body: `Your instructor has created a learner profile for you on Steps2Drive.\n\nYou can sign in to review your lesson assessments, track your progress, and manage bookings at:\n\n${appUrl}\n\nUse this email address (${email}) to create your account or sign in.\n\nIf you have any questions, contact your instructor directly.`,
    }).catch(() => {/* non-fatal */});
  }

  res.status(201).json(formatStudent(s));
});

// ─── Own student profile (authenticated student) ─────────────────────────────

router.get("/students/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  if (!s) { res.status(404).json({ error: "Student profile not found" }); return; }
  res.json(formatStudent(s));
});

router.patch("/students/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  if (!s) { res.status(404).json({ error: "Student profile not found" }); return; }
  const body = req.body as { phone?: string | null; address?: string | null };
  const updates: Record<string, unknown> = {};
  if ("phone" in body) updates.phone = body.phone ?? null;
  if ("address" in body) updates.address = body.address ?? null;
  const [updated] = await db.update(studentsTable)
    .set(updates)
    .where(eq(studentsTable.id, s.id))
    .returning();
  res.json(formatStudent(updated));
});

// ─── Get one ───────────────────────────────────────────────────────────────────

router.get("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student" && s.userId !== user.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "view_student", resourceType: "student", resourceId: s.id, studentId: s.id }, req);
  res.json(formatStudent(s));
});

// ─── Update ────────────────────────────────────────────────────────────────────

router.patch("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, id));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const { fullName, phone, dateOfBirth, licenseStatus, transmissionPreference, medicalNotes, guardianName, guardianPhone, guardianEmail, pcycSchoolEmail, licenseNumber, licenceFrontPath, licenceBackPath, headshotPath, notes, status, region, state, country } = req.body;

  const validLicenseStatuses = ["learner", "provisional", "open", "overseas"];
  const validTransmissions = ["automatic", "manual"];
  if (licenseStatus !== undefined && licenseStatus !== null && !validLicenseStatuses.includes(licenseStatus)) {
    res.status(400).json({ error: `licenseStatus must be one of: ${validLicenseStatuses.join(", ")}` }); return;
  }
  if (transmissionPreference !== undefined && transmissionPreference !== null && !validTransmissions.includes(transmissionPreference)) {
    res.status(400).json({ error: `transmissionPreference must be one of: ${validTransmissions.join(", ")}` }); return;
  }

  const updates: any = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
  if (licenseStatus !== undefined) updates.licenseStatus = licenseStatus;
  if (transmissionPreference !== undefined) updates.transmissionPreference = transmissionPreference;
  if (medicalNotes !== undefined) updates.medicalNotes = medicalNotes;
  if (guardianName !== undefined) updates.guardianName = guardianName;
  if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;
  if (guardianEmail !== undefined) updates.guardianEmail = guardianEmail;
  if (pcycSchoolEmail !== undefined) updates.pcycSchoolEmail = pcycSchoolEmail;
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (licenceFrontPath !== undefined) updates.licenceFrontPath = licenceFrontPath;
  if (licenceBackPath !== undefined) updates.licenceBackPath = licenceBackPath;
  if (headshotPath !== undefined) updates.headshotPath = headshotPath;
  if (notes !== undefined) updates.notes = notes;
  if (region !== undefined) updates.region = region;
  if (state !== undefined) updates.state = state;
  if (country !== undefined) updates.country = country;
  if (status && (isSchoolAdmin(user.role) || isSuperAdmin(user.role))) updates.status = status;

  const [updated] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStudent(updated));
});

// ─── Medical / Allergy ─────────────────────────────────────────────────────────

/**
 * GET /students/:id/medical
 * Returns decrypted medical and allergy data. Restricted to instructor/admin.
 */
router.get("/students/:id/medical", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (!canViewRestrictedMedicalData(user)) {
    res.status(403).json({ error: "Access denied — restricted medical data requires instructor or admin role" }); return;
  }

  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) { res.status(403).json({ error: "Access denied" }); return; }
  }

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "view_student_medical",
    resourceType: "student",
    resourceId: id,
    studentId: id,
    result: "success",
    metadataJson: { dataClassification: "restricted" },
  }, req);

  res.json({
    studentId: id,
    medicalConditions: s.medicalConditionsEncrypted ? decrypt(s.medicalConditionsEncrypted) : null,
    allergies: s.allergiesEncrypted ? decrypt(s.allergiesEncrypted) : null,
    medicalConditionsPreview: s.medicalConditionsPreview ?? null,
    allergiesPreview: s.allergiesPreview ?? null,
    dataClassification: "restricted",
  });
});

/**
 * PATCH /students/:id/medical
 * Updates medical/allergy data. Encrypts at rest. Restricted to instructor/admin.
 */
router.patch("/students/:id/medical", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (!canViewRestrictedMedicalData(user)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const medParsed = z.object({
    medicalConditions: z.string().max(10_000).optional(),
    allergies: z.string().max(5_000).optional(),
  }).safeParse(req.body);
  if (!medParsed.success) {
    res.status(400).json({ error: "Invalid medical data", issues: medParsed.error.issues });
    return;
  }
  const { medicalConditions, allergies } = medParsed.data;
  const updates: any = {};

  if (medicalConditions !== undefined) {
    updates.medicalConditionsEncrypted = medicalConditions ? encrypt(medicalConditions) : null;
    updates.medicalConditionsPreview = medicalConditions ? derivePreview(medicalConditions) : null;
  }
  if (allergies !== undefined) {
    updates.allergiesEncrypted = allergies ? encrypt(allergies) : null;
    updates.allergiesPreview = allergies ? derivePreview(allergies) : null;
  }

  await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "update_student_medical",
    resourceType: "student",
    resourceId: id,
    studentId: id,
    result: "success",
    metadataJson: { dataClassification: "restricted", fieldsUpdated: Object.keys(updates) },
  }, req);

  res.json({ ok: true, message: "Medical information updated and encrypted" });
});

// ─── Viewer code ───────────────────────────────────────────────────────────────

/**
 * POST /students/:id/viewer-code
 * Generates or regenerates a unique viewer linking code (DRV-XXXXXXX).
 * Requires instructor/admin relationship.
 */
router.post("/students/:id/viewer-code", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role === "student") { res.status(403).json({ error: "Access denied" }); return; }
  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) { res.status(403).json({ error: "Access denied" }); return; }
  }

  // Generate DRV-XXXXXXX — 7 chars, no ambiguous characters (0/O, 1/I/l)
  const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  function genCode(): string {
    const chars = Array.from({ length: 7 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    return `DRV-${chars}`;
  }

  // Collision-free generation (up to 5 retries)
  let code = genCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.viewerCode, code)).limit(1);
    if (!existing) break;
    code = genCode();
  }

  const [updated] = await db.update(studentsTable)
    .set({ viewerCode: code, viewerCodeIssuedAt: new Date() })
    .where(eq(studentsTable.id, id))
    .returning({ viewerCode: studentsTable.viewerCode, viewerCodeIssuedAt: studentsTable.viewerCodeIssuedAt });

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "generate_viewer_code",
    resourceType: "student",
    resourceId: id,
    studentId: id,
  }, req);

  res.json({ viewerCode: updated.viewerCode, viewerCodeIssuedAt: updated.viewerCodeIssuedAt });
});

// ─── Progress ──────────────────────────────────────────────────────────────────

router.get("/students/:id/progress", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, studentId))) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Not found" }); return; }

  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);
  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.studentId, studentId)).orderBy(assessmentsTable.lessonDate);
  const assessmentIds = assessments.map(a => a.id);
  let allResults: any[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db.select().from(maneuverResultsTable)
      .where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);
  }

  const bestLevel: Record<number, string> = {};
  const levelOrder = ["not_attempted", "attempted", "practiced", "mastered"];
  for (const r of allResults) {
    const cur = bestLevel[r.maneuverId];
    if (!cur || levelOrder.indexOf(r.competencyLevel) > levelOrder.indexOf(cur)) bestLevel[r.maneuverId] = r.competencyLevel;
  }

  const categories = [...new Set(allManeuvers.map(m => m.category))];
  const skillBreakdown = categories.map(cat => {
    const catManeuvers = allManeuvers.filter(m => m.category === cat);
    return {
      category: cat, total: catManeuvers.length,
      mastered: catManeuvers.filter(m => bestLevel[m.id] === "mastered").length,
      practicing: catManeuvers.filter(m => bestLevel[m.id] === "practiced" || bestLevel[m.id] === "attempted").length,
      notStarted: catManeuvers.filter(m => !bestLevel[m.id] || bestLevel[m.id] === "not_attempted").length,
    };
  });

  await logAudit({ actorId: user.id, actorRole: user.role, action: "view_student_progress", resourceType: "student", resourceId: studentId, studentId }, req);

  res.json({
    studentId,
    totalHours: student.totalHours,
    completedManeuvers: Object.values(bestLevel).filter(l => l === "mastered").length,
    totalManeuvers: allManeuvers.length,
    skillBreakdown,
    recentAssessments: assessments.slice(-5).reverse().map(formatAssessment),
    noShowCount: student.noShowCount ?? 0,
    attendanceReliabilityScore: student.attendanceReliabilityScore ?? null,
  });
});

// ─── Milestones ────────────────────────────────────────────────────────────────

router.get("/students/:id/milestones", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (isSchoolAdmin(user.role) || isSuperAdmin(user.role)) {
    // admins pass through — no additional check needed
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, studentId))) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  } else {
    // viewer, unassigned, and any other roles are denied
    res.status(403).json({ error: "Access denied" }); return;
  }

  const earned = await db
    .select()
    .from(studentMilestonesTable)
    .where(eq(studentMilestonesTable.studentId, studentId))
    .orderBy(desc(studentMilestonesTable.earnedAt));

  const earnedMap = new Map(earned.map(r => [r.milestoneId, r.earnedAt]));

  const milestones = MILESTONE_DEFINITIONS.map(def => ({
    id: def.id,
    name: def.name,
    icon: def.icon,
    description: def.description,
    category: def.category,
    earned: earnedMap.has(def.id),
    earnedAt: earnedMap.get(def.id) ?? null,
  }));

  res.json(milestones);
});

// ─── Maneuver Stats ────────────────────────────────────────────────────────────

router.get("/students/:id/maneuver-stats", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (isSchoolAdmin(user.role) || isSuperAdmin(user.role)) {
    // admins pass through — no additional check needed
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, studentId))) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  } else {
    // viewer, unassigned, and any other roles are denied
    res.status(403).json({ error: "Access denied" }); return;
  }

  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);

  const assessments = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.studentId, studentId));

  const assessmentIds = assessments.map(a => a.id);

  let allResults: { maneuverId: number; competencyLevel: string }[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db
      .select({ maneuverId: maneuverResultsTable.maneuverId, competencyLevel: maneuverResultsTable.competencyLevel })
      .from(maneuverResultsTable)
      .where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);
  }

  const levelOrder = ["not_attempted", "attempted", "practiced", "mastered"];

  // Aggregate counts and best level per maneuver
  const countByManeuver: Record<number, number> = {};
  const bestLevelByManeuver: Record<number, string> = {};

  for (const r of allResults) {
    if (r.competencyLevel !== "not_attempted") {
      countByManeuver[r.maneuverId] = (countByManeuver[r.maneuverId] ?? 0) + 1;
    }
    const cur = bestLevelByManeuver[r.maneuverId];
    if (!cur || levelOrder.indexOf(r.competencyLevel) > levelOrder.indexOf(cur)) {
      bestLevelByManeuver[r.maneuverId] = r.competencyLevel;
    }
  }

  const stats = allManeuvers.map(m => ({
    maneuverId: m.id,
    name: m.name,
    category: m.category,
    attemptCount: countByManeuver[m.id] ?? 0,
    bestCompetencyLevel: bestLevelByManeuver[m.id] ?? "not_attempted",
  }));

  // Sort by attempt count descending, then by maneuver name
  stats.sort((a, b) => b.attemptCount - a.attemptCount || a.name.localeCompare(b.name));

  res.json(stats);
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatStudent(s: any) {
  return {
    id: s.id, userId: s.userId, createdByInstructorId: s.createdByInstructorId,
    schoolId: s.schoolId ?? null, fullName: s.fullName, email: s.email,
    phone: s.phone, dateOfBirth: s.dateOfBirth,
    licenseStatus: s.licenseStatus ?? null,
    transmissionPreference: s.transmissionPreference ?? null,
    medicalNotes: s.medicalNotes ?? null,
    guardianName: s.guardianName, guardianPhone: s.guardianPhone, guardianEmail: s.guardianEmail,
    pcycSchoolEmail: s.pcycSchoolEmail, licenseNumber: s.licenseNumber,
    licenceFrontPath: s.licenceFrontPath, licenceBackPath: s.licenceBackPath, headshotPath: s.headshotPath,
    address: s.address ?? null,
    notes: s.notes, region: s.region, state: s.state ?? null, country: s.country,
    totalHours: s.totalHours,
    instructorHours: s.instructorHours ?? 0,
    supervisedHours: s.supervisedHours ?? 0,
    status: s.status,
    // Attendance
    noShowCount: s.noShowCount ?? 0,
    attendanceReliabilityScore: s.attendanceReliabilityScore ?? null,
    // Medical previews (not full data — use /students/:id/medical for full data)
    medicalConditionsPreview: s.medicalConditionsPreview ?? null,
    allergiesPreview: s.allergiesPreview ?? null,
    // Viewer code (code itself visible to instructor/admin)
    viewerCode: s.viewerCode ?? null,
    viewerCodeIssuedAt: s.viewerCodeIssuedAt ?? null,
    createdAt: s.createdAt,
  };
}

function formatAssessment(a: any) {
  return {
    id: a.id, studentId: a.studentId, instructorId: a.instructorId,
    studentName: null, instructorName: null,
    lessonDate: a.lessonDate, durationMinutes: a.durationMinutes,
    status: a.status, pedalOperator: a.pedalOperator ?? "student",
    confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt,
  };
}

export default router;
