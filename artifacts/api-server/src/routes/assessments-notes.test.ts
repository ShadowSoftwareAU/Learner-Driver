/**
 * Tests: lesson notes round-trip on assessment detail page
 *
 * Verifies that PATCH /assessments/:id correctly persists confidenceNote and
 * focusAreasNext, and that GET /assessments/:id returns the updated values
 * verbatim — confirming what ReportPreview will receive and render.
 *
 * All I/O (DB, Clerk, content scan, notifications, audit) is mocked.
 * Routes are exercised via supertest so the full HTTP + Zod validation
 * layer is included.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetOrCreateUser,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbExecute,
  mockScanContent,
  mockSendNotification,
  mockLogAudit,
  mockEvaluateMilestones,
  mockSendExternalEmail,
} = vi.hoisted(() => ({
  mockGetOrCreateUser: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbExecute: vi.fn(),
  mockScanContent: vi.fn(),
  mockSendNotification: vi.fn(),
  mockLogAudit: vi.fn(),
  mockEvaluateMilestones: vi.fn(),
  mockSendExternalEmail: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    execute: mockDbExecute,
  },
  assessmentsTable: {},
  maneuverResultsTable: {},
  maneuversTable: {},
  studentsTable: {},
  instructorsTable: {},
  sessionFeedbackTable: {},
  usersTable: {},
  schoolInstructorsTable: {},
  handoverNotesTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  isNotNull: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn().mockReturnValue({ userId: "clerk_test_user" }),
}));

vi.mock("./users.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.clerkUserId = "clerk_test_user";
    next();
  },
  getOrCreateUser: mockGetOrCreateUser,
}));

vi.mock("./audit.js", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("../lib/contentFiltering/scanContent.js", () => ({
  scanContent: mockScanContent,
}));

vi.mock("../lib/notifications/notificationService.js", () => ({
  sendNotification: mockSendNotification,
}));

vi.mock("../lib/notifications/emailChannel.js", () => ({
  sendExternalEmail: mockSendExternalEmail,
}));

vi.mock("../lib/milestones/evaluate.js", () => ({
  evaluateAndPersistMilestones: mockEvaluateMilestones,
}));

// Import subject AFTER mocks
import assessmentsRouter from "./assessments.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a fully chainable, thenable Drizzle query mock that resolves
 * with `value`. Every method call (from, where, set, returning, …) returns
 * the same proxy, so any chain length works.
 */
function makeChain(value: unknown) {
  const p = Promise.resolve(value);
  const chain: any = new Proxy(
    {},
    {
      get(_, key) {
        if (key === "then") return p.then.bind(p);
        if (key === "catch") return p.catch.bind(p);
        if (key === "finally") return p.finally.bind(p);
        return () => chain;
      },
    }
  );
  return chain;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/", assessmentsRouter);
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INSTRUCTOR_USER = {
  id: 1,
  clerkId: "clerk_test_user",
  email: "instructor@example.com",
  name: "Jane Instructor",
  role: "instructor",
  schoolId: null,
};

const INSTRUCTOR_ROW = {
  id: 10,
  userId: 1,
  fullName: "Jane Instructor",
  email: "instructor@example.com",
};

const STUDENT_ROW = {
  id: 20,
  userId: 99,
  fullName: "Alex Learner",
  email: "alex@example.com",
  schoolId: null,
  totalHours: "5.5",
};

/** Builds a minimal assessment DB row */
function makeAssessmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    studentId: 20,
    instructorId: 10,
    schoolId: null,
    lessonDate: "2025-06-01",
    durationMinutes: 60,
    status: "completed",
    performedByRole: "instructor",
    assessmentType: "qsafe",
    pedalOperator: "student",
    confidenceNote: null,
    focusAreasNext: null,
    routePath: null,
    startCoordinates: null,
    endCoordinates: null,
    routeData: null,
    preLessonBriefingAcknowledgedAt: null,
    preDriveFitnessConfirmedAt: null,
    finalizationStatus: "draft",
    approvedAt: null,
    approvedByUserId: null,
    reportDispatchedAt: null,
    reportDispatchedTo: null,
    weatherCondition: null,
    lightingCondition: null,
    vehicleId: null,
    createdAt: new Date("2025-06-01T08:00:00Z"),
    ...overrides,
  };
}

// ─── PATCH /assessments/:id — notes round-trip ────────────────────────────────

