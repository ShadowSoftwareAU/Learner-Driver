/**
 * Moderation service — creates and manages moderation cases.
 * All quarantined content must flow through here before storage decisions.
 * Retention: 7 years minimum — do NOT hard-delete cases or events.
 */
import { eq } from "drizzle-orm";
import { db, moderationCasesTable, moderatedContentEventsTable, auditLogsTable } from "@workspace/db";
import type { ScanResult } from "./ruleSets";
import { logger } from "../logger";

export type ContentType =
  | "handover_note"
  | "assessment_note"
  | "booking_note"
  | "message"
  | "other";

export type OpenCaseResult = {
  caseId: number;
  status: "approved" | "quarantined" | "flagged";
};

/**
 * Process a scan result for a piece of content.
 * - Approved: no-op, returns status
 * - Flagged/quarantined: creates moderation case + event
 */
export async function processScanResult(opts: {
  scanResult: ScanResult;
  contentType: ContentType;
  contentId?: number;
  actorUserId?: number;
  targetUserId?: number;
  studentId?: number;
  schoolId?: number;
  rawExcerpt?: string;
  actorId: number;
  route?: string;
}): Promise<OpenCaseResult> {
  const { scanResult, actorId } = opts;

  if (scanResult.status === "approved") {
    return { caseId: 0, status: "approved" };
  }

  try {
    const [newCase] = await db.insert(moderationCasesTable).values({
      schoolId: opts.schoolId ?? null,
      reportedBySystem: true,
      status: "open",
      severity: scanResult.severity ?? "medium",
      contentType: opts.contentType,
      contentId: opts.contentId ?? null,
      actorUserId: opts.actorUserId ?? null,
      targetUserId: opts.targetUserId ?? null,
      studentId: opts.studentId ?? null,
      ruleHitsJson: scanResult.ruleHits as any,
      rawExcerpt: opts.rawExcerpt ?? scanResult.ruleHits[0]?.excerpt ?? null,
      legalHold: false,
    }).returning();

    // Write detected event
    await db.insert(moderatedContentEventsTable).values({
      moderationCaseId: newCase.id,
      eventType: "detected",
      payloadJson: {
        ruleHits: scanResult.ruleHits,
        severity: scanResult.severity,
        contentType: opts.contentType,
      } as any,
    });

    if (scanResult.status === "quarantined") {
      await db.insert(moderatedContentEventsTable).values({
        moderationCaseId: newCase.id,
        eventType: "quarantined",
        payloadJson: { actorUserId: opts.actorUserId } as any,
      });
    }

    // Audit log
    await db.insert(auditLogsTable).values({
      actorId,
      result: "flagged",
      action: "content_flagged",
      resourceType: opts.contentType,
      resourceId: opts.contentId ?? null,
      studentId: opts.studentId ?? null,
      schoolId: opts.schoolId ?? null,
      route: opts.route ?? null,
      metadataJson: { moderationCaseId: newCase.id, severity: scanResult.severity, ruleCount: scanResult.ruleHits.length } as any,
    });

    logger.warn({
      event: "content_flagged",
      caseId: newCase.id,
      severity: scanResult.severity,
      contentType: opts.contentType,
      ruleCount: scanResult.ruleHits.length,
    });

    return { caseId: newCase.id, status: scanResult.status };
  } catch (err) {
    logger.error({ event: "moderation_service_error", err });
    // Non-fatal — do not block content submission on moderation failures
    return { caseId: 0, status: "flagged" };
  }
}

/**
 * Release a quarantined case after review.
 * Appends released event — never mutates the original content body.
 */
export async function releaseCase(caseId: number, reviewedByUserId: number, outcome: string): Promise<void> {
  await db.update(moderationCasesTable)
    .set({ status: "released", reviewOutcome: outcome, reviewedByUserId, reviewedAt: new Date() })
    .where(eq(moderationCasesTable.id, caseId));

  await db.insert(moderatedContentEventsTable).values({
    moderationCaseId: caseId,
    eventType: "released",
    payloadJson: { reviewedByUserId, outcome } as any,
  });
}
