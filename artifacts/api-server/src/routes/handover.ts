import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, studentsTable, handoverNotesTable, assessmentsTable, maneuverResultsTable, maneuversTable, instructorsTable, usersTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

router.get("/handover/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.studentId, studentId)).orderBy(desc(assessmentsTable.lessonDate));
  const assessmentIds = assessments.map(a => a.id);

  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);
  let allResults: any[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db.select().from(maneuverResultsTable).where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);
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
    const mastered = catManeuvers.filter(m => bestLevel[m.id] === "mastered").length;
    const practicing = catManeuvers.filter(m => bestLevel[m.id] === "practiced" || bestLevel[m.id] === "attempted").length;
    const notStarted = catManeuvers.filter(m => !bestLevel[m.id] || bestLevel[m.id] === "not_attempted").length;
    return { category: cat, total: catManeuvers.length, mastered, practicing, notStarted };
  });

  const notes = await db.select({
    id: handoverNotesTable.id, studentId: handoverNotesTable.studentId, instructorId: handoverNotesTable.instructorId,
    note: handoverNotesTable.note, focusAreas: handoverNotesTable.focusAreas, createdAt: handoverNotesTable.createdAt,
    instructorName: instructorsTable.fullName,
  }).from(handoverNotesTable)
    .leftJoin(instructorsTable, eq(handoverNotesTable.instructorId, instructorsTable.id))
    .where(eq(handoverNotesTable.studentId, studentId)).orderBy(desc(handoverNotesTable.createdAt));

  await logAudit({ actorId: user.id, action: "view_handover", resourceType: "student", resourceId: studentId, studentId });

  res.json({
    student: formatStudent(student),
    totalHours: student.totalHours,
    completedManeuvers: Object.values(bestLevel).filter(l => l === "mastered").length,
    totalManeuvers: allManeuvers.length,
    skillBreakdown,
    notes,
    recentAssessments: assessments.slice(0, 5).map(a => ({ id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: null, instructorName: null, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt })),
  });
});

router.post("/handover/:studentId/notes", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { note, focusAreas } = req.body;
  if (!note) { res.status(400).json({ error: "note required" }); return; }

  let instructor = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const [created] = await db.insert(handoverNotesTable).values({ studentId, instructorId: instructor.id, note, focusAreas: focusAreas ?? null }).returning();
  await logAudit({ actorId: user.id, action: "add_handover_note", resourceType: "handover_note", resourceId: created.id, studentId });
  res.status(201).json({ ...created, instructorName: instructor.fullName });
});

function formatStudent(s: any) {
  return { id: s.id, userId: s.userId, fullName: s.fullName, email: s.email, phone: s.phone, dateOfBirth: s.dateOfBirth, guardianName: s.guardianName, guardianPhone: s.guardianPhone, licenseNumber: s.licenseNumber, totalHours: s.totalHours, status: s.status, createdAt: s.createdAt };
}

export default router;
