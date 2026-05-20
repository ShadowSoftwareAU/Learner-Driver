import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, intakeTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

router.get("/intake/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const [row] = await db.select().from(intakeTable).where(eq(intakeTable.studentId, studentId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/intake/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const { priorExperience, previousLessons, previousInstructorFeedback, medicalConditions, learningGoals, preferredLessonTime, emergencyContact, emergencyPhone } = req.body;

  const existing = await db.select().from(intakeTable).where(eq(intakeTable.studentId, studentId));
  const data: any = { studentId, priorExperience: priorExperience ?? null, previousLessons: previousLessons ?? null, previousInstructorFeedback: previousInstructorFeedback ?? null, medicalConditions: medicalConditions ?? null, learningGoals: learningGoals ?? null, preferredLessonTime: preferredLessonTime ?? null, emergencyContact: emergencyContact ?? null, emergencyPhone: emergencyPhone ?? null, completedAt: new Date() };

  let row;
  if (existing.length > 0) {
    [row] = await db.update(intakeTable).set(data).where(eq(intakeTable.studentId, studentId)).returning();
  } else {
    [row] = await db.insert(intakeTable).values(data).returning();
  }
  res.json(row);
});

export default router;
