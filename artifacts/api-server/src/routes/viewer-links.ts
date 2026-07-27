/**
 * Viewer role routes — parents, guardians, mentors.
 * Viewers link to students using a unique student code (DRV-XXXXX format).
 * Viewers see only limited, sanitised student data — no private instructor notes.
 *
 * Access:
 *   POST /viewer-links/request — any authenticated user (to become a viewer)
 *   GET  /viewer/me/students    — viewer only
 *   GET  /viewer/students/:id/dashboard — viewer only (must have active link)
 */
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  viewerLinksTable,
  viewerLinkRequestsTable,
  studentsTable,
  assessmentsTable,
  maneuverResultsTable,
  maneuversTable,
  bookingsTable,
  usersTable,
  auditLogsTable,
  instructorsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";
import { logger } from "../lib/logger";

const router = Router();

// ─── Link to student via viewer code ──────────────────────────────────────────

router.post("/viewer-links/request", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { code, relationshipType } = req.body as { code: string; relationshipType?: string };

  if (!code?.trim()) { res.status(400).json({ error: "code is required" }); return; }

  const normalizedCode = code.trim().toUpperCase();

  // Find student with this viewer code
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.viewerCode as any, normalizedCode));

  if (!student) {
    // Log failed attempt for security monitoring
    await db.insert(viewerLinkRequestsTable).values({
      viewerUserId: user.id,
      enteredCode: normalizedCode,
      status: "rejected",
      resolvedAt: new Date(),
      failureReason: "code_not_found",
    }).catch(() => null);
    res.status(404).json({ error: "Invalid code. Please check with the student's instructor." });
    return;
  }

  // Check if link already exists
  const [existing] = await db.select().from(viewerLinksTable)
    .where(and(eq(viewerLinksTable.viewerUserId, user.id), eq(viewerLinksTable.studentId, student.id)));

  if (existing?.linkStatus === "active") {
    res.json({ ok: true, alreadyLinked: true, studentId: student.id });
    return;
  }

  // Log successful request
  const [requestRow] = await db.insert(viewerLinkRequestsTable).values({
    studentId: student.id,
    viewerUserId: user.id,
    enteredCode: normalizedCode,
    status: "approved",
    resolvedAt: new Date(),
    resolvedByUserId: null,
  }).returning();

  // Create or reactivate the link
  if (existing) {
    await db.update(viewerLinksTable).set({ linkStatus: "active", linkedAt: new Date() }).where(eq(viewerLinksTable.id, existing.id));
  } else {
    await db.insert(viewerLinksTable).values({
      viewerUserId: user.id,
      studentId: student.id,
      schoolId: student.schoolId ?? null,
      relationshipType: relationshipType ?? null,
      linkStatus: "active",
      linkedByUserId: null,
    });
  }

  // Upgrade role to viewer if currently unassigned
  if (user.role === "unassigned") {
    await db.update(usersTable).set({ role: "viewer" }).where(eq(usersTable.id, user.id));
  }

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "viewer_link_created",
    resourceType: "viewer_link",
    studentId: student.id,
    actorRole: user.role,
    result: "success",
    route: "/viewer-links/request",
    metadataJson: { code: normalizedCode, requestId: requestRow.id } as any,
  }).catch(() => null);

  logger.info({ event: "viewer_link_created", viewerUserId: user.id, studentId: student.id });

  res.status(201).json({ ok: true, studentId: student.id });
});

// ─── Get my linked students (viewer) ──────────────────────────────────────────

router.get("/viewer/me/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  const links = await db.select().from(viewerLinksTable)
    .where(and(eq(viewerLinksTable.viewerUserId, user.id), eq(viewerLinksTable.linkStatus, "active")));

  if (links.length === 0) { res.json([]); return; }

  const studentIds = links.map(l => l.studentId);

  const students = await db.select({
    id: studentsTable.id,
    fullName: studentsTable.fullName,
    totalHours: studentsTable.totalHours,
    schoolId: studentsTable.schoolId,
    headshotPath: studentsTable.headshotPath,
    noShowCount: studentsTable.noShowCount,
    attendanceReliabilityScore: studentsTable.attendanceReliabilityScore,
  }).from(studentsTable)
    .where(eq(studentsTable.id, studentIds[0])); // simplified for single student; expand later

  // For multiple students, join via IN — keeping simple for Phase 2
  const allStudents = await Promise.all(
    studentIds.map(id =>
      db.select({
        id: studentsTable.id,
        fullName: studentsTable.fullName,
        totalHours: studentsTable.totalHours,
        schoolId: studentsTable.schoolId,
        headshotPath: studentsTable.headshotPath,
        noShowCount: studentsTable.noShowCount,
        attendanceReliabilityScore: studentsTable.attendanceReliabilityScore,
      }).from(studentsTable).where(eq(studentsTable.id, id)).then(r => r[0])
    )
  );

  const result = allStudents.filter(Boolean).map(s => {
    const link = links.find(l => l.studentId === s.id);
    return { ...s, relationshipType: link?.relationshipType, linkedAt: link?.linkedAt };
  });

  res.json(result);
});

