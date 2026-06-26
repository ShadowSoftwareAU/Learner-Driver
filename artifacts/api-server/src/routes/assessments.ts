import { Router } from "express";
import { eq, desc, and, sql, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, assessmentsTable, maneuverResultsTable, maneuversTable, studentsTable, instructorsTable, sessionFeedbackTable, usersTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";
import { scanContent } from "../lib/contentFiltering/scanContent";
import { sendNotification } from "../lib/notifications/notificationService";

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const routePointSchema = z.object({ lat: z.number(), lng: z.number(), ts: z.number() });

const createAssessmentBody = z.object({
  studentId: z.number().int().positive(),
  lessonDate: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(480),
  assessmentType: z.enum(["qsafe", "qride", "heavy_vehicle"]).default("qsafe"),
  pedalOperator: z.enum(["student", "instructor", "shared"]),
  confidenceNote: z.string().max(5000).optional(),
  focusAreasNext: z.string().max(2000).optional(),
  routePath: z.array(routePointSchema).optional().nullable(),
});

const patchAssessmentBody = z.object({
  confidenceNote: z.string().max(5000).optional(),
  focusAreasNext: z.string().max(2000).optional(),
  status: z.enum(["in_progress", "completed", "no_show"]).optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  routePath: z.array(routePointSchema).optional().nullable(),
  pedalOperator: z.enum(["student", "instructor", "shared"]).optional(),
  acknowledgeBriefing: z.boolean().optional(),
});

const maneuverResultItemSchema = z.object({
  maneuverId: z.number().int().positive(),
  competencyLevel: z.enum(["not_attempted", "attempted", "practiced", "mastered"]),
  notes: z.string().max(2000).optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

// ─── List ─────────────────────────────────────────────────────────────────────

router.get("/assessments", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = req.query.studentId ? parseInt(req.query.studentId as string, 10) : undefined;
  const user = await getOrCreateUser(req.clerkUserId, "");

  let rows;

  if (user.role === "admin" || user.role === "school_admin" || user.role === "super_admin") {
    rows = await db.select().from(assessmentsTable).orderBy(desc(assessmentsTable.lessonDate));
    if (studentId) rows = rows.filter(r => r.studentId === studentId);
  } else if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor) { res.json([]); return; }

    if (studentId) {
      rows = await db.select().from(assessmentsTable)
        .where(and(eq(assessmentsTable.instructorId, instructor.id), eq(assessmentsTable.studentId, studentId)))
        .orderBy(desc(assessmentsTable.lessonDate));
    } else {
      rows = await db.select().from(assessmentsTable)
        .where(eq(assessmentsTable.instructorId, instructor.id))
        .orderBy(desc(assessmentsTable.lessonDate));
    }
  } else {
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

// ─── Create ───────────────────────────────────────────────────────────────────

router.post("/assessments", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  const parsed = createAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const { studentId, lessonDate, durationMinutes, assessmentType, confidenceNote, focusAreasNext, routePath, pedalOperator } = parsed.data;

  let instructor = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  // Scan free-text fields before saving
  const textsToScan = [confidenceNote, focusAreasNext].filter(Boolean).join(" ");
  if (textsToScan) {
    const scan = await scanContent({
      text: textsToScan,
      contentType: "assessment_note",
      actorUserId: user.id,
      studentId,
      route: req.originalUrl,
    });
    if (scan.shouldBlock) {
      res.status(451).json({ error: "Content blocked by moderation policy", moderationCaseId: scan.moderationCaseId });
      return;
    }
  }

  const [a] = await db.insert(assessmentsTable).values({
    studentId, instructorId: instructor.id,
    lessonDate, durationMinutes,
    assessmentType: assessmentType ?? "qsafe",
    pedalOperator,
    confidenceNote: confidenceNote ?? null,
    focusAreasNext: focusAreasNext ?? null,
    routePath: routePath ?? null,
    status: "in_progress",
  }).returning();

  const hours = durationMinutes / 60;
  await db.execute(sql`UPDATE students SET total_hours = total_hours + ${hours} WHERE id = ${studentId}`);

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "create_assessment",
    resourceType: "assessment",
    resourceId: a.id,
    studentId: a.studentId,
  }, req);

  res.status(201).json(formatAssessment(a));
});

