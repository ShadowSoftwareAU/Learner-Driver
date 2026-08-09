/**
 * Unit tests for useAssessmentDraft helper functions.
 *
 * These tests verify that:
 *  - saveAssessmentDraft persists all fields to AsyncStorage
 *  - loadAssessmentDraft reads them back faithfully
 *  - clearAssessmentDraft removes the key
 *  - loadAssessmentDraft returns null for an empty store or corrupt data
 *  - loadAssessmentDraft returns null when selectedStudentId is missing
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  saveAssessmentDraft,
  loadAssessmentDraft,
  clearAssessmentDraft,
  type AssessmentDraftState,
} from "../hooks/useAssessmentDraft";

const DRAFT_KEY = "learnerlog_assessment_draft";

const FULL_DRAFT: Omit<AssessmentDraftState, "savedAt"> = {
  selectedStudentId: 42,
  date: "2026-08-09",
  duration: "90",
  pedalOperator: "shared",
  weatherCondition: "rain",
  results: { 1: "mastered", 2: "practiced", 3: "attempted" },
  confidenceNote: "Good spatial awareness today",
  focusAreas: "Mirror checks on lane changes",
};

beforeEach(async () => {
  // Start every test with a clean slate.
  await AsyncStorage.clear();
});

// ─── saveAssessmentDraft ──────────────────────────────────────────────────────

describe("saveAssessmentDraft", () => {
  it("writes a JSON object to AsyncStorage under the expected key", async () => {
    await saveAssessmentDraft(FULL_DRAFT);

    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed.selectedStudentId).toBe(42);
    expect(parsed.date).toBe("2026-08-09");
    expect(parsed.duration).toBe("90");
    expect(parsed.pedalOperator).toBe("shared");
    expect(parsed.weatherCondition).toBe("rain");
    expect(parsed.results).toEqual({ 1: "mastered", 2: "practiced", 3: "attempted" });
    expect(parsed.confidenceNote).toBe("Good spatial awareness today");
    expect(parsed.focusAreas).toBe("Mirror checks on lane changes");
  });

  it("adds a savedAt timestamp", async () => {
    const before = Date.now();
    await saveAssessmentDraft(FULL_DRAFT);
    const after = Date.now();

    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.savedAt).toBeGreaterThanOrEqual(before);
    expect(parsed.savedAt).toBeLessThanOrEqual(after);
  });

  it("does not throw when AsyncStorage.setItem fails", async () => {
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("Storage full") as never);

    // Must not throw — draft save is best-effort.
    await expect(saveAssessmentDraft(FULL_DRAFT)).resolves.toBeUndefined();
  });
});

// ─── loadAssessmentDraft ─────────────────────────────────────────────────────

describe("loadAssessmentDraft", () => {
  it("returns null when nothing is saved", async () => {
    const result = await loadAssessmentDraft();
    expect(result).toBeNull();
  });

  it("returns null for corrupt (non-JSON) data", async () => {
    await AsyncStorage.setItem(DRAFT_KEY, "not valid json {{");
    const result = await loadAssessmentDraft();
    expect(result).toBeNull();
  });

  it("returns null when selectedStudentId is missing", async () => {
    const incomplete = { date: "2026-08-09", savedAt: Date.now() };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(incomplete));
    const result = await loadAssessmentDraft();
    expect(result).toBeNull();
  });

  it("returns the full draft when all fields are present", async () => {
    await saveAssessmentDraft(FULL_DRAFT);

    const result = await loadAssessmentDraft();
    expect(result).not.toBeNull();
    expect(result!.selectedStudentId).toBe(42);
    expect(result!.date).toBe("2026-08-09");
    expect(result!.duration).toBe("90");
    expect(result!.pedalOperator).toBe("shared");
    expect(result!.weatherCondition).toBe("rain");
    expect(result!.results).toEqual({ 1: "mastered", 2: "practiced", 3: "attempted" });
    expect(result!.confidenceNote).toBe("Good spatial awareness today");
    expect(result!.focusAreas).toBe("Mirror checks on lane changes");
    expect(typeof result!.savedAt).toBe("number");
  });

  it("does not throw when AsyncStorage.getItem fails", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("Read error") as never);

    await expect(loadAssessmentDraft()).resolves.toBeNull();
  });
});

// ─── clearAssessmentDraft ────────────────────────────────────────────────────

describe("clearAssessmentDraft", () => {
  it("removes the draft key from AsyncStorage", async () => {
    await saveAssessmentDraft(FULL_DRAFT);
    // Confirm it is there first.
    expect(await AsyncStorage.getItem(DRAFT_KEY)).not.toBeNull();

    await clearAssessmentDraft();

    expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("is idempotent — calling twice does not throw", async () => {
    await expect(clearAssessmentDraft()).resolves.toBeUndefined();
    await expect(clearAssessmentDraft()).resolves.toBeUndefined();
  });

  it("does not throw when AsyncStorage.removeItem fails", async () => {
    jest
      .spyOn(AsyncStorage, "removeItem")
      .mockRejectedValueOnce(new Error("Remove error") as never);

    await expect(clearAssessmentDraft()).resolves.toBeUndefined();
  });
});

// ─── Round-trip: save → load → clear ─────────────────────────────────────────

describe("round-trip behaviour", () => {
  it("draft key is absent from AsyncStorage after clearAssessmentDraft", async () => {
    await saveAssessmentDraft(FULL_DRAFT);
    await clearAssessmentDraft();
    const result = await loadAssessmentDraft();
    expect(result).toBeNull();
    expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("overwrites an older draft with a newer one", async () => {
    await saveAssessmentDraft({ ...FULL_DRAFT, duration: "60" });
    await saveAssessmentDraft({ ...FULL_DRAFT, duration: "120" });

    const result = await loadAssessmentDraft();
    expect(result!.duration).toBe("120");
  });
});
