/**
 * High-level scan entrypoint.
 * Call this from route handlers before persisting any user-authored text.
 *
 * When featureFlags.contentModerationEnforced is false:
 *   - scanning still runs and cases are created
 *   - quarantined content is stored with contentStatus='quarantined'
 *   - content IS delivered/visible (non-blocking mode)
 *
 * When featureFlags.contentModerationEnforced is true:
 *   - quarantined content blocks the request with 451 Unavailable For Legal Reasons
 *
 * If the moderation service itself fails (scan_error), the decision is always
 * fail-open (allowed: true, shouldBlock: false) to avoid blocking legitimate
 * content due to infrastructure issues. The error is logged for forensic tracing.
 */
import { scanText } from "./ruleSets";
import { processScanResult } from "./moderationService";
import type { ContentType } from "./moderationService";
import { featureFlags } from "../config";
import { logger } from "../logger";

export type ContentScanOptions = {
  text: string;
  contentType: ContentType;
  contentId?: number;
  actorUserId: number;
  targetUserId?: number;
  studentId?: number;
  schoolId?: number;
  route?: string;
};

export type ContentScanDecision = {
  allowed: boolean;
  contentStatus: "approved" | "flagged" | "quarantined" | "scan_error";
  moderationCaseId: number | null;
  shouldBlock: boolean;
};

export async function scanContent(opts: ContentScanOptions): Promise<ContentScanDecision> {
  const scanResult = scanText(opts.text);

  if (scanResult.status === "approved") {
    return { allowed: true, contentStatus: "approved", moderationCaseId: null, shouldBlock: false };
  }

  const result = await processScanResult({
    scanResult,
    contentType: opts.contentType,
    contentId: opts.contentId,
    actorUserId: opts.actorUserId,
    targetUserId: opts.targetUserId,
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    rawExcerpt: opts.text.slice(0, 200),
    actorId: opts.actorUserId,
    route: opts.route,
  });

  // Moderation infrastructure failure — fail-open, never block legitimate content.
  if (!result.ok) {
    logger.warn({
      event: "scan_content_fail_open",
      contentType: opts.contentType,
      actorUserId: opts.actorUserId,
    }, "Content scan proceeding without moderation record (scan_error — fail-open)");
    return { allowed: true, contentStatus: "scan_error", moderationCaseId: null, shouldBlock: false };
  }

  const { caseId, status } = result;
  const shouldBlock = featureFlags.contentModerationEnforced && status === "quarantined";

  return {
    allowed: !shouldBlock,
    contentStatus: status,
    moderationCaseId: caseId,
    shouldBlock,
  };
}