describe("PATCH /assessments/:id — notes fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateUser.mockResolvedValue(INSTRUCTOR_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockScanContent.mockResolvedValue({ shouldBlock: false });
    mockSendNotification.mockResolvedValue(undefined);
    mockDbExecute.mockResolvedValue([]);
  });

  /**
   * Sets up the DB mock sequence for a successful PATCH:
   *   1. select assessment (ownership check)
   *   2. select instructor (ownership check)
   *   3. update assessment (returns updatedRow)
   *   4. select student (notification path — only hit on status=completed transition)
   */
  function setupPatchMocks(existingRow: ReturnType<typeof makeAssessmentRow>, updatedRow: ReturnType<typeof makeAssessmentRow>) {
    mockDbSelect
      .mockReturnValueOnce(makeChain([existingRow]))   // select assessment
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW])); // select instructor
    mockDbUpdate.mockReturnValue(makeChain([updatedRow]));
  }

  it("persists confidenceNote and returns it verbatim in the PATCH response", async () => {
    const note = "Student showed good lane discipline. Confidence improving steadily.";
    const existing = makeAssessmentRow({ confidenceNote: null });
    const updated = makeAssessmentRow({ confidenceNote: note });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: note });

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(note);
    expect(res.body.focusAreasNext).toBeNull();
  });

  it("persists focusAreasNext and returns it verbatim in the PATCH response", async () => {
    const focus = "Work on mirror checks before lane changes.\nPractise parallel parking.";
    const existing = makeAssessmentRow({ focusAreasNext: null });
    const updated = makeAssessmentRow({ focusAreasNext: focus });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ focusAreasNext: focus });

    expect(res.status).toBe(200);
    expect(res.body.focusAreasNext).toBe(focus);
    expect(res.body.confidenceNote).toBeNull();
  });

  it("persists both notes fields together and returns them verbatim", async () => {
    const note = "Overall solid lesson. Working well under pressure.";
    const focus = "Speed management on residential streets.";
    const existing = makeAssessmentRow({});
    const updated = makeAssessmentRow({ confidenceNote: note, focusAreasNext: focus });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: note, focusAreasNext: focus });

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(note);
    expect(res.body.focusAreasNext).toBe(focus);
  });

  it("round-trips notes containing newlines and special characters without modification", async () => {
    const note = "Line 1\nLine 2\n\tTabbed note — dash: — apostrophe: it's fine & <safe>";
    const focus = "Focus: braking\n• Item A\n• Item B";
    const existing = makeAssessmentRow({});
    const updated = makeAssessmentRow({ confidenceNote: note, focusAreasNext: focus });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: note, focusAreasNext: focus });

    expect(res.status).toBe(200);
    // Notes must be preserved exactly — no escaping, no trimming, no truncation
    expect(res.body.confidenceNote).toBe(note);
    expect(res.body.focusAreasNext).toBe(focus);
  });

  it("accepts an empty string for confidenceNote (clearing the field)", async () => {
    const existing = makeAssessmentRow({ confidenceNote: "Old note" });
    const updated = makeAssessmentRow({ confidenceNote: "" });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: "" });

    expect(res.status).toBe(200);
    // Empty string is a valid clear — API must not reject it
    expect(res.body.confidenceNote).toBe("");
  });

  it("accepts notes at the maximum allowed length (5000 chars for confidenceNote)", async () => {
    const maxNote = "A".repeat(5000);
    const existing = makeAssessmentRow({});
    const updated = makeAssessmentRow({ confidenceNote: maxNote });
    setupPatchMocks(existing, updated);

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: maxNote });

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(maxNote);
  });

  it("rejects confidenceNote that exceeds 5000 characters with 400", async () => {
    const tooLong = "A".repeat(5001);
    // Zod parse fires after the DB ownership check, so we need those mocks set up.
    mockDbSelect
      .mockReturnValueOnce(makeChain([makeAssessmentRow({})]))
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW]));

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: tooLong });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid request body/i);
    // DB update must not have been called
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("rejects focusAreasNext that exceeds 2000 characters with 400", async () => {
    const tooLong = "B".repeat(2001);
    mockDbSelect
      .mockReturnValueOnce(makeChain([makeAssessmentRow({})]))
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW]));

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ focusAreasNext: tooLong });

    expect(res.status).toBe(400);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when the instructor does not own the assessment", async () => {
    const otherInstructor = { ...INSTRUCTOR_ROW, id: 999 };
    mockDbSelect
      .mockReturnValueOnce(makeChain([makeAssessmentRow({ instructorId: 10 })])) // assessment
      .mockReturnValueOnce(makeChain([otherInstructor])); // instructor (different id)

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: "Should not save" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when assessment does not exist", async () => {
    mockDbSelect.mockReturnValue(makeChain([])); // no assessment found

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: "Should not save" });

    expect(res.status).toBe(404);
  });

  it("does not call DB update when content scan blocks the note", async () => {
    mockScanContent.mockResolvedValue({ shouldBlock: true, moderationCaseId: 7 });
    mockDbSelect
      .mockReturnValueOnce(makeChain([makeAssessmentRow({})]))
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW]));

    const res = await request(makeApp())
      .patch("/assessments/55")
      .send({ confidenceNote: "Blocked content" });

    expect(res.status).toBe(451);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// ─── GET /assessments/:id — notes fields after an edit ───────────────────────

