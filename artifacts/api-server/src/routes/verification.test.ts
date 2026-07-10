import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (must be declared before vi.mock factories are evaluated) ──

const { mockLimit, mockSendNotification } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockSendNotification: vi.fn(),
}));

// ─── Mock @workspace/db ────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockLimit }) }) }),
  },
  instructorsTable: {},
  usersTable: {},
  instructorVerificationsTable: {},
  verificationDocumentsTable: {},
}));

// ─── Mock drizzle-orm operators (passed into mocked chain, values ignored) ──

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  lte: vi.fn(),
  and: vi.fn(),
  isNotNull: vi.fn(),
}));

// ─── Mock notification service ───────────────────────────────────────────────

vi.mock("../lib/notifications/notificationService.js", () => ({
  sendNotification: mockSendNotification,
}));

// Import subject under test AFTER mocks are declared
import { buildReviewMessage, notifyInstructorOfReview } from "./verification.js";

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: buildReviewMessage
// ─────────────────────────────────────────────────────────────────────────────

describe("buildReviewMessage", () => {
  describe("approved", () => {
    it("returns the approved title", () => {
      const { title } = buildReviewMessage("approved");
      expect(title).toBe("Your compliance application has been approved");
    });

    it("body mentions approved and Learner Log", () => {
      const { body } = buildReviewMessage("approved");
      expect(body).toContain("approved");
      expect(body).toContain("Learner Log");
    });

    it("appends reviewer notes when provided", () => {
      const { body } = buildReviewMessage("approved", "Well done, all docs look great");
      expect(body).toContain("Reviewer notes: Well done, all docs look great");
    });

    it("does not include notes line when notes are absent", () => {
      const { body } = buildReviewMessage("approved");
      expect(body).not.toContain("Reviewer notes:");
    });
  });

  describe("rejected", () => {
    it("returns the rejected title", () => {
      const { title } = buildReviewMessage("rejected");
      expect(title).toBe("Your compliance application was not approved");
    });

    it("body mentions could not be approved", () => {
      const { body } = buildReviewMessage("rejected");
      expect(body).toContain("could not be approved");
    });

    it("appends reviewer notes when provided", () => {
      const { body } = buildReviewMessage("rejected", "Missing blue card");
      expect(body).toContain("Reviewer notes: Missing blue card");
    });

    it("does not include notes line when notes are absent", () => {
      const { body } = buildReviewMessage("rejected");
      expect(body).not.toContain("Reviewer notes:");
    });
  });

  describe("needs_revision", () => {
    it("returns the needs_revision title", () => {
      const { title } = buildReviewMessage("needs_revision");
      expect(title).toBe("Your compliance application needs revision");
    });

    it("body mentions changes required", () => {
      const { body } = buildReviewMessage("needs_revision");
      expect(body).toContain("changes before it can be approved");
    });

    it("appends reviewer notes when provided", () => {
      const { body } = buildReviewMessage("needs_revision", "Please reupload your licence");
      expect(body).toContain("Reviewer notes: Please reupload your licence");
    });

    it("does not include notes line when notes are absent", () => {
      const { body } = buildReviewMessage("needs_revision");
      expect(body).not.toContain("Reviewer notes:");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests: notifyInstructorOfReview
// ─────────────────────────────────────────────────────────────────────────────

const INSTRUCTOR_ID = 42;
const VERIFICATION_ID = 7;

function makeInstructor(overrides: Record<string, unknown> = {}) {
  return {
    id: INSTRUCTOR_ID,
    userId: 99,
    email: "instructor@example.com",
    fullName: "Jane Smith",
    ...overrides,
  };
}

describe("notifyInstructorOfReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls sendNotification with approved payload and normal priority", async () => {
    mockLimit.mockResolvedValue([makeInstructor()]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "approved",
    });

    expect(mockSendNotification).toHaveBeenCalledOnce();
    const call = mockSendNotification.mock.calls[0][0];
    expect(call.userId).toBe(99);
    expect(call.email).toBe("instructor@example.com");
    expect(call.payload.type).toBe("verification_reviewed");
    expect(call.payload.title).toContain("approved");
    expect(call.payload.priority).toBe("normal");
    expect(call.channels).toEqual(["in_app", "email"]);
  });

  it("calls sendNotification with rejected payload, notes, and high priority", async () => {
    mockLimit.mockResolvedValue([makeInstructor()]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "rejected",
      notes: "Missing blue card",
    });

    expect(mockSendNotification).toHaveBeenCalledOnce();
    const call = mockSendNotification.mock.calls[0][0];
    expect(call.payload.title).toContain("not approved");
    expect(call.payload.body).toContain("Reviewer notes: Missing blue card");
    expect(call.payload.priority).toBe("high");
  });

  it("calls sendNotification with needs_revision payload, notes, and high priority", async () => {
    mockLimit.mockResolvedValue([makeInstructor()]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "needs_revision",
      notes: "Please reupload your licence",
    });

    expect(mockSendNotification).toHaveBeenCalledOnce();
    const call = mockSendNotification.mock.calls[0][0];
    expect(call.payload.title).toContain("needs revision");
    expect(call.payload.body).toContain("Reviewer notes: Please reupload your licence");
    expect(call.payload.priority).toBe("high");
  });

  it("passes verificationId as relatedId and correct relatedType", async () => {
    mockLimit.mockResolvedValue([makeInstructor()]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "approved",
    });

    const call = mockSendNotification.mock.calls[0][0];
    expect(call.payload.relatedId).toBe(VERIFICATION_ID);
    expect(call.payload.relatedType).toBe("instructor_verification");
  });

  it("does NOT call sendNotification when instructor has no userId (manual profile)", async () => {
    mockLimit.mockResolvedValue([makeInstructor({ userId: null })]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "approved",
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does NOT call sendNotification when instructor has no email", async () => {
    mockLimit.mockResolvedValue([makeInstructor({ email: null })]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "approved",
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does NOT call sendNotification when instructor record is not found", async () => {
    mockLimit.mockResolvedValue([]);

    await notifyInstructorOfReview({
      verificationId: VERIFICATION_ID,
      instructorId: INSTRUCTOR_ID,
      action: "approved",
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
