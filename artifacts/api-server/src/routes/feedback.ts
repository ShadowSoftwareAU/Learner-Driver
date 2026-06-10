import { Router } from "express";
import { eq, desc, and, avg, count, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sessionFeedbackTable,
  assessmentsTable,
  studentsTable,
  instructorsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

const submitFeedbackBody = z.object({
  overallRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  safetyFocusRating: z.number().int().min(1).max(5),
  lessonQualityRating: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean(),
  comments: z.string().max(2000).optional(),
});

// ─── Student submits feedback ─────────────────────────────────────────────────

router.post("/assessments/:id/feedback", requireAuth, async (req: any, res): Promise<void> => {
  const assessmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
  if (!a) { res.status(404).json({ error: "Assessment not found" }); return; }
  if (a.status !== "completed") { res.status(400).json({ error: "Assessment is not completed" }); return; }

  // Only the student from this assessment can submit feedback
  let studentDbId: number | null = null;
  if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || a.studentId !== student.id) {
      res.status(403).json({ error: "Access denied" }); return;
    }
    studentDbId = student.id;
  } else {
    res.status(403).json({ error: "Only students can submit feedback" }); return;
  }

  // Upsert — allow re-submission to update
  const existing = await db.select().from(sessionFeedbackTable)
    .where(eq(sessionFeedbackTable.assessmentId, assessmentId));

  const bodyParsed = submitFeedbackBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: bodyParsed.error.issues });
    return;
  }
  const data = bodyParsed.data;

  if (existing.length > 0) {
    const [updated] = await db.update(sessionFeedbackTable)
      .set({ ...data, submittedAt: new Date() })
      .where(eq(sessionFeedbackTable.id, existing[0].id))
      .returning();
    await logAudit({ actorId: user.id, actorRole: user.role, action: "update", resourceType: "session_feedback", resourceId: updated.id }, req);
    res.status(200).json(formatFeedback(updated));
    return;
  }

  const [created] = await db.insert(sessionFeedbackTable).values({
    assessmentId,
    studentId: studentDbId,
    instructorId: a.instructorId,
    schoolId: a.schoolId ?? null,
    ...data,
    submittedAt: new Date(),
  }).returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "create", resourceType: "session_feedback", resourceId: created.id }, req);
  res.status(201).json(formatFeedback(created));
});

// ─── Get feedback for an assessment ──────────────────────────────────────────

router.get("/assessments/:id/feedback", requireAuth, async (req: any, res): Promise<void> => {
  const assessmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
  if (!a) { res.status(404).json({ error: "Assessment not found" }); return; }

  // Instructor who taught it, admin, super_admin, or the student themselves
  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) {
      res.status(403).json({ error: "Access denied" }); return;
    }
  } else if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || a.studentId !== student.id) {
      res.status(403).json({ error: "Access denied" }); return;
    }
  } else if (!["admin", "school_admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const [fb] = await db.select().from(sessionFeedbackTable)
    .where(eq(sessionFeedbackTable.assessmentId, assessmentId));
  if (!fb) { res.status(404).json({ error: "No feedback submitted yet" }); return; }
  res.json(formatFeedback(fb));
});

// ─── Admin: list all feedback ─────────────────────────────────────────────────

