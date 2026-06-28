import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, lte, and, isNotNull } from "drizzle-orm";
import {
  db,
  usersTable,
  instructorsTable,
  instructorVerificationsTable,
  verificationDocumentsTable,
} from "@workspace/db";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
}

async function getDbUser(clerkId: string) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
}

async function getInstructorByUser(userId: number) {
  const rows = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, userId)).limit(1);
  return rows[0] ?? null;
}

async function getVerificationWithDocs(verificationId: number) {
  const docs = await db
    .select()
    .from(verificationDocumentsTable)
    .where(eq(verificationDocumentsTable.verificationId, verificationId));
  return docs;
}

// ──────────────────────────────────────────────────────────
// INSTRUCTOR endpoints
// ──────────────────────────────────────────────────────────

/**
 * GET /instructor/verification/status
 * Returns the instructor's current verification record + documents.
 */
router.get("/instructor/verification/status", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getDbUser(req.clerkUserId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const instructor = await getInstructorByUser(user.id);
  if (!instructor) { res.status(404).json({ error: "Instructor profile not found" }); return; }

  const rows = await db
    .select()
    .from(instructorVerificationsTable)
    .where(eq(instructorVerificationsTable.instructorId, instructor.id))
    .orderBy(desc(instructorVerificationsTable.createdAt))
    .limit(1);

  if (rows.length === 0) {
    res.json({ status: "not_submitted", verification: null, documents: [] });
    return;
  }

  const verification = rows[0];
  const documents = await getVerificationWithDocs(verification.id);
  res.json({ status: verification.status, verification, documents });
});

/**
 * POST /instructor/verification/submit
 * Creates a new verification application (or resubmits after needs_revision).
 * Body: { documentIds: number[] } — IDs of already-uploaded documents
 */
router.post("/instructor/verification/submit", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getDbUser(req.clerkUserId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const instructor = await getInstructorByUser(user.id);
  if (!instructor) { res.status(404).json({ error: "Instructor profile not found" }); return; }

  const existing = await db
    .select()
    .from(instructorVerificationsTable)
    .where(eq(instructorVerificationsTable.instructorId, instructor.id))
    .orderBy(desc(instructorVerificationsTable.createdAt))
    .limit(1);

  if (existing.length > 0 && ["pending", "approved"].includes(existing[0].status)) {
    res.status(409).json({ error: "Active application already exists", status: existing[0].status });
    return;
  }

  const { documents, state } = req.body as {
    documents: Array<{ docType: string; fileName: string; fileSize?: number; objectPath: string; expiresAt?: string }>;
    state?: string;
  };
  if (!Array.isArray(documents) || documents.length === 0) {
    res.status(400).json({ error: "At least one document is required" });
    return;
  }

  // Persist instructor state if provided
  if (state) {
    await db.update(instructorsTable)
      .set({ state })
      .where(eq(instructorsTable.id, instructor.id));
  }

  const [verification] = await db
    .insert(instructorVerificationsTable)
    .values({
      instructorId: instructor.id,
      status: "pending",
      submittedAt: new Date(),
    })
    .returning();

  const docRows = await db
    .insert(verificationDocumentsTable)
    .values(
      documents.map((d) => ({
        verificationId: verification.id,
        docType: d.docType,
        fileName: d.fileName,
        fileSize: d.fileSize ?? null,
        objectPath: d.objectPath,
        expiresAt: d.expiresAt ?? null,
      }))
    )
    .returning();

  req.log.info({ verificationId: verification.id, state }, "Verification application submitted");
  res.status(201).json({ verification, documents: docRows });
});

// ──────────────────────────────────────────────────────────
// ADMIN endpoints
// ──────────────────────────────────────────────────────────

