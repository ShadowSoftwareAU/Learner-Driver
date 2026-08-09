/**
 * executeAssessmentSave — pure, dependency-injected save workflow.
 *
 * Extracted from new-assessment.tsx so it can be unit-tested without
 * rendering the full component or fighting React test-renderer version
 * mismatches.
 *
 * On success:  clears the AsyncStorage draft, then calls onSuccess().
 * On failure:  throws (caller is responsible for showing an error) and
 *              leaves the draft intact so the instructor can retry.
 */

import { clearAssessmentDraft } from "@/hooks/useAssessmentDraft";

export type SaveAssessmentParams = {
  selectedStudentId: number;
  date: string;
  duration: string;
  pedalOperator: string;
  weatherCondition: string;
  results: Record<number, string>;
  confidenceNote: string;
  focusAreas: string;
};

export type SaveAssessmentDeps = {
  createAssessment: (payload: {
    data: {
      studentId: number;
      lessonDate: string;
      durationMinutes: number;
      pedalOperator: string;
      weatherCondition?: string;
      assessmentType: string;
    };
  }) => Promise<unknown>;
  saveManeuverResults: (payload: {
    id: number;
    data: { results: { maneuverId: number; competencyLevel: string }[] };
  }) => Promise<unknown>;
  updateAssessment: (payload: {
    id: number;
    data: { confidenceNote?: string; focusAreasNext?: string };
  }) => Promise<unknown>;
  /** Called after the draft is cleared — typically navigates away. */
  onSuccess: () => void;
};

export async function executeAssessmentSave(
  params: SaveAssessmentParams,
  deps: SaveAssessmentDeps,
): Promise<void> {
  const {
    selectedStudentId,
    date,
    duration,
    pedalOperator,
    weatherCondition,
    results,
    confidenceNote,
    focusAreas,
  } = params;

  const { createAssessment, saveManeuverResults, updateAssessment, onSuccess } =
    deps;

  // 1. Create the assessment record.
  const assessment = await createAssessment({
    data: {
      studentId: selectedStudentId,
      lessonDate: date,
      durationMinutes: parseInt(duration, 10) || 60,
      pedalOperator,
      weatherCondition: weatherCondition || undefined,
      assessmentType: "qsafe",
    },
  });

  const id = (assessment as { id: number }).id;

  // 2. Persist rated maneuver results (skip if none rated).
  const rated = Object.entries(results)
    .filter(([, level]) => level !== "not_attempted")
    .map(([maneuverId, competencyLevel]) => ({
      maneuverId: parseInt(maneuverId, 10),
      competencyLevel,
    }));

  if (rated.length > 0) {
    await saveManeuverResults({ id, data: { results: rated } });
  }

  // 3. Persist notes (skip if both are blank).
  if (confidenceNote.trim() || focusAreas.trim()) {
    await updateAssessment({
      id,
      data: {
        confidenceNote: confidenceNote.trim() || undefined,
        focusAreasNext: focusAreas.trim() || undefined,
      },
    });
  }

  // 4. Clear the draft so the resume prompt does not reappear on the next open.
  await clearAssessmentDraft();

  // 5. Navigate away (or run any other post-save callback).
  onSuccess();
}
