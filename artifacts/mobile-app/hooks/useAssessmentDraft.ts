/**
 * useAssessmentDraft — AsyncStorage-backed draft persistence for the mobile
 * new-assessment flow.
 *
 * Only saves when a student has been selected (avoids noisy empty drafts).
 * Clears automatically on successful save or explicit discard.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "learnerlog_assessment_draft";

export type AssessmentDraftState = {
  selectedStudentId: number;
  date: string;
  duration: string;
  pedalOperator: string;
  weatherCondition: string;
  results: Record<number, string>;
  confidenceNote: string;
  focusAreas: string;
  savedAt: number;
};

/**
 * Persist the current assessment state to AsyncStorage.
 * No-ops silently on failure — draft persistence is best-effort.
 */
export async function saveAssessmentDraft(
  state: Omit<AssessmentDraftState, "savedAt">,
): Promise<void> {
  try {
    const draft: AssessmentDraftState = { ...state, savedAt: Date.now() };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Non-fatal
  }
}

/**
 * Load a previously saved draft.
 * Returns null if nothing is saved or the stored value is corrupt.
 */
export async function loadAssessmentDraft(): Promise<AssessmentDraftState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssessmentDraftState;
    // Basic sanity check — must have a student id
    if (!parsed.selectedStudentId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Delete the draft after a successful save or an explicit discard.
 */
export async function clearAssessmentDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Non-fatal
  }
}
