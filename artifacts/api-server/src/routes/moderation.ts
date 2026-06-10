/**
 * Moderation routes — super_admin only.
 * Manages content moderation cases, review workflow, and law enforcement exports.
 * Access: super_admin role required for all routes.
 * Audit: every action is logged.
 */
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  moderationCasesTable,
  moderatedContentEventsTable,
  lawEnforcementExportsTable,
  auditLogsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { canManageModeration } from "../lib/authz";
import { releaseCase } from "../lib/contentFiltering/moderationService";
import { logger } from "../lib/logger";

const router = Router();

function requireModerationAccess(user: Awaited<ReturnType<typeof getOrCreateUser>>, res: any): boolean {
  if (!canManageModeration(user)) {
    res.status(403).json({ error: "super_admin role required" });
    return false;
  }
  return true;
}

// ─── List cases ──────────────────────────────────────────────────────────────

router.get("/moderation/cases", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const { status, severity, schoolId, contentType, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr ?? "50", 10), 200);

  let query = db.select().from(moderationCasesTable).orderBy(desc(moderationCasesTable.createdAt)).limit(limit);

  const conditions = [];
  if (status) conditions.push(eq(moderationCasesTable.status, status));
  if (severity) conditions.push(eq(moderationCasesTable.severity, severity));
  if (schoolId) conditions.push(eq(moderationCasesTable.schoolId as any, parseInt(schoolId, 10)));
  if (contentType) conditions.push(eq(moderationCasesTable.contentType, contentType));

  const rows = conditions.length > 0
    ? await db.select().from(moderationCasesTable).where(and(...conditions)).orderBy(desc(moderationCasesTable.createdAt)).limit(limit)
    : await db.select().from(moderationCasesTable).orderBy(desc(moderationCasesTable.createdAt)).limit(limit);

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "moderation_cases_list",
    resourceType: "moderation_case",
    actorRole: user.role,
    result: "success",
    route: "/moderation/cases",
    metadataJson: { filters: { status, severity, schoolId, contentType } } as any,
  }).catch(() => null);

  res.json(rows);
});

// ─── Get single case with events ─────────────────────────────────────────────

router.get("/moderation/cases/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const caseId = parseInt(req.params.id as string, 10);
  const [modCase] = await db.select().from(moderationCasesTable).where(eq(moderationCasesTable.id, caseId));
  if (!modCase) { res.status(404).json({ error: "Case not found" }); return; }

  const events = await db.select().from(moderatedContentEventsTable)
    .where(eq(moderatedContentEventsTable.moderationCaseId, caseId))
    .orderBy(moderatedContentEventsTable.createdAt);

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "moderation_case_view",
    resourceType: "moderation_case",
    resourceId: caseId,
    actorRole: user.role,
    result: "success",
    route: `/moderation/cases/${caseId}`,
  }).catch(() => null);

  res.json({ ...modCase, events });
});

// ─── Patch case (status, legalHold, reviewOutcome) ───────────────────────────

router.patch("/moderation/cases/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const caseId = parseInt(req.params.id as string, 10);
  const { status, reviewOutcome, legalHold } = req.body as {
    status?: string;
    reviewOutcome?: string;
    legalHold?: boolean;
  };

  const updateFields: Record<string, unknown> = {};
  if (status !== undefined) updateFields.status = status;
  if (reviewOutcome !== undefined) updateFields.reviewOutcome = reviewOutcome;
  if (legalHold !== undefined) updateFields.legalHold = legalHold;
  if (status !== undefined && ["released", "closed", "escalated", "under_review"].includes(status)) {
    updateFields.reviewedByUserId = user.id;
    updateFields.reviewedAt = new Date();
  }

  await db.update(moderationCasesTable).set(updateFields as any).where(eq(moderationCasesTable.id, caseId));

  if (status) {
    await db.insert(moderatedContentEventsTable).values({
      moderationCaseId: caseId,
      eventType: status as any,
      payloadJson: { reviewedByUserId: user.id, reviewOutcome } as any,
    }).catch(() => null);
  }

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "moderation_case_update",
    resourceType: "moderation_case",
    resourceId: caseId,
    actorRole: user.role,
    result: "success",
    route: `/moderation/cases/${caseId}`,
    metadataJson: updateFields as any,
  }).catch(() => null);

  const [updated] = await db.select().from(moderationCasesTable).where(eq(moderationCasesTable.id, caseId));
  res.json(updated);
});

// ─── Release quarantine ───────────────────────────────────────────────────────

router.post("/moderation/cases/:id/release", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const caseId = parseInt(req.params.id as string, 10);
  const { outcome } = req.body as { outcome?: string };

  await releaseCase(caseId, user.id, outcome ?? "released_after_review");

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "moderation_case_released",
    resourceType: "moderation_case",
    resourceId: caseId,
    actorRole: user.role,
    result: "success",
    route: `/moderation/cases/${caseId}/release`,
  }).catch(() => null);

  res.json({ ok: true });
});

// ─── Escalate case ────────────────────────────────────────────────────────────

router.post("/moderation/cases/:id/escalate", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const caseId = parseInt(req.params.id as string, 10);
  const { reason } = req.body as { reason?: string };

  await db.update(moderationCasesTable)
    .set({ status: "escalated", reviewedByUserId: user.id, reviewedAt: new Date() })
    .where(eq(moderationCasesTable.id, caseId));

  await db.insert(moderatedContentEventsTable).values({
    moderationCaseId: caseId,
    eventType: "escalated",
    payloadJson: { reviewedByUserId: user.id, reason } as any,
  }).catch(() => null);

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "moderation_case_escalated",
    resourceType: "moderation_case",
    resourceId: caseId,
    actorRole: user.role,
    result: "success",
    route: `/moderation/cases/${caseId}/escalate`,
    metadataJson: { reason } as any,
  }).catch(() => null);

  res.json({ ok: true });
});

// ─── Law enforcement export ───────────────────────────────────────────────────
// super_admin only — fully audited, every export is a permanent record

router.post("/moderation/exports", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!requireModerationAccess(user, res)) return;

  const { caseIds, reason, schoolId } = req.body as {
    caseIds: number[];
    reason: string;
    schoolId?: number;
  };

  if (!caseIds?.length || !reason?.trim()) {
    res.status(400).json({ error: "caseIds and reason are required" });
    return;
  }

  const [exportRow] = await db.insert(lawEnforcementExportsTable).values({
    requestedByUserId: user.id,
    schoolId: schoolId ?? null,
    caseIdsJson: caseIds as any,
    reason: reason.trim(),
    exportPath: null,
    checksum: null,
  }).returning();

  // Mark each case with exported event
  for (const caseId of caseIds) {
    await db.insert(moderatedContentEventsTable).values({
      moderationCaseId: caseId,
      eventType: "exported",
      payloadJson: { exportId: exportRow.id, requestedByUserId: user.id } as any,
    }).catch(() => null);
  }

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "law_enforcement_export",
    resourceType: "law_enforcement_export",
    resourceId: exportRow.id,
    actorRole: user.role,
    result: "success",
    route: "/moderation/exports",
    metadataJson: { caseCount: caseIds.length, reason } as any,
  }).catch(() => null);

  logger.warn({ event: "law_enforcement_export", exportId: exportRow.id, caseCount: caseIds.length, actorId: user.id });

  res.status(201).json({ exportId: exportRow.id, caseCount: caseIds.length });
});

export default router;
