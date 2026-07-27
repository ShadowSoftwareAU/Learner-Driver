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
import { eq, and } from "drizzle-orm";
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
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
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

  res.json({ student, recentAssessments, upcomingBookings, link: { relationshipType: link.relationshipType, linkedAt: link.linkedAt } });
});

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
