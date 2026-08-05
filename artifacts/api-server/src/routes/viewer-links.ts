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
import { eq, and, sql, gte, desc } from "drizzle-orm";
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
  handoverNotesTable,
  studentMilestonesTable,
  studentWalletsTable,
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
        instructorHours: studentsTable.instructorHours,
        supervisedHours: studentsTable.supervisedHours,
        state: studentsTable.state,
      }).from(studentsTable).where(eq(studentsTable.id, id)).then(r => r[0])
    )
  );

  const result = allStudents.filter(Boolean).map(s => {
    const link = links.find(l => l.studentId === s.id);
    const instructorHours = Math.round(Number(s.instructorHours ?? 0) * 10) / 10;
    const supervisedHours = Math.round(Number(s.supervisedHours ?? 0) * 10) / 10;
    const isQLD = s.state === "QLD";
    const effectiveTotalHours = isQLD
      ? Math.round((instructorHours * 3 + supervisedHours) * 10) / 10
      : Math.round((instructorHours + supervisedHours) * 10) / 10;
    return {
      ...s,
      instructorHours,
      supervisedHours,
      effectiveTotalHours,
      isQLD,
      relationshipType: link?.relationshipType,
      linkedAt: link?.linkedAt,
    };
  });

  res.json(result);
});

// ─── Viewer student dashboard ─────────────────────────────────────────────────
// Sanitised view — no private instructor notes; no medical data; no other students.