// IMPORTANT: heatmap route must come BEFORE /assessments/:id
router.get("/assessments/heatmap", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const maneuverId = req.query.maneuverId ? parseInt(req.query.maneuverId as string, 10) : undefined;

  if (user.role === "student") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const latNotNull = isNotNull(maneuverResultsTable.lat);
  const lngNotNull = isNotNull(maneuverResultsTable.lng);

  if (user.role === "admin" || user.role === "school_admin" || user.role === "super_admin") {
    const conditions: any[] = [latNotNull, lngNotNull];
    if (maneuverId) conditions.push(eq(maneuverResultsTable.maneuverId, maneuverId));
    const results = await db
      .select({ lat: maneuverResultsTable.lat, lng: maneuverResultsTable.lng, maneuverId: maneuverResultsTable.maneuverId, maneuverName: maneuversTable.name, competencyLevel: maneuverResultsTable.competencyLevel })
      .from(maneuverResultsTable)
      .leftJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
      .where(and(...conditions));
    res.json(results);
    return;
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.json([]); return; }

  const conditions: any[] = [latNotNull, lngNotNull, eq(assessmentsTable.instructorId, instructor.id)];
  if (maneuverId) conditions.push(eq(maneuverResultsTable.maneuverId, maneuverId));

  const results = await db
    .select({ lat: maneuverResultsTable.lat, lng: maneuverResultsTable.lng, maneuverId: maneuverResultsTable.maneuverId, maneuverName: maneuversTable.name, competencyLevel: maneuverResultsTable.competencyLevel })
    .from(maneuverResultsTable)
    .innerJoin(assessmentsTable, eq(maneuverResultsTable.assessmentId, assessmentsTable.id))
    .leftJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
    .where(and(...conditions));

  res.json(results);
});

// ─── Get one ──────────────────────────────────────────────────────────────────

