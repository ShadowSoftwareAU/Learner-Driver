import { Router } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, studentsTable, handoverNotesTable, assessmentsTable, maneuverResultsTable, maneuversTable, instructorsTable, bookingsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";
import { canViewPrivateInstructorNotes, canViewRestrictedMedicalData } from "../lib/authz";
import { scanContent } from "../lib/contentFiltering/scanContent";
import { decrypt } from "../lib/crypto";

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

router.get("/handover/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor) { res.status(403).json({ error: "Instructor record not found" }); return; }
    if (!(await instructorHasStudent(instructor.id, studentId))) {
      res.status(403).json({ error: "Access denied" }); return;
    }
  }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const assessments = await db.select().from(assessmentsTable)
    .where(eq(assessmentsTable.studentId, studentId))
    .orderBy(desc(assessmentsTable.lessonDate));

  const assessmentIds = assessments.map(a => a.id);
  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);
  let allResults: any[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db.select().from(maneuverResultsTable)
      .where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);
  }

  const bestLevel: Record<number, string> = {};
  const levelOrder = ["not_attempted", "attempted", "practiced", "mastered"];
  for (const r of allResults) {
    const cur = bestLevel[r.maneuverId];
    if (!cur || levelOrder.indexOf(r.competencyLevel) > levelOrder.indexOf(cur)) {
      bestLevel[r.maneuverId] = r.competencyLevel;
    }
  }

  const categories = [...new Set(allManeuvers.map(m => m.category))];
  const skillBreakdown = categories.map(cat => {
    const catManeuvers = allManeuvers.filter(m => m.category === cat);
    return {
      category: cat,
      total: catManeuvers.length,
      mastered: catManeuvers.filter(m => bestLevel[m.id] === "mastered").length,
      practicing: catManeuvers.filter(m => bestLevel[m.id] === "practiced" || bestLevel[m.id] === "attempted").length,
      notStarted: catManeuvers.filter(m => !bestLevel[m.id] || bestLevel[m.id] === "not_attempted").length,
    };
  });

  // Only include notes visible to the caller
  const showPrivateNotes = canViewPrivateInstructorNotes(user);

  const notesQuery = await db.select({
    id: handoverNotesTable.id,
    studentId: handoverNotesTable.studentId,
    instructorId: handoverNotesTable.instructorId,
    note: handoverNotesTable.note,
    focusAreas: handoverNotesTable.focusAreas,
    isSafetyCritical: handoverNotesTable.isSafetyCritical,
    contentStatus: handoverNotesTable.contentStatus,
    createdAt: handoverNotesTable.createdAt,
    instructorName: instructorsTable.fullName,
  }).from(handoverNotesTable)
    .leftJoin(instructorsTable, eq(handoverNotesTable.instructorId, instructorsTable.id))
    .where(eq(handoverNotesTable.studentId, studentId))
    .orderBy(desc(handoverNotesTable.createdAt));

  // Filter out quarantined notes from non-admin viewers
  const notes = showPrivateNotes
    ? notesQuery
    : notesQuery.filter(n => n.contentStatus !== "quarantined");

  // Latest pedal operator from most recent assessment
  const latestAssessment = assessments[0];
  const latestPedalOperator = latestAssessment?.pedalOperator ?? null;

  // Medical info — decrypt only for authorised roles
  const canSeeMedical = canViewRestrictedMedicalData(user);
  let medicalConditions: string | null = null;
  let allergies: string | null = null;
  if (canSeeMedical) {
    if (student.medicalConditionsEncrypted) medicalConditions = decrypt(student.medicalConditionsEncrypted);
    if (student.allergiesEncrypted) allergies = decrypt(student.allergiesEncrypted);
  }

  // Safety-critical notes for the briefing card
  const safetyCriticalNotes = notes.filter(n => n.isSafetyCritical);

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "view_handover",
    resourceType: "student",
    resourceId: studentId,
    studentId,
    result: "success",
  }, req);

  // Enrich recent assessments with instructor names and maneuver note summaries
  const recentFive = assessments.slice(0, 5);
  const recentInstructorIds = [...new Set(recentFive.map(a => a.instructorId))];
  const recentInstructors = recentInstructorIds.length > 0
    ? await db.select({ id: instructorsTable.id, fullName: instructorsTable.fullName }).from(instructorsTable)
        .where(sql`${instructorsTable.id} = ANY(${sql.raw(`ARRAY[${recentInstructorIds.join(",")}]::integer[]`)})`)
    : [];
  const instructorNameMap: Record<number, string> = {};
  for (const i of recentInstructors) instructorNameMap[i.id] = i.fullName;

  const recentAssessments = await Promise.all(recentFive.map(async (a) => {
    // Collect maneuver notes for this assessment
    const mNotes = allResults
      .filter(r => r.assessmentId === a.id && r.notes)
      .map(r => r.notes as string);
    return {
      id: a.id, studentId: a.studentId, instructorId: a.instructorId,
      studentName: null, instructorName: instructorNameMap[a.instructorId] ?? null,
      lessonDate: a.lessonDate, durationMinutes: a.durationMinutes,
      status: a.status, pedalOperator: a.pedalOperator ?? "student",
      confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext,
      maneuverNoteSummary: mNotes.length > 0 ? mNotes.join(" | ") : null,
      preLessonBriefingAcknowledgedAt: a.preLessonBriefingAcknowledgedAt ?? null,
      createdAt: a.createdAt,
    };
  }));

  // Expose the logged-in instructor's own ID so the frontend can determine ownership
  let currentInstructorId: number | null = null;
  if (user.role === "instructor") {
    const [selfInstructor] = await db.select({ id: instructorsTable.id }).from(instructorsTable)
      .where(eq(instructorsTable.userId, user.id));
    currentInstructorId = selfInstructor?.id ?? null;
  }

  res.json({
    student: formatStudent(student, canSeeMedical, medicalConditions, allergies),
    totalHours: student.totalHours,
    completedManeuvers: Object.values(bestLevel).filter(l => l === "mastered").length,
    totalManeuvers: allManeuvers.length,
    skillBreakdown,
    notes,
    recentAssessments,
    currentInstructorId,
    // Pre-lesson briefing payload
    safetyBriefing: {
      pedalOperator: latestPedalOperator,
      safetyCriticalNotes,
      medicalConditionsPreview: student.medicalConditionsPreview ?? null,
      allergiesPreview: student.allergiesPreview ?? null,
      // Full data only for authorised roles
      medicalConditions: canSeeMedical ? medicalConditions : null,
      allergies: canSeeMedical ? allergies : null,
      latestFocusAreas: latestAssessment?.focusAreasNext ?? null,
    },
  });
});