async function requireAdmin(req: any, res: any, next: any) {
  const user = await getDbUser(req.clerkUserId);
  if (!user || !["admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  req.dbUser = user;
  next();
}

/**
 * GET /admin/verifications
 * Lists all verification applications with instructor info.
 */
router.get("/admin/verifications", requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const verifications = await db
    .select({
      id: instructorVerificationsTable.id,
      status: instructorVerificationsTable.status,
      submittedAt: instructorVerificationsTable.submittedAt,
      reviewedAt: instructorVerificationsTable.reviewedAt,
      reviewerNotes: instructorVerificationsTable.reviewerNotes,
      createdAt: instructorVerificationsTable.createdAt,
      instructorId: instructorVerificationsTable.instructorId,
      instructorName: instructorsTable.fullName,
      instructorEmail: instructorsTable.email,
    })
    .from(instructorVerificationsTable)
    .innerJoin(instructorsTable, eq(instructorVerificationsTable.instructorId, instructorsTable.id))
    .orderBy(desc(instructorVerificationsTable.createdAt));

  const withDocs = await Promise.all(
    verifications.map(async (v) => ({
      ...v,
      documents: await getVerificationWithDocs(v.id),
    }))
  );

  res.json(withDocs);
});

/**
 * PATCH /admin/verifications/:id
 * Approve, reject, or request revision on an application.
 * Body: { action: "approved" | "rejected" | "needs_revision", notes?: string }
 */
router.patch("/admin/verifications/:id", requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const verificationId = parseInt(req.params.id, 10);
  const { action, notes } = req.body as { action: string; notes?: string };

  if (!["approved", "rejected", "needs_revision"].includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  const existing = await db
    .select()
    .from(instructorVerificationsTable)
    .where(eq(instructorVerificationsTable.id, verificationId))
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ error: "Verification not found" });
    return;
  }

  const [updated] = await db
    .update(instructorVerificationsTable)
    .set({
      status: action,
      reviewedAt: new Date(),
      reviewerId: req.dbUser.id,
      reviewerNotes: notes ?? null,
    })
    .where(eq(instructorVerificationsTable.id, verificationId))
    .returning();

  req.log.info({ verificationId, action, reviewerId: req.dbUser.id }, "Verification reviewed");
  res.json(updated);
});

/**
 * GET /admin/compliance/expiring
 * Returns documents that expire within the next 30 days (or are already expired).
 */
router.get("/admin/compliance/expiring", requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const in30DaysStr = in30Days.toISOString().slice(0, 10);

  const docs = await db
    .select({
      id: verificationDocumentsTable.id,
      verificationId: verificationDocumentsTable.verificationId,
      docType: verificationDocumentsTable.docType,
      fileName: verificationDocumentsTable.fileName,
      objectPath: verificationDocumentsTable.objectPath,
      uploadedAt: verificationDocumentsTable.uploadedAt,
      expiresAt: verificationDocumentsTable.expiresAt,
      instructorId: instructorsTable.id,
      instructorName: instructorsTable.fullName,
      instructorEmail: instructorsTable.email,
    })
    .from(verificationDocumentsTable)
    .innerJoin(instructorVerificationsTable, eq(verificationDocumentsTable.verificationId, instructorVerificationsTable.id))
    .innerJoin(instructorsTable, eq(instructorVerificationsTable.instructorId, instructorsTable.id))
    .where(
      and(
        isNotNull(verificationDocumentsTable.expiresAt),
        lte(verificationDocumentsTable.expiresAt, in30DaysStr)
      )
    )
    .orderBy(verificationDocumentsTable.expiresAt);

  const msPerDay = 1000 * 60 * 60 * 24;
  const result = docs.map((d) => ({
    ...d,
    daysUntilExpiry: Math.ceil((new Date(d.expiresAt!).getTime() - today.getTime()) / msPerDay),
  }));

  res.json(result);
});

/**
 * PATCH /admin/verifications/:id/documents/:docId
 * Approve, reject, or flag a single document within a verification application.
 */
router.patch("/admin/verifications/:id/documents/:docId", requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const verificationId = parseInt(req.params.id, 10);
  const docId = parseInt(req.params.docId, 10);
  const { action, notes } = req.body as { action: string; notes?: string };

  if (!["approved", "rejected", "needs_revision"].includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  const existing = await db
    .select()
    .from(verificationDocumentsTable)
    .where(and(
      eq(verificationDocumentsTable.id, docId),
      eq(verificationDocumentsTable.verificationId, verificationId),
    ))
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const [updated] = await db
    .update(verificationDocumentsTable)
    .set({
      docStatus: action,
      docReviewNotes: notes ?? null,
      docReviewedAt: new Date(),
    })
    .where(eq(verificationDocumentsTable.id, docId))
    .returning();

  req.log.info({ verificationId, docId, action, reviewerId: req.dbUser.id }, "Verification document reviewed");
  res.json(updated);
});

export default router;