router.get("/viewer/students/:id/dashboard", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.id as string, 10);

  // Pagination — page is 1-based, limit is fixed at 10
  const PAGE_LIMIT = 10;
  const page = Math.max(1, parseInt((req.query as any).page as string ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_LIMIT;

  // Verify viewer has active link to this student
  const [link] = await db.select().from(viewerLinksTable)
    .where(and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    ));

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
    licenceExpiry: (studentsTable as any).licenceExpiry,
    // Safe subset — NO encrypted medical data, NO private notes
  }).from(studentsTable).where(eq(studentsTable.id, studentId));

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  // Total assessment count for pagination metadata
  const [{ count: totalAssessments }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.studentId, studentId));

  // Recent assessments — summary only, no private notes; include instructor name
  const recentAssessments = await db.select({
    id: assessmentsTable.id,
    lessonDate: assessmentsTable.lessonDate,
    durationMinutes: assessmentsTable.durationMinutes,
    pedalOperator: assessmentsTable.pedalOperator,
    focusAreasNext: assessmentsTable.focusAreasNext,
    totalHoursThisLesson: assessmentsTable.durationMinutes,
    performedByRole: assessmentsTable.performedByRole,
    instructorName: instructorsTable.fullName,
    weatherCondition: assessmentsTable.weatherCondition,
    lightingCondition: assessmentsTable.lightingCondition,
    confidenceNote: assessmentsTable.confidenceNote,
  }).from(assessmentsTable)
    .leftJoin(instructorsTable, eq(assessmentsTable.instructorId, instructorsTable.id))
    .where(eq(assessmentsTable.studentId, studentId))
    .orderBy(assessmentsTable.lessonDate)
    .limit(PAGE_LIMIT)
    .offset(offset);

  const hasMore = offset + recentAssessments.length < Number(totalAssessments);

  // Upcoming bookings
  const upcomingBookings = await db.select({
    id: bookingsTable.id,
    scheduledAt: bookingsTable.requestedDate,
    durationMinutes: bookingsTable.durationMinutes,
    status: bookingsTable.status,
    pickupAddress: bookingsTable.suburb,
    instructorName: instructorsTable.fullName,
  }).from(bookingsTable)
    .leftJoin(instructorsTable, eq(bookingsTable.instructorId, instructorsTable.id))
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

  // ── Extra data for the expanded viewer dashboard ─────────────────────────────

  // Latest handover note from instructor (approved content only)
  const [latestHandover] = await db.select({
    id: handoverNotesTable.id,
    note: handoverNotesTable.note,
    focusAreas: handoverNotesTable.focusAreas,
    isSafetyCritical: handoverNotesTable.isSafetyCritical,
    createdAt: handoverNotesTable.createdAt,
  }).from(handoverNotesTable)
    .where(and(
      eq(handoverNotesTable.studentId, studentId),
      eq(handoverNotesTable.contentStatus, "approved"),
    ))
    .orderBy(desc(handoverNotesTable.createdAt))
    .limit(1);

  // Milestones earned by this student
  const milestones = await db.select({
    milestoneId: studentMilestonesTable.milestoneId,
    earnedAt: studentMilestonesTable.earnedAt,
  }).from(studentMilestonesTable)
    .where(eq(studentMilestonesTable.studentId, studentId))
    .orderBy(desc(studentMilestonesTable.earnedAt));

  // Student wallet balance (prepaid lesson credit)
  const [walletRow] = await db.select({ balanceCents: studentWalletsTable.balanceCents })
    .from(studentWalletsTable)
    .where(eq(studentWalletsTable.studentId, studentId));
  const walletBalanceCents = walletRow?.balanceCents ?? 0;

  // Night hours — sessions with lightingCondition = 'night'
  const nightSessions = await db.select({ durationMinutes: assessmentsTable.durationMinutes })
    .from(assessmentsTable)
    .where(and(
      eq(assessmentsTable.studentId, studentId),
      eq(assessmentsTable.lightingCondition, "night"),
    ));
  const nightHours = Math.round(nightSessions.reduce((s, r) => s + r.durationMinutes, 0) / 60 * 10) / 10;

  // Skill summary — latest competency per maneuver across all instructor-led sessions
  const allResults = await db.select({
    maneuverId: maneuverResultsTable.maneuverId,
    name: maneuversTable.name,
    category: maneuversTable.category,
    competencyLevel: maneuverResultsTable.competencyLevel,
    lessonDate: assessmentsTable.lessonDate,
  }).from(maneuverResultsTable)
    .innerJoin(assessmentsTable, eq(maneuverResultsTable.assessmentId, assessmentsTable.id))
    .innerJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
    .where(and(
      eq(assessmentsTable.studentId, studentId),
      eq(assessmentsTable.performedByRole, "instructor"),
    ))
    .orderBy(desc(assessmentsTable.lessonDate));

  // Reduce to latest result per maneuver (results already ordered newest-first)
  const latestPerManeuver = new Map<number, { name: string; category: string; competencyLevel: string }>();
  for (const r of allResults) {
    if (!latestPerManeuver.has(r.maneuverId)) {
      latestPerManeuver.set(r.maneuverId, { name: r.name ?? "", category: r.category ?? "Other", competencyLevel: r.competencyLevel });
    }
  }
  const byCat = new Map<string, { mastered: number; practicing: number; notAttempted: number }>();
  for (const { category, competencyLevel } of latestPerManeuver.values()) {
    if (!byCat.has(category)) byCat.set(category, { mastered: 0, practicing: 0, notAttempted: 0 });
    const entry = byCat.get(category)!;
    if (competencyLevel === "mastered") entry.mastered++;
    else if (competencyLevel === "not_attempted" || competencyLevel === "not_started") entry.notAttempted++;
    else entry.practicing++;
  }
  const skillSummary = Array.from(byCat.entries()).map(([category, counts]) => ({ category, ...counts }));

  res.json({
    student,
    recentAssessments,
    upcomingBookings,
    link: { relationshipType: link.relationshipType, linkedAt: link.linkedAt },
    instructorHours,
    supervisedHours,
    effectiveTotalHours,
    isQLD,
    page,
    hasMore,
    totalAssessments: Number(totalAssessments),
    nightHours,
    latestHandover: latestHandover ?? null,
    milestones,
    skillSummary,
    walletBalanceCents,
  });
});

// ─── Logbook CSV export ───────────────────────────────────────────────────────