router.post("/handover/:studentId/notes", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { note, focusAreas, isSafetyCritical } = req.body;
  if (!note) { res.status(400).json({ error: "note required" }); return; }

  let instructor = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  if (!(await instructorHasStudent(instructor.id, studentId))) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  // Scan note content before saving
  const scan = await scanContent({
    text: note + (focusAreas ? " " + focusAreas : ""),
    contentType: "handover_note",
    actorUserId: user.id,
    studentId,
    route: req.originalUrl,
  });

  if (scan.shouldBlock) {
    res.status(451).json({ error: "Content blocked by moderation policy", moderationCaseId: scan.moderationCaseId });
    return;
  }

  const [created] = await db.insert(handoverNotesTable).values({
    studentId,
    instructorId: instructor.id,
    note,
    focusAreas: focusAreas ?? null,
    isSafetyCritical: isSafetyCritical === true,
    contentStatus: scan.contentStatus,
    moderationCaseId: scan.moderationCaseId ?? null,
  }).returning();

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "add_handover_note",
    resourceType: "handover_note",
    resourceId: created.id,
    studentId,
    result: scan.contentStatus === "approved" ? "success" : "flagged",
  }, req);

  res.status(201).json({ ...created, instructorName: instructor.fullName });
});

function formatStudent(s: any, canSeeMedical: boolean, medicalConditions: string | null, allergies: string | null) {
  return {
    id: s.id, userId: s.userId, fullName: s.fullName, email: s.email,
    phone: s.phone, dateOfBirth: s.dateOfBirth,
    guardianName: s.guardianName, guardianPhone: s.guardianPhone,
    licenseNumber: s.licenseNumber, totalHours: s.totalHours, status: s.status,
    medicalConditionsPreview: s.medicalConditionsPreview ?? null,
    allergiesPreview: s.allergiesPreview ?? null,
    medicalConditions: canSeeMedical ? medicalConditions : null,
    allergies: canSeeMedical ? allergies : null,
    noShowCount: s.noShowCount ?? 0,
    attendanceReliabilityScore: s.attendanceReliabilityScore ?? null,
    createdAt: s.createdAt,
  };
}

export default router;
