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
 */
import { scanText } from "./ruleSets";
import { processScanResult } from "./moderationService";
import type { ContentType } from "./moderationService";
import { featureFlags } from "../config";

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
  contentStatus: "approved" | "flagged" | "quarantined";
  moderationCaseId: number;
  shouldBlock: boolean;
};

export async function scanContent(opts: ContentScanOptions): Promise<ContentScanDecision> {
  const scanResult = scanText(opts.text);

  if (scanResult.status === "approved") {
    return { allowed: true, contentStatus: "approved", moderationCaseId: 0, shouldBlock: false };
  }

  const { caseId, status } = await processScanResult({
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

  const shouldBlock = featureFlags.contentModerationEnforced && status === "quarantined";

  return {
    allowed: !shouldBlock,
    contentStatus: status,
    moderationCaseId: caseId,
    shouldBlock,
  };
}