router.get("/assessments/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || a.studentId !== student.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const results = await db.select({
    id: maneuverResultsTable.id, assessmentId: maneuverResultsTable.assessmentId,
    maneuverId: maneuverResultsTable.maneuverId, competencyLevel: maneuverResultsTable.competencyLevel,
    notes: maneuverResultsTable.notes, maneuverName: maneuversTable.name, category: maneuversTable.category,
    lat: maneuverResultsTable.lat, lng: maneuverResultsTable.lng,
  }).from(maneuverResultsTable).leftJoin(maneuversTable, eq(maneuverResultsTable.maneuverId, maneuversTable.id))
    .where(eq(maneuverResultsTable.assessmentId, id));

  const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, a.studentId));
  const [instructor] = await db.select({ fullName: instructorsTable.fullName }).from(instructorsTable).where(eq(instructorsTable.id, a.instructorId));

  await logAudit({ actorId: user.id, actorRole: user.role, action: "view_assessment", resourceType: "assessment", resourceId: id, studentId: a.studentId }, req);

  res.json({
    ...formatAssessment(a),
    studentName: student?.fullName ?? null,
    instructorName: instructor?.fullName ?? null,
    maneuverResults: results,
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────

router.patch("/assessments/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const bodyParsed = patchAssessmentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: bodyParsed.error.issues });
    return;
  }
  const { confidenceNote, focusAreasNext, status, durationMinutes, routePath, pedalOperator, acknowledgeBriefing } = bodyParsed.data;

  // Scan any updated free-text fields
  const textsToScan = [confidenceNote, focusAreasNext].filter(Boolean).join(" ");
  if (textsToScan) {
    const scan = await scanContent({
      text: textsToScan,
      contentType: "assessment_note",
      contentId: id,
      actorUserId: user.id,
      studentId: a.studentId,
      route: req.originalUrl,
    });
    if (scan.shouldBlock) {
      res.status(451).json({ error: "Content blocked by moderation policy", moderationCaseId: scan.moderationCaseId });
      return;
    }
  }

  const updates: any = {};
  if (confidenceNote !== undefined) updates.confidenceNote = confidenceNote;
  if (focusAreasNext !== undefined) updates.focusAreasNext = focusAreasNext;
  if (status) updates.status = status;
  if (durationMinutes) updates.durationMinutes = durationMinutes;
  if (routePath !== undefined) updates.routePath = routePath;
  if (pedalOperator && ["student", "instructor", "shared"].includes(pedalOperator)) {
    updates.pedalOperator = pedalOperator;
  }
  if (acknowledgeBriefing === true && !a.preLessonBriefingAcknowledgedAt) {
    updates.preLessonBriefingAcknowledgedAt = new Date();
    updates.preLessonBriefingAcknowledgedBy = user.id;
  }

  const [updated] = await db.update(assessmentsTable).set(updates).where(eq(assessmentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // When an assessment transitions to completed, send feedback request to student
  if (status === "completed" && a.status !== "completed") {
    sendNotification({
      userId: 0, // resolved below
      payload: {
        type: "feedback_request",
        title: "How did your lesson go?",
        body: "Your lesson has been marked as complete. Tap to share your feedback with your driving school.",
        relatedId: updated.id,
        relatedType: "assessment",
      },
    }).catch(() => null); // fire-and-forget non-fatally; real userId resolved below

    // Resolve student userId and send properly
    const [student] = await db.select({ userId: studentsTable.userId, email: studentsTable.email })
      .from(studentsTable).where(eq(studentsTable.id, updated.studentId));
    if (student?.userId) {
      const [studentUser] = await db.select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, student.userId));
      if (studentUser) {
        sendNotification({
          userId: studentUser.id,
          email: studentUser.email,
          payload: {
            type: "feedback_request",
            title: "How did your lesson go?",
            body: "Your lesson has been marked as complete. Tap to share your feedback — it helps your school improve.",
            relatedId: updated.id,
            relatedType: "assessment",
          },
        }).catch(() => null);
      }
    }
  }

  res.json(formatAssessment(updated));
});

// ─── Maneuver results ─────────────────────────────────────────────────────────

router.post("/assessments/:id/results", requireAuth, async (req: any, res): Promise<void> => {
  const assessmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const resultsParsed = z.object({ results: z.array(maneuverResultItemSchema) }).safeParse(req.body);
  if (!resultsParsed.success) {
    res.status(400).json({ error: "Invalid results data", issues: resultsParsed.error.issues });
    return;
  }
  const { results } = resultsParsed.data;

  if (user.role === "instructor") {
    const [assessment] = await db.select({ instructorId: assessmentsTable.instructorId }).from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!assessment || !instructor || assessment.instructorId !== instructor.id) {
      res.status(403).json({ error: "Access denied" }); return;
    }
  }

  const saved = [];
  for (const r of results) {
    // Scan per-maneuver notes
    if (r.notes) {
      const scan = await scanContent({
        text: r.notes,
        contentType: "assessment_note",
        contentId: assessmentId,
        actorUserId: user.id,
        route: req.originalUrl,
      });
      if (scan.shouldBlock) continue; // skip quarantined result note but don't fail whole batch
    }

    const existing = await db.select().from(maneuverResultsTable)
      .where(and(eq(maneuverResultsTable.assessmentId, assessmentId), eq(maneuverResultsTable.maneuverId, r.maneuverId)));
    const lat = (r.lat != null && isFinite(r.lat)) ? r.lat : null;
    const lng = (r.lng != null && isFinite(r.lng)) ? r.lng : null;
    if (existing.length > 0) {
      const [updated] = await db.update(maneuverResultsTable)
        .set({ competencyLevel: r.competencyLevel, notes: r.notes ?? null, lat, lng })
        .where(eq(maneuverResultsTable.id, existing[0].id)).returning();
      saved.push(updated);
    } else {
      const [created] = await db.insert(maneuverResultsTable)
        .values({ assessmentId, maneuverId: r.maneuverId, competencyLevel: r.competencyLevel, notes: r.notes ?? null, lat, lng })
        .returning();
      saved.push(created);
    }
  }
  await logAudit({ actorId: user.id, actorRole: user.role, action: "save_maneuver_results", resourceType: "assessment", resourceId: assessmentId }, req);
  res.json(saved);
});

