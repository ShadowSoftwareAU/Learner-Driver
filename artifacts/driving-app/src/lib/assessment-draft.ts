/**
 * assessment-draft.ts
 *
 * localStorage-backed draft for the New Assessment page.
 * - loadAssessmentDraft()  — synchronous read; safe to call in useState initialiser
 * - saveAssessmentDraft()  — best-effort write; silent on quota/private-browsing errors
 * - clearAssessmentDraft() — call on successful save or explicit cancel
 *
 * Version bump the DRAFT_VERSION constant whenever the shape changes so stale
 * drafts are discarded rather than misread.
 */

const DRAFT_KEY = "learnerlog_assessment_draft";
const DRAFT_VERSION = 1 as const;

export type AssessmentDraft = {
  version: typeof DRAFT_VERSION;
  assessmentType: string;
  studentId: string;
  date: string;
  duration: string;
  pedalOperator: string;
  fitnessConfirmed: boolean;
  weatherCondition: string;
  lightingCondition: string;
  results: Record<number, string>;
  maneuverNotes: Record<number, string>;
  maneuverLocations: Record<number, { lat: number; lng: number }>;
  confidenceNote: string;
  focusAreas: string;
  setupDone: boolean;
  savedAt: number;
};

/** Read the stored draft. Returns null if absent, unparseable, or stale version. */
export function loadAssessmentDraft(): AssessmentDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssessmentDraft;
    if (parsed.version !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the current draft. Silent on failure (private browsing, quota exceeded). */
export function saveAssessmentDraft(draft: Omit<AssessmentDraft, "version" | "savedAt">): void {
  try {
    const full: AssessmentDraft = {
      ...draft,
      version: DRAFT_VERSION,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(full));
  } catch {
    // Non-fatal — user's data is still in React state
  }
}

/** Remove the draft. Call on successful API save or explicit Cancel. */
export function clearAssessmentDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}