// ─── Viewer student dashboard ─────────────────────────────────────────────────
// Sanitised view — no private instructor notes; no medical data; no other students.

router.get("/viewer/students/:id/dashboard", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.id as string, 10);

  // Verify viewer has active link to this student
  const [link] = await db.select().from(viewerLinksTable)
    .where(and(eq(viewerLinksTable.viewerUserId, user.id), eq(viewerLinksTable.studentId, studentId), eq(viewerLinksTable.linkStatus, "active")));

  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  const [student] = await db.select({
    id: studentsTable.id,
    fullName: studentsTable.fullName,
    totalHours: studentsTable.totalHours,
    noShowCount: studentsTable.noShowCount,
    attendanceReliabilityScore: studentsTable.attendanceReliabilityScore,
    schoolId: studentsTable.schoolId,
    headshotPath: studentsTable.headshotPath,
    instructorHours: studentsTable.instructorHours,
    supervisedHours: studentsTable.supervisedHours,
    state: studentsTable.state,
    // Safe subset — NO encrypted medical data, NO private notes
  }).from(studentsTable).where(eq(studentsTable.id, studentId));

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  // Recent assessments — summary only, no private notes
  const recentAssessments = await db.select({
    id: assessmentsTable.id,
    lessonDate: assessmentsTable.lessonDate,
    durationMinutes: assessmentsTable.durationMinutes,
    pedalOperator: assessmentsTable.pedalOperator,
    focusAreasNext: assessmentsTable.focusAreasNext,
    totalHoursThisLesson: assessmentsTable.durationMinutes,
    performedByRole: assessmentsTable.performedByRole,
  }).from(assessmentsTable)
    .where(eq(assessmentsTable.studentId, studentId))
    .orderBy(assessmentsTable.lessonDate)
    .limit(10);

  // Upcoming bookings
  const upcomingBookings = await db.select({
    id: bookingsTable.id,
    scheduledAt: bookingsTable.requestedDate,
    durationMinutes: bookingsTable.durationMinutes,
    status: bookingsTable.status,
    pickupAddress: bookingsTable.suburb,
  }).from(bookingsTable)
    .where(and(eq(bookingsTable.studentId, studentId)))
    .limit(5);

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "viewer_student_dashboard",
    resourceType: "student",
    resourceId: studentId,
    studentId,
    actorRole: user.role,
    result: "success",
    route: `/viewer/students/${studentId}/dashboard`,
  }).catch(() => null);

  // QLD hours breakdown — mirrors the student dashboard calculation
  const instructorHours = Math.round(Number(student.instructorHours ?? 0) * 10) / 10;
  const supervisedHours = Math.round(Number(student.supervisedHours ?? 0) * 10) / 10;
  const isQLD = student.state === "QLD";
  // QLD: 1 instructor hour counts as 3 effective hours toward the 100-hour requirement
  const effectiveTotalHours = isQLD
    ? Math.round((instructorHours * 3 + supervisedHours) * 10) / 10
    : Math.round((instructorHours + supervisedHours) * 10) / 10;

  res.json({
    student,
    recentAssessments,
    upcomingBookings,
    link: { relationshipType: link.relationshipType, linkedAt: link.linkedAt },
    instructorHours,
    supervisedHours,
    effectiveTotalHours,
    isQLD,
  });
});

// ─── Log a supervised session ─────────────────────────────────────────────────
// Parents / guardians / mentors use this to log hours driven under their
// supervision. These sessions are tagged performedByRole='supervised' so they
// never influence the instructor-only lesson plan.