router.get("/admin/feedback", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!["admin", "school_admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const instructorId = req.query.instructorId ? parseInt(req.query.instructorId as string, 10) : undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  const offset = parseInt(req.query.offset as string || "0", 10);

  let query = db
    .select({
      id: sessionFeedbackTable.id,
      assessmentId: sessionFeedbackTable.assessmentId,
      studentId: sessionFeedbackTable.studentId,
      instructorId: sessionFeedbackTable.instructorId,
      schoolId: sessionFeedbackTable.schoolId,
      overallRating: sessionFeedbackTable.overallRating,
      communicationRating: sessionFeedbackTable.communicationRating,
      safetyFocusRating: sessionFeedbackTable.safetyFocusRating,
      lessonQualityRating: sessionFeedbackTable.lessonQualityRating,
      wouldRecommend: sessionFeedbackTable.wouldRecommend,
      comments: sessionFeedbackTable.comments,
      submittedAt: sessionFeedbackTable.submittedAt,
      createdAt: sessionFeedbackTable.createdAt,
      studentName: studentsTable.fullName,
      instructorName: instructorsTable.fullName,
      lessonDate: assessmentsTable.lessonDate,
    })
    .from(sessionFeedbackTable)
    .leftJoin(studentsTable, eq(sessionFeedbackTable.studentId, studentsTable.id))
    .leftJoin(instructorsTable, eq(sessionFeedbackTable.instructorId, instructorsTable.id))
    .leftJoin(assessmentsTable, eq(sessionFeedbackTable.assessmentId, assessmentsTable.id))
    .orderBy(desc(sessionFeedbackTable.submittedAt))
    .limit(limit)
    .offset(offset)
    .$dynamic();

  if (user.role !== "super_admin" && user.schoolId) {
    query = query.where(eq(sessionFeedbackTable.schoolId, user.schoolId));
  }

  const rows = await query;

  // Count total
  const [{ total }] = await db.select({ total: count() }).from(sessionFeedbackTable);

  res.json({ items: rows, total: Number(total) });
});

// ─── Admin: aggregate summary per instructor ─────────────────────────────────

router.get("/admin/feedback/summary", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!["admin", "school_admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const rows = await db
    .select({
      instructorId: sessionFeedbackTable.instructorId,
      instructorName: instructorsTable.fullName,
      totalFeedback: count(),
      avgOverall: avg(sessionFeedbackTable.overallRating),
      avgCommunication: avg(sessionFeedbackTable.communicationRating),
      avgSafetyFocus: avg(sessionFeedbackTable.safetyFocusRating),
      avgLessonQuality: avg(sessionFeedbackTable.lessonQualityRating),
      recommendCount: sql<number>`sum(case when ${sessionFeedbackTable.wouldRecommend} then 1 else 0 end)`,
    })
    .from(sessionFeedbackTable)
    .leftJoin(instructorsTable, eq(sessionFeedbackTable.instructorId, instructorsTable.id))
    .groupBy(sessionFeedbackTable.instructorId, instructorsTable.fullName)
    .orderBy(desc(avg(sessionFeedbackTable.overallRating)));

  res.json(rows.map(r => ({
    instructorId: r.instructorId,
    instructorName: r.instructorName ?? null,
    totalFeedback: Number(r.totalFeedback),
    avgOverall: r.avgOverall ? parseFloat(Number(r.avgOverall).toFixed(1)) : null,
    avgCommunication: r.avgCommunication ? parseFloat(Number(r.avgCommunication).toFixed(1)) : null,
    avgSafetyFocus: r.avgSafetyFocus ? parseFloat(Number(r.avgSafetyFocus).toFixed(1)) : null,
    avgLessonQuality: r.avgLessonQuality ? parseFloat(Number(r.avgLessonQuality).toFixed(1)) : null,
    recommendRate: r.totalFeedback > 0
      ? Math.round((Number(r.recommendCount) / Number(r.totalFeedback)) * 100)
      : null,
  })));
});

function formatFeedback(fb: any) {
  return {
    id: fb.id,
    assessmentId: fb.assessmentId,
    studentId: fb.studentId,
    instructorId: fb.instructorId,
    schoolId: fb.schoolId ?? null,
    overallRating: fb.overallRating ?? null,
    communicationRating: fb.communicationRating ?? null,
    safetyFocusRating: fb.safetyFocusRating ?? null,
    lessonQualityRating: fb.lessonQualityRating ?? null,
    wouldRecommend: fb.wouldRecommend ?? null,
    comments: fb.comments ?? null,
    submittedAt: fb.submittedAt ?? null,
    createdAt: fb.createdAt,
    studentName: fb.studentName ?? null,
    instructorName: fb.instructorName ?? null,
    lessonDate: fb.lessonDate ?? null,
  };
}

export default router;