describe("GET /assessments/:id — notes fields returned for ReportPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateUser.mockResolvedValue(INSTRUCTOR_USER);
    mockLogAudit.mockResolvedValue(undefined);
  });

  /**
   * Sets up DB mocks for GET:
   *   1. select assessment
   *   2. select instructor (ownership check)
   *   3. select maneuver results (join)
   *   4. select student name
   *   5. select instructor name
   */
  function setupGetMocks(assessmentRow: ReturnType<typeof makeAssessmentRow>) {
    mockDbSelect
      .mockReturnValueOnce(makeChain([assessmentRow]))       // assessment
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW]))       // instructor ownership check
      .mockReturnValueOnce(makeChain([]))                     // maneuver results (empty)
      .mockReturnValueOnce(makeChain([{ fullName: "Alex Learner" }])) // student name
      .mockReturnValueOnce(makeChain([{ fullName: "Jane Instructor" }])); // instructor name
  }

  it("returns confidenceNote and focusAreasNext when both are populated", async () => {
    const note = "Strong lane discipline today.";
    const focus = "Work on roundabout entry speed.";
    setupGetMocks(makeAssessmentRow({ confidenceNote: note, focusAreasNext: focus }));

    const res = await request(makeApp()).get("/assessments/55");

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(note);
    expect(res.body.focusAreasNext).toBe(focus);
  });

  it("returns null for both notes when they have not been set", async () => {
    setupGetMocks(makeAssessmentRow({ confidenceNote: null, focusAreasNext: null }));

    const res = await request(makeApp()).get("/assessments/55");

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBeNull();
    expect(res.body.focusAreasNext).toBeNull();
  });

  it("preserves multi-line notes with whitespace exactly as stored", async () => {
    const multiLine = "First observation.\n\nSecond observation.\n\tThird with tab.";
    setupGetMocks(makeAssessmentRow({ confidenceNote: multiLine }));

    const res = await request(makeApp()).get("/assessments/55");

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(multiLine);
  });

  it("includes both notes fields alongside finalizationStatus for the ReportPreview badge", async () => {
    const note = "Good session.";
    const focus = "Mirror checks.";
    setupGetMocks(
      makeAssessmentRow({
        confidenceNote: note,
        focusAreasNext: focus,
        finalizationStatus: "dispatched",
        reportDispatchedAt: "2025-06-02T10:00:00Z",
        reportDispatchedTo: '["parent@example.com"]',
      })
    );

    const res = await request(makeApp()).get("/assessments/55");

    expect(res.status).toBe(200);
    expect(res.body.confidenceNote).toBe(note);
    expect(res.body.focusAreasNext).toBe(focus);
    expect(res.body.finalizationStatus).toBe("dispatched");
    expect(res.body.reportDispatchedTo).toBe('["parent@example.com"]');
  });
});

// ─── Stateful round-trip: PATCH response feeds the GET / ReportPreview path ──
//
// This suite uses a shared state variable to simulate a real database write
// followed by a read. The PATCH mock updates the stored row; the GET mock reads
// from the same row. The GET response is exactly what ReportPreview receives
// when the detail page re-fetches after a successful edit.