const supervisedSessionBody = z.object({
  lessonDate: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(480),
  pedalOperator: z.enum(["student", "instructor", "shared"]).default("student"),
  weatherCondition: z.enum(["clear", "partly_cloudy", "overcast", "light_rain", "heavy_rain", "foggy", "windy"]).optional().nullable(),
  lightingCondition: z.enum(["daylight", "dawn", "dusk", "night"]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

router.post("/viewer/students/:studentId/supervised-sessions", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.studentId as string, 10);

  // Verify viewer has an active link to this student
  const [link] = await db.select().from(viewerLinksTable).where(
    and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    )
  );
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  const parsed = supervisedSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const { lessonDate, durationMinutes, pedalOperator, weatherCondition, lightingCondition, notes } = parsed.data;

  // Get or create a supervisor record in the instructors table for this viewer user
  // so the FK constraint on assessments.instructor_id is satisfied.
  let supervisorRecord = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!supervisorRecord) {
    [supervisorRecord] = await db.insert(instructorsTable).values({
      userId: user.id,
      fullName: user.name ?? "Supervisor",
      email: user.email ?? "",
    }).returning();
  }

  const [session] = await db.insert(assessmentsTable).values({
    studentId,
    instructorId: supervisorRecord.id,
    lessonDate,
    durationMinutes,
    pedalOperator,
    performedByRole: "supervised",
    assessmentType: "qsafe",
    status: "completed",
    finalizationStatus: "dispatched", // supervised sessions are pre-approved; no instructor workflow needed
    confidenceNote: notes ?? null,
    focusAreasNext: null,
    weatherCondition: weatherCondition ?? null,
    lightingCondition: lightingCondition ?? null,
  }).returning();

  // Accrue hours to student — supervised sessions increment supervisedHours, not instructorHours
  const hours = durationMinutes / 60;
  await db.execute(sql`UPDATE students SET total_hours = total_hours + ${hours}, supervised_hours = supervised_hours + ${hours} WHERE id = ${studentId}`);

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "create_supervised_session",
    resourceType: "assessment",
    resourceId: session.id,
    studentId,
  }, req);

  res.status(201).json({ ...formatSupervisedSession(session), supervisorName: user.name ?? "Supervisor" });
});

function formatSupervisedSession(a: any) {
  return {
    id: a.id,
    studentId: a.studentId,
    lessonDate: a.lessonDate,
    durationMinutes: a.durationMinutes,
    pedalOperator: a.pedalOperator,
    performedByRole: "supervised" as const,
    status: a.status,
    weatherCondition: a.weatherCondition ?? null,
    lightingCondition: a.lightingCondition ?? null,
    notes: a.confidenceNote ?? null,
    createdAt: a.createdAt,
  };
}

// ─── Viewer assessment detail ─────────────────────────────────────────────────
// Full assessment including maneuver guidance (for supervising during a lesson).

router.get("/viewer/assessments/:assessmentId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const assessmentId = parseInt(req.params.assessmentId as string, 10);

  // Load the assessment to find the student
  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
  if (!assessment) { res.status(404).json({ error: "Assessment not found" }); return; }

  // Verify viewer has an active link to this student
  const [link] = await db.select().from(viewerLinksTable).where(
    and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, assessment.studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    )
  );
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  // Fetch student name
  const [student] = await db.select({ id: studentsTable.id, fullName: studentsTable.fullName })
    .from(studentsTable).where(eq(studentsTable.id, assessment.studentId));

  // Fetch maneuver results joined with maneuver details
  const results = await db
    .select({
      id: maneuverResultsTable.id,
      maneuverId: maneuverResultsTable.maneuverId,
      competencyLevel: maneuverResultsTable.competencyLevel,
      notes: maneuverResultsTable.notes,
      maneuverName: maneuversTable.name,
      category: maneuversTable.category,
      complianceCriteria: maneuversTable.complianceCriteria,
      masteryDefinition: maneuversTable.masteryDefinition,
    })
    .from(maneuverResultsTable)
    .leftJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
    .where(eq(maneuverResultsTable.assessmentId, assessmentId));

  res.json({
    assessment: {
      id: assessment.id,
      lessonDate: assessment.lessonDate,
      durationMinutes: assessment.durationMinutes,
      pedalOperator: assessment.pedalOperator,
      studentName: student?.fullName ?? "Unknown",
      studentId: assessment.studentId,
      focusAreasNext: assessment.focusAreasNext,
      confidenceNote: assessment.confidenceNote,
      weatherCondition: (assessment as any).weatherCondition ?? null,
      lightingCondition: (assessment as any).lightingCondition ?? null,
    },
    maneuverResults: results,
  });
});

export default router;