// ─── Submit for approval ──────────────────────────────────────────────────────

router.post("/assessments/:id/submit", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  if (a.finalizationStatus !== "draft") {
    res.status(409).json({ error: "Assessment has already been submitted or approved", finalizationStatus: a.finalizationStatus });
    return;
  }

  const [updated] = await db.update(assessmentsTable)
    .set({ finalizationStatus: "pending_approval", status: "completed" })
    .where(eq(assessmentsTable.id, id))
    .returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "submit_assessment", resourceType: "assessment", resourceId: id, studentId: a.studentId }, req);

  res.json(formatAssessment(updated));
});

// ─── Approve + dispatch ───────────────────────────────────────────────────────

router.post("/assessments/:id/approve", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [a] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || a.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  if (a.finalizationStatus !== "pending_approval") {
    res.status(409).json({ error: "Assessment must be in pending_approval state to approve", finalizationStatus: a.finalizationStatus });
    return;
  }

  const bodyParsed = z.object({
    dispatchEmails: z.array(z.string().email()).optional().default([]),
    notes: z.string().max(1000).optional(),
  }).safeParse(req.body);

  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: bodyParsed.error.issues });
    return;
  }

  const { dispatchEmails } = bodyParsed.data;
  const now = new Date();

  const [updated] = await db.update(assessmentsTable)
    .set({
      finalizationStatus: "dispatched",
      approvedAt: now,
      approvedByUserId: user.id,
      reportDispatchedAt: now,
      reportDispatchedTo: JSON.stringify(dispatchEmails),
    })
    .where(eq(assessmentsTable.id, id))
    .returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "approve_assessment", resourceType: "assessment", resourceId: id, studentId: a.studentId }, req);

  // Fire-and-forget notification to student
  const [student] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, a.studentId));
  if (student?.userId) {
    const [studentUser] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, student.userId));
    if (studentUser) {
      sendNotification({
        userId: studentUser.id,
        email: studentUser.email,
        payload: {
          type: "assessment_approved",
          title: "Your lesson report is ready",
          body: "Your instructor has approved your lesson report. Tap to view your progress.",
          relatedId: id,
          relatedType: "assessment",
        },
      }).catch(() => null);
    }
  }

  res.json(formatAssessment(updated));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAssessment(a: any) {
  return {
    id: a.id,
    studentId: a.studentId,
    instructorId: a.instructorId,
    studentName: null,
    instructorName: null,
    lessonDate: a.lessonDate,
    durationMinutes: a.durationMinutes,
    status: a.status,
    assessmentType: a.assessmentType ?? "qsafe",
    pedalOperator: a.pedalOperator ?? "student",
    confidenceNote: a.confidenceNote ?? null,
    focusAreasNext: a.focusAreasNext ?? null,
    routePath: a.routePath ?? null,
    preLessonBriefingAcknowledgedAt: a.preLessonBriefingAcknowledgedAt ?? null,
    finalizationStatus: a.finalizationStatus ?? "draft",
    approvedAt: a.approvedAt ?? null,
    approvedByUserId: a.approvedByUserId ?? null,
    reportDispatchedAt: a.reportDispatchedAt ?? null,
    reportDispatchedTo: a.reportDispatchedTo ?? null,
    createdAt: a.createdAt,
  };
}

export default router;
