/**
 * Unit tests for executeAssessmentSave — the extracted save workflow used by
 * NewAssessmentScreen.handleSave.
 *
 * These tests execute the real function (not a mirrored helper) and assert:
 *  1. On success — all three API deps are called with correct arguments
 *  2. On success — clearAssessmentDraft() removes the draft key
 *  3. On success — onSuccess() is called
 *  4. On API failure — the draft key is preserved so the instructor can retry
 *  5. On API failure — onSuccess() is NOT called
 *  6. Maneuver results rated "not_attempted" are excluded from the API call
 *  7. Notes are omitted when both note fields are blank
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { executeAssessmentSave } from "../lib/saveAssessment";
import {
  saveAssessmentDraft,
  loadAssessmentDraft,
} from "../hooks/useAssessmentDraft";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS = {
  selectedStudentId: 42,
  date: "2026-08-09",
  duration: "90",
  pedalOperator: "shared",
  weatherCondition: "rain",
  results: {
    1: "mastered",
    2: "practiced",
    3: "not_attempted",
  } as Record<number, string>,
  confidenceNote: "Good session",
  focusAreas: "Mirror checks",
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDeps(overrides?: Partial<Parameters<typeof executeAssessmentSave>[1]>) {
  const createAssessment = jest.fn().mockResolvedValue({ id: 99 });
  const saveManeuverResults = jest.fn().mockResolvedValue({});
  const updateAssessment = jest.fn().mockResolvedValue({});
  const onSuccess = jest.fn();

  return {
    createAssessment,
    saveManeuverResults,
    updateAssessment,
    onSuccess,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("executeAssessmentSave — happy path", () => {
  it("calls createAssessment with the correct payload", async () => {
    const deps = makeDeps();
    await executeAssessmentSave(BASE_PARAMS, deps);

    expect(deps.createAssessment).toHaveBeenCalledTimes(1);
    expect(deps.createAssessment).toHaveBeenCalledWith({
      data: {
        studentId: 42,
        lessonDate: "2026-08-09",
        durationMinutes: 90,
        pedalOperator: "shared",
        weatherCondition: "rain",
        assessmentType: "qsafe",
      },
    });
  });

  it("calls saveManeuverResults excluding not_attempted entries", async () => {
    const deps = makeDeps();
    await executeAssessmentSave(BASE_PARAMS, deps);

    expect(deps.saveManeuverResults).toHaveBeenCalledTimes(1);
    const payload = deps.saveManeuverResults.mock.calls[0][0] as any;
    expect(payload.id).toBe(99);

    const resultItems = payload.data.results as { maneuverId: number; competencyLevel: string }[];
    const maneuverIds = resultItems.map((r) => r.maneuverId);
    expect(maneuverIds).toContain(1);
    expect(maneuverIds).toContain(2);
    // maneuver 3 is "not_attempted" — must be excluded
    expect(maneuverIds).not.toContain(3);
  });

  it("calls updateAssessment with the notes", async () => {
    const deps = makeDeps();
    await executeAssessmentSave(BASE_PARAMS, deps);

    expect(deps.updateAssessment).toHaveBeenCalledTimes(1);
    const payload = deps.updateAssessment.mock.calls[0][0] as any;
    expect(payload.id).toBe(99);
    expect(payload.data.confidenceNote).toBe("Good session");
    expect(payload.data.focusAreasNext).toBe("Mirror checks");
  });

  it("clears the draft from AsyncStorage on success", async () => {
    await saveAssessmentDraft({
      selectedStudentId: 42,
      date: "2026-08-09",
      duration: "90",
      pedalOperator: "shared",
      weatherCondition: "rain",
      results: {},
      confidenceNote: "",
      focusAreas: "",
    });

    expect(await loadAssessmentDraft()).not.toBeNull();

    const deps = makeDeps();
    await executeAssessmentSave(BASE_PARAMS, deps);

    expect(await loadAssessmentDraft()).toBeNull();
  });

  it("calls onSuccess after clearing the draft", async () => {
    await saveAssessmentDraft({
      selectedStudentId: 42,
      date: "2026-08-09",
      duration: "90",
      pedalOperator: "shared",
      weatherCondition: "rain",
      results: {},
      confidenceNote: "",
      focusAreas: "",
    });

    const deps = makeDeps();
    await executeAssessmentSave(BASE_PARAMS, deps);

    expect(deps.onSuccess).toHaveBeenCalledTimes(1);
    // Draft must be cleared before onSuccess is invoked.
    expect(await loadAssessmentDraft()).toBeNull();
  });
});

describe("executeAssessmentSave — failure path", () => {
  it("preserves the draft in AsyncStorage when createAssessment throws", async () => {
    await saveAssessmentDraft({
      selectedStudentId: 42,
      date: "2026-08-09",
      duration: "90",
      pedalOperator: "shared",
      weatherCondition: "rain",
      results: {},
      confidenceNote: "",
      focusAreas: "",
    });

    const deps = makeDeps({
      createAssessment: jest.fn().mockRejectedValue(new Error("Network error")),
    });

    await expect(executeAssessmentSave(BASE_PARAMS, deps)).rejects.toThrow(
      "Network error",
    );

    // Draft must survive — the instructor should be able to retry.
    expect(await loadAssessmentDraft()).not.toBeNull();
  });

  it("does NOT call onSuccess when createAssessment throws", async () => {
    const deps = makeDeps({
      createAssessment: jest.fn().mockRejectedValue(new Error("Server error")),
    });

    await expect(executeAssessmentSave(BASE_PARAMS, deps)).rejects.toThrow();
    expect(deps.onSuccess).not.toHaveBeenCalled();
  });
});

describe("executeAssessmentSave — edge cases", () => {
  it("skips saveManeuverResults when all results are not_attempted", async () => {
    const allNotAttempted = {
      ...BASE_PARAMS,
      results: { 1: "not_attempted", 2: "not_attempted" } as Record<number, string>,
    };
    const deps = makeDeps();
    await executeAssessmentSave(allNotAttempted, deps);

    expect(deps.saveManeuverResults).not.toHaveBeenCalled();
    expect(deps.onSuccess).toHaveBeenCalledTimes(1);
  });

  it("skips updateAssessment when both note fields are blank", async () => {
    const noNotes = { ...BASE_PARAMS, confidenceNote: "  ", focusAreas: "" };
    const deps = makeDeps();
    await executeAssessmentSave(noNotes, deps);

    expect(deps.updateAssessment).not.toHaveBeenCalled();
    expect(deps.onSuccess).toHaveBeenCalledTimes(1);
  });

  it("omits weatherCondition from the API payload when it is empty", async () => {
    const noWeather = { ...BASE_PARAMS, weatherCondition: "" };
    const deps = makeDeps();
    await executeAssessmentSave(noWeather, deps);

    const payload = (deps.createAssessment.mock.calls[0][0] as any).data;
    expect(payload.weatherCondition).toBeUndefined();
  });
});