router.get("/viewer/students/:id/logbook/export", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.id as string, 10);

  // Verify viewer has an active link to this student
  const [link] = await db.select().from(viewerLinksTable).where(
    and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    )
  );
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  const [student] = await db.select({ id: studentsTable.id, fullName: studentsTable.fullName })
    .from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const rows = await db.select({
    lessonDate: assessmentsTable.lessonDate,
    durationMinutes: assessmentsTable.durationMinutes,
    performedByRole: assessmentsTable.performedByRole,
    weatherCondition: assessmentsTable.weatherCondition,
    lightingCondition: assessmentsTable.lightingCondition,
    pedalOperator: assessmentsTable.pedalOperator,
    focusAreasNext: assessmentsTable.focusAreasNext,
    instructorName: instructorsTable.fullName,
  }).from(assessmentsTable)
    .leftJoin(instructorsTable, eq(assessmentsTable.instructorId, instructorsTable.id))
    .where(eq(assessmentsTable.studentId, studentId))
    .orderBy(assessmentsTable.lessonDate);

  const header = ["Date", "Type", "Duration (min)", "Duration (hrs)", "Lighting", "Weather", "Controls", "Instructor/Supervisor", "Focus Areas"];
  const dataRows = rows.map(a => [
    a.lessonDate ?? "",
    a.performedByRole === "supervised" ? "Supervised" : "Professional",
    String(a.durationMinutes),
    (a.durationMinutes / 60).toFixed(2),
    a.lightingCondition ?? "",
    a.weatherCondition ?? "",
    a.pedalOperator ?? "",
    a.performedByRole === "instructor" ? (a.instructorName ?? "") : "Self-supervised",
    a.focusAreasNext ?? "",
  ]);

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...dataRows].map(row => row.map(escape).join(",")).join("\n");
  const filename = `${student.fullName.replace(/\s+/g, "_")}_logbook.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// ─── Log a supervised session ─────────────────────────────────────────────────
// Parents / guardians / mentors use this to log hours driven under their
// supervision. These sessions are tagged performedByRole='supervised' so they
// never influence the instructor-only lesson plan.

const gpsCoordinateSchema = z.object({ lat: z.number(), lng: z.number(), ts: z.number() });

const supervisedSessionBody = z.object({
  lessonDate: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(480),
  pedalOperator: z.enum(["student", "instructor", "shared"]).default("student"),
  weatherCondition: z.enum(["clear", "partly_cloudy", "overcast", "light_rain", "heavy_rain", "foggy", "windy"]).optional().nullable(),
  lightingCondition: z.enum(["daylight", "dawn", "dusk", "night"]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Anti-fraud GPS evidence — captured by mobile app at session start and end
  startCoordinates: gpsCoordinateSchema.optional().nullable(),
  endCoordinates: gpsCoordinateSchema.optional().nullable(),
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
  const { lessonDate, durationMinutes, pedalOperator, weatherCondition, lightingCondition, notes, startCoordinates, endCoordinates } = parsed.data;

  // Duplicate-submission guard: reject if the same viewer already logged a session
  // with the same studentId + lessonDate + durationMinutes within the last 60 seconds.
  const sixtySecondsAgo = new Date(Date.now() - 60_000);
  const [recentDuplicate] = await db
    .select({ id: assessmentsTable.id, createdAt: assessmentsTable.createdAt })
    .from(assessmentsTable)
    .innerJoin(instructorsTable, eq(assessmentsTable.instructorId, instructorsTable.id))
    .where(
      and(
        eq(assessmentsTable.studentId, studentId),
        eq(assessmentsTable.lessonDate, lessonDate),
        eq(assessmentsTable.durationMinutes, durationMinutes),
        eq(assessmentsTable.performedByRole, "supervised"),
        eq(instructorsTable.userId, user.id),
        gte(assessmentsTable.createdAt, sixtySecondsAgo),
      )
    )
    .limit(1);

  if (recentDuplicate) {
    logger.warn({ event: "duplicate_supervised_session_rejected", viewerUserId: user.id, studentId, lessonDate, durationMinutes });
    res.status(409).json({
      error: "duplicate_session",
      message: "A session with the same date and duration was just logged. Check the recent sessions list to confirm it was recorded before submitting again.",
    });
    return;
  }

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
    startCoordinates: startCoordinates ?? null,
    endCoordinates: endCoordinates ?? null,
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
    startCoordinates: a.startCoordinates ?? null,
    endCoordinates: a.endCoordinates ?? null,
    createdAt: a.createdAt,
  };
}

// ─── Update a supervised session ─────────────────────────────────────────────
// Only the viewer who created the session can update it.

router.patch("/viewer/students/:studentId/supervised-sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.studentId as string, 10);
  const sessionId = parseInt(req.params.sessionId as string, 10);

  // Verify viewer has an active link to this student
  const [link] = await db.select().from(viewerLinksTable).where(
    and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    )
  );
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  // Load the session and verify it belongs to this student and was created by this viewer's supervisor record
  let supervisorRecord = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!supervisorRecord) { res.status(403).json({ error: "You have not logged any sessions for this student" }); return; }

  const [session] = await db.select().from(assessmentsTable).where(
    and(
      eq(assessmentsTable.id, sessionId),
      eq(assessmentsTable.studentId, studentId),
      eq(assessmentsTable.instructorId, supervisorRecord.id),
      eq(assessmentsTable.performedByRole as any, "supervised"),
    )
  );
  if (!session) { res.status(404).json({ error: "Session not found or not editable by you" }); return; }

  const parsed = supervisedSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const { lessonDate, durationMinutes, pedalOperator, weatherCondition, lightingCondition, notes, startCoordinates, endCoordinates } = parsed.data;

  // Recalculate the hours delta
  const oldHours = session.durationMinutes / 60;
  const newHours = durationMinutes / 60;
  const delta = newHours - oldHours;

  const [updated] = await db.update(assessmentsTable).set({
    lessonDate,
    durationMinutes,
    pedalOperator,
    weatherCondition: weatherCondition ?? null,
    lightingCondition: lightingCondition ?? null,
    confidenceNote: notes ?? null,
    ...(startCoordinates !== undefined ? { startCoordinates: startCoordinates ?? null } : {}),
    ...(endCoordinates !== undefined ? { endCoordinates: endCoordinates ?? null } : {}),
  }).where(eq(assessmentsTable.id, sessionId)).returning();

  // Adjust the student's hours totals by the delta
  if (delta !== 0) {
    await db.execute(
      sql`UPDATE students SET total_hours = total_hours + ${delta}, supervised_hours = supervised_hours + ${delta} WHERE id = ${studentId}`
    );
  }

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "update_supervised_session",
    resourceType: "assessment",
    resourceId: sessionId,
    studentId,
  }, req);

  res.json({ ...formatSupervisedSession(updated), supervisorName: user.name ?? "Supervisor" });
});

// ─── Delete a supervised session ─────────────────────────────────────────────
// Only the viewer who created the session can delete it.

router.delete("/viewer/students/:studentId/supervised-sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const studentId = parseInt(req.params.studentId as string, 10);
  const sessionId = parseInt(req.params.sessionId as string, 10);

  // Verify viewer has an active link to this student
  const [link] = await db.select().from(viewerLinksTable).where(
    and(
      eq(viewerLinksTable.viewerUserId, user.id),
      eq(viewerLinksTable.studentId, studentId),
      eq(viewerLinksTable.linkStatus, "active"),
    )
  );
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  // Load the session and verify it belongs to this student and was created by this viewer's supervisor record
  let supervisorRecord = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!supervisorRecord) { res.status(404).json({ error: "Session not found" }); return; }

  const [session] = await db.select().from(assessmentsTable).where(
    and(
      eq(assessmentsTable.id, sessionId),
      eq(assessmentsTable.studentId, studentId),
      eq(assessmentsTable.instructorId, supervisorRecord.id),
      eq(assessmentsTable.performedByRole as any, "supervised"),
    )
  );
  if (!session) { res.status(404).json({ error: "Session not found or not deletable by you" }); return; }

  // Deduct the hours from the student's totals before deleting
  const hours = session.durationMinutes / 60;
  await db.execute(
    sql`UPDATE students SET total_hours = total_hours - ${hours}, supervised_hours = supervised_hours - ${hours} WHERE id = ${studentId}`
  );

  await db.delete(assessmentsTable).where(eq(assessmentsTable.id, sessionId));

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "delete_supervised_session",
    resourceType: "assessment",
    resourceId: sessionId,
    studentId,
  }, req);

  res.json({ ok: true });
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

  // Fetch instructor name
  const [instructor] = await db.select({ fullName: instructorsTable.fullName })
    .from(instructorsTable).where(eq(instructorsTable.id, assessment.instructorId));

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
      instructorName: instructor?.fullName ?? null,
    },
    maneuverResults: results,
  });
});

export default router;
