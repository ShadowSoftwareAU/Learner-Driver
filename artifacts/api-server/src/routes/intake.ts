import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, intakeTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const intakeSchema = z.object({
  priorExperience: z.string().max(2000).optional().nullable(),
  previousLessons: z.number().int().min(0).max(9999).optional().nullable(),
  previousInstructorFeedback: z.string().max(5000).optional().nullable(),
  medicalConditions: z.string().max(2000).optional().nullable(),
  learningGoals: z.string().max(2000).optional().nullable(),
  preferredLessonTime: z.string().max(200).optional().nullable(),
  emergencyContact: z.string().max(200).optional().nullable(),
  emergencyPhone: z.string().max(50).optional().nullable(),
});

router.get("/intake/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);
  const [row] = await db.select().from(intakeTable).where(eq(intakeTable.studentId, studentId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/intake/:studentId", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId, 10);

  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid intake data", issues: parsed.error.issues });
    return;
  }

  const {
    priorExperience,
    previousLessons,
    previousInstructorFeedback,
    medicalConditions,
    learningGoals,
    preferredLessonTime,
    emergencyContact,
    emergencyPhone,
  } = parsed.data;

  const existing = await db.select().from(intakeTable).where(eq(intakeTable.studentId, studentId));
  const data = {
    studentId,
    priorExperience: priorExperience ?? null,
    previousLessons: previousLessons ?? null,
    previousInstructorFeedback: previousInstructorFeedback ?? null,
    medicalConditions: medicalConditions ?? null,
    learningGoals: learningGoals ?? null,
    preferredLessonTime: preferredLessonTime ?? null,
    emergencyContact: emergencyContact ?? null,
    emergencyPhone: emergencyPhone ?? null,
    completedAt: new Date(),
  };

  let row;
  if (existing.length > 0) {
    [row] = await db.update(intakeTable).set(data).where(eq(intakeTable.studentId, studentId)).returning();
  } else {
    [row] = await db.insert(intakeTable).values(data).returning();
  }
  res.json(row);
});

export default router;
