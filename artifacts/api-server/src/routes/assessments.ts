import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, assessmentsTable, maneuverResultsTable, maneuversTable, studentsTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

router.get("/assessments", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = req.query.studentId ? parseInt(req.query.studentId as string, 10) : undefined;
  const user = await getOrCreateUser(req.clerkUserId, "");

  let rows;

  if (user.role === "admin") {
    rows = await db.select().from(assessmentsTable).orderBy(desc(assessmentsTable.lessonDate));
    if (studentId) rows = rows.filter(r => r.studentId === studentId);
  } else if (user.role === "instructor") {
    // Always scope to this instructor's own assessments
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor) { res.json([]); return; }

    const conditions = [eq(assessmentsTable.instructorId, instructor.id)];
    if (studentId) {
      // Extra safety: also filter by studentId if provided
      rows = await db.select().from(assessmentsTable)
        .where(and(eq(assessmentsTable.instructorId, instructor.id), eq(assessmentsTable.studentId, studentId)))
        .orderBy(desc(assessmentsTable.lessonDate));
    } else {
      rows = await db.select().from(assessmentsTable)
        .where(eq(assessmentsTable.instructorId, instructor.id))
        .orderBy(desc(assessmentsTable.lessonDate));
    }
  } else {
    // Student: only their own assessments
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student) { res.json([]); return; }
    rows = await db.select().from(assessmentsTable)
      .where(eq(assessmentsTable.studentId, student.id))
      .orderBy(desc(assessmentsTable.lessonDate));
  }

  const enriched = await Promise.all(rows.map(async (a) => {
    const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, a.studentId));
    const [instructor] = await db.select({ fullName: instructorsTable.fullName }).from(instructorsTable).where(eq(instructorsTable.id, a.instructorId));
    return { ...formatAssessment(a), studentName: student?.fullName ?? null, instructorName: instructor?.fullName ?? null };
  }));
  res.json(enriched);
});

router.post("/assessments", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { studentId, lessonDate, durationMinutes, confidenceNote, focusAreasNext } = req.body;
  if (!studentId || !lessonDate || !durationMinutes) { res.status(400).json({ error: "studentId, lessonDate, durationMinutes required" }); return; }

  // Find or create instructor record for this user
  let instructor = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const [a] = await db.insert(assessmentsTable).values({
    studentId, instructorId: instructor.id, lessonDate, durationMinutes,
    confidenceNote: confidenceNote ?? null, focusAreasNext: focusAreasNext ?? null, status: "in_progress"
  }).returning();

  // Update total hours on student
  const hours = durationMinutes / 60;
  await db.execute(sql`UPDATE students SET total_hours = total_hours + ${hours} WHERE id = ${studentId}`);

  await logAudit({ actorId: user.id, action: "create_assessment", resourceType: "assessment", resourceId: a.id, studentId: a.studentId });
  res.status(201).json(formatAssessment(a));
});

router.get("/assessments/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || a.studentId !== student.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const results = await db.select({
    id: maneuverResultsTable.id, assessmentId: maneuverResultsTable.assessmentId,
    maneuverId: maneuverResultsTable.maneuverId, competencyLevel: maneuverResultsTable.competencyLevel,
    notes: maneuverResultsTable.notes, maneuverName: maneuversTable.name, category: maneuversTable.category,
  }).from(maneuverResultsTable).leftJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
    .where(eq(maneuverResultsTable.assessmentId, id));

  const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, a.studentId));
  const [instructor] = await db.select({ fullName: instructorsTable.fullName }).from(instructorsTable).where(eq(instructorsTable.id, a.instructorId));

  await logAudit({ actorId: user.id, action: "view_assessment", resourceType: "assessment", resourceId: id, studentId: a.studentId });

  res.json({
    ...formatAssessment(a),
    studentName: student?.fullName ?? null,
    instructorName: instructor?.fullName ?? null,
    maneuverResults: results,
  });
});

router.patch("/assessments/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select({ instructorId: assessmentsTable.instructorId }).from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const { confidenceNote, focusAreasNext, status, durationMinutes } = req.body;
  const updates: any = {};
  if (confidenceNote !== undefined) updates.confidenceNote = confidenceNote;
  if (focusAreasNext !== undefined) updates.focusAreasNext = focusAreasNext;
  if (status) updates.status = status;
  if (durationMinutes) updates.durationMinutes = durationMinutes;
  const [updated] = await db.update(assessmentsTable).set(updates).where(eq(assessmentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAssessment(updated));
});

router.post("/assessments/:id/results", requireAuth, async (req: any, res): Promise<void> => {
  const assessmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { results } = req.body;
  if (!Array.isArray(results)) { res.status(400).json({ error: "results array required" }); return; }

  if (user.role === "instructor") {
    const [assessment] = await db.select({ instructorId: assessmentsTable.instructorId }).from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!assessment || !instructor || assessment.instructorId !== instructor.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const saved = [];
  for (const r of results) {
    const existing = await db.select().from(maneuverResultsTable)
      .where(and(eq(maneuverResultsTable.assessmentId, assessmentId), eq(maneuverResultsTable.maneuverId, r.maneuverId)));
    if (existing.length > 0) {
      const [updated] = await db.update(maneuverResultsTable).set({ competencyLevel: r.competencyLevel, notes: r.notes ?? null }).where(eq(maneuverResultsTable.id, existing[0].id)).returning();
      saved.push(updated);
    } else {
      const [created] = await db.insert(maneuverResultsTable).values({ assessmentId, maneuverId: r.maneuverId, competencyLevel: r.competencyLevel, notes: r.notes ?? null }).returning();
      saved.push(created);
    }
  }
  await logAudit({ actorId: user.id, action: "save_maneuver_results", resourceType: "assessment", resourceId: assessmentId });
  res.json(saved);
});

function formatAssessment(a: any) {
  return { id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: null, instructorName: null, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt };
}

export default router;