describe("Stateful round-trip: edit notes → fetch → ReportPreview data", () => {
  // Shared DB state — mutated by PATCH mock, read by GET mock
  let db: ReturnType<typeof makeAssessmentRow>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateUser.mockResolvedValue(INSTRUCTOR_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockScanContent.mockResolvedValue({ shouldBlock: false });
    mockDbExecute.mockResolvedValue([]);

    // Initialise the "database" with blank notes
    db = makeAssessmentRow({ confidenceNote: null, focusAreasNext: null });
  });

  /**
   * Sets up PATCH mocks so they write updated fields into the shared `db`
   * object, mirroring what a real DB update would do.
   */
  function setupStatefulPatch(patch: Partial<ReturnType<typeof makeAssessmentRow>>) {
    // PATCH: ownership lookups + update (mutates db)
    mockDbSelect
      .mockReturnValueOnce(makeChain([db]))              // select assessment
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW])); // select instructor
    mockDbUpdate.mockImplementationOnce(() => {
      Object.assign(db, patch);
      return makeChain([db]);
    });
  }

  /**
   * Sets up GET mocks to read from the shared `db` object — simulating the
   * query invalidation + re-fetch that follows a successful edit on the
   * detail page.
   */
  function setupStatefulGet() {
    mockDbSelect
      .mockReturnValueOnce(makeChain([db]))                            // select assessment
      .mockReturnValueOnce(makeChain([INSTRUCTOR_ROW]))                // ownership check
      .mockReturnValueOnce(makeChain([]))                              // maneuver results
      .mockReturnValueOnce(makeChain([{ fullName: "Alex Learner" }]))  // student name
      .mockReturnValueOnce(makeChain([{ fullName: "Jane Instructor" }])); // instructor name
  }

  it("GET after PATCH returns the updated confidenceNote (simulates ReportPreview re-render)", async () => {
    const app = makeApp();
    const editedNote = "Excellent mirror checks on the highway merge today.";

    // 1. Instructor submits the Edit Notes dialog → PATCH
    setupStatefulPatch({ confidenceNote: editedNote });
    const patchRes = await request(app)
      .patch("/assessments/55")
      .send({ confidenceNote: editedNote });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.confidenceNote).toBe(editedNote);

    // 2. Query invalidation triggers re-fetch → GET (same data as ReportPreview receives)
    setupStatefulGet();
    const getRes = await request(app).get("/assessments/55");

    expect(getRes.status).toBe(200);
    expect(getRes.body.confidenceNote).toBe(editedNote);
    // focusAreasNext was not changed — must still be null
    expect(getRes.body.focusAreasNext).toBeNull();
  });

  it("GET after PATCH returns updated focusAreasNext verbatim", async () => {
    const app = makeApp();
    const editedFocus = "Emergency braking technique at intersections.\nRoundabout entry speed.";

    setupStatefulPatch({ focusAreasNext: editedFocus });
    const patchRes = await request(app)
      .patch("/assessments/55")
      .send({ focusAreasNext: editedFocus });

    expect(patchRes.status).toBe(200);

    setupStatefulGet();
    const getRes = await request(app).get("/assessments/55");

    expect(getRes.status).toBe(200);
    expect(getRes.body.focusAreasNext).toBe(editedFocus);
    // Multi-line preserved — ReportPreview's whitespace-pre-wrap relies on this
    expect(getRes.body.focusAreasNext).toContain("\n");
  });

  it("GET after PATCH returns both notes updated together", async () => {
    const app = makeApp();
    const newNote = "Student showed real improvement today.";
    const newFocus = "Night driving confidence; speed signs.";

    setupStatefulPatch({ confidenceNote: newNote, focusAreasNext: newFocus });
    await request(app).patch("/assessments/55").send({ confidenceNote: newNote, focusAreasNext: newFocus });

    setupStatefulGet();
    const getRes = await request(app).get("/assessments/55");

    expect(getRes.status).toBe(200);
    expect(getRes.body.confidenceNote).toBe(newNote);
    expect(getRes.body.focusAreasNext).toBe(newFocus);
    // finalizationStatus must be present — ReportPreview needs it for the status badge
    expect(getRes.body.finalizationStatus).toBe("draft");
  });

  it("GET after PATCH on a dispatched assessment still returns the updated notes and dispatch metadata", async () => {
    const app = makeApp();
    // Start with a dispatched assessment (notes were editable via task-106 override flow)
    db = makeAssessmentRow({
      confidenceNote: "Original note.",
      focusAreasNext: null,
      finalizationStatus: "dispatched",
      reportDispatchedAt: "2025-06-02T10:00:00Z",
      reportDispatchedTo: '["parent@example.com"]',
    });

    const updatedNote = "Corrected note after dispatch (instructor override).";
    setupStatefulPatch({ confidenceNote: updatedNote });
    await request(app).patch("/assessments/55").send({ confidenceNote: updatedNote });

    setupStatefulGet();
    const getRes = await request(app).get("/assessments/55");

    expect(getRes.status).toBe(200);
    expect(getRes.body.confidenceNote).toBe(updatedNote);
    // Dispatch metadata must be intact — ReportPreview renders the dispatch record
    expect(getRes.body.finalizationStatus).toBe("dispatched");
    expect(getRes.body.reportDispatchedTo).toBe('["parent@example.com"]');
    expect(getRes.body.reportDispatchedAt).toBe("2025-06-02T10:00:00Z");
  });
});
