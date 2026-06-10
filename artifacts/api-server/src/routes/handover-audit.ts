import { Router } from "express";
import { eq, desc, and, count, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  handoverNotesTable,
  handoverNoteReviewsTable,
  studentsTable,
  instructorsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

const reviewBody = z.object({
  verdict: z.enum(["approved", "needs_improvement", "flagged"]),
  reviewComment: z.string().max(2000).optional(),
});

function isAdmin(role: string) {
  return ["admin", "school_admin", "super_admin"].includes(role);
}

// ─── List handover notes for audit ───────────────────────────────────────────

router.get("/admin/handover-notes", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isAdmin(user.role)) { res.status(403).json({ error: "Access denied" }); return; }

  const instructorId = req.query.instructorId ? parseInt(req.query.instructorId as string, 10) : undefined;
  const safetyCritical = req.query.safetyCritical === "true" ? true : req.query.safetyCritical === "false" ? false : undefined;
  const reviewStatus = req.query.reviewStatus as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  const offset = parseInt(req.query.offset as string || "0", 10);

  const allNotes = await db
    .select({
      id: handoverNotesTable.id,
      studentId: handoverNotesTable.studentId,
      instructorId: handoverNotesTable.instructorId,
      schoolId: handoverNotesTable.schoolId,
      note: handoverNotesTable.note,
      focusAreas: handoverNotesTable.focusAreas,
      isSafetyCritical: handoverNotesTable.isSafetyCritical,
      contentStatus: handoverNotesTable.contentStatus,
      createdAt: handoverNotesTable.createdAt,
      studentName: studentsTable.fullName,
      instructorName: instructorsTable.fullName,
      reviewId: handoverNoteReviewsTable.id,
      verdict: handoverNoteReviewsTable.verdict,
      reviewComment: handoverNoteReviewsTable.reviewComment,
      reviewedAt: handoverNoteReviewsTable.reviewedAt,
      reviewerUserId: handoverNoteReviewsTable.reviewerUserId,
    })
    .from(handoverNotesTable)
    .leftJoin(studentsTable, eq(handoverNotesTable.studentId, studentsTable.id))
    .leftJoin(instructorsTable, eq(handoverNotesTable.instructorId, instructorsTable.id))
    .leftJoin(handoverNoteReviewsTable, eq(handoverNoteReviewsTable.handoverNoteId, handoverNotesTable.id))
    .orderBy(desc(handoverNotesTable.createdAt));

  // Apply filters in-memory (simpler than dynamic drizzle where chains)
  let filtered = allNotes;

  if (user.role !== "super_admin" && user.schoolId) {
    filtered = filtered.filter(n => n.schoolId === user.schoolId);
  }
  if (instructorId) {
    filtered = filtered.filter(n => n.instructorId === instructorId);
  }
  if (safetyCritical !== undefined) {
    filtered = filtered.filter(n => n.isSafetyCritical === safetyCritical);
  }
  if (reviewStatus === "unreviewed") {
    filtered = filtered.filter(n => n.reviewId === null);
  } else if (reviewStatus && reviewStatus !== "unreviewed") {
    filtered = filtered.filter(n => n.verdict === reviewStatus);
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  await logAudit({ actorId: user.id, actorRole: user.role, action: "view", resourceType: "handover_note_audit", resourceId: 0 }, req);

  res.json({
    items: page.map(n => ({
      id: n.id,
      studentId: n.studentId,
      instructorId: n.instructorId,
      schoolId: n.schoolId ?? null,
      note: n.note,
      focusAreas: n.focusAreas ?? null,
      isSafetyCritical: n.isSafetyCritical,
      contentStatus: n.contentStatus,
      createdAt: n.createdAt,
      studentName: n.studentName ?? null,
      instructorName: n.instructorName ?? null,
      review: n.reviewId ? {
        id: n.reviewId,
        verdict: n.verdict,
        reviewComment: n.reviewComment ?? null,
        reviewedAt: n.reviewedAt,
        reviewerUserId: n.reviewerUserId,
      } : null,
    })),
    total,
  });
});

// ─── Submit / update a review ─────────────────────────────────────────────────

router.post("/admin/handover-notes/:id/review", requireAuth, async (req: any, res): Promise<void> => {
  const noteId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isAdmin(user.role)) { res.status(403).json({ error: "Access denied" }); return; }

  const [note] = await db.select().from(handoverNotesTable).where(eq(handoverNotesTable.id, noteId));
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }

  const bodyParsed = reviewBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: bodyParsed.error.issues });
    return;
  }
  const { verdict, reviewComment } = bodyParsed.data;

  // Upsert by noteId — one review record per note
  const [existing] = await db.select().from(handoverNoteReviewsTable)
    .where(eq(handoverNoteReviewsTable.handoverNoteId, noteId));

  let record;
  if (existing) {
    const [updated] = await db.update(handoverNoteReviewsTable)
      .set({ verdict, reviewComment: reviewComment ?? null, reviewerUserId: user.id, reviewedAt: new Date() })
      .where(eq(handoverNoteReviewsTable.id, existing.id))
      .returning();
    record = updated;
  } else {
    const [created] = await db.insert(handoverNoteReviewsTable).values({
      handoverNoteId: noteId,
      reviewerUserId: user.id,
      schoolId: note.schoolId ?? null,
      verdict,
      reviewComment: reviewComment ?? null,
    }).returning();
    record = created;
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "review", resourceType: "handover_note", resourceId: noteId }, req);
  res.json(record);
});

// ─── Get review for a note ────────────────────────────────────────────────────

router.get("/admin/handover-notes/:id/review", requireAuth, async (req: any, res): Promise<void> => {
  const noteId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isAdmin(user.role)) { res.status(403).json({ error: "Access denied" }); return; }

  const [review] = await db.select().from(handoverNoteReviewsTable)
    .where(eq(handoverNoteReviewsTable.handoverNoteId, noteId));
  if (!review) { res.status(404).json({ error: "Not reviewed yet" }); return; }
  res.json(review);
});

export default router;
