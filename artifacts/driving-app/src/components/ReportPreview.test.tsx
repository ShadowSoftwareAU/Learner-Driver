/**
 * Smoke tests: ReportPreview renders lesson notes correctly.
 *
 * Verifies that confidenceNote and focusAreasNext from the assessment object
 * appear in the rendered output verbatim — including multi-line text,
 * special characters, and the null-fallback italic placeholder.
 *
 * AssessmentRouteMap (Leaflet) is mocked because Leaflet requires a real DOM
 * with canvas support that happy-dom does not provide.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Leaflet CSS causes parse errors outside a browser — silence it.
vi.mock("leaflet/dist/leaflet.css", () => ({}));

// AssessmentRouteMap wraps react-leaflet which needs a real canvas.
vi.mock("@/components/AssessmentRouteMap", () => ({
  default: () => React.createElement("div", { "data-testid": "route-map-stub" }),
}));

// Import subject AFTER mocks are declared.
import { ReportPreview } from "@/components/ReportPreview";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeAssessment(overrides: Partial<React.ComponentProps<typeof ReportPreview>["assessment"]> = {}) {
  return {
    id: 42,
    studentName: "Alex Learner",
    instructorName: "Jane Instructor",
    lessonDate: "2025-06-01",
    durationMinutes: 60,
    status: "completed",
    assessmentType: "qsafe",
    pedalOperator: "student",
    confidenceNote: null,
    focusAreasNext: null,
    finalizationStatus: "draft",
    approvedAt: null,
    approvedByUserId: null,
    reportDispatchedAt: null,
    reportDispatchedTo: null,
    maneuverResults: [],
    routePath: null,
    weatherCondition: null,
    lightingCondition: null,
    ...overrides,
  } satisfies React.ComponentProps<typeof ReportPreview>["assessment"];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportPreview — lesson notes rendering", () => {
  it("renders confidenceNote text in the document", () => {
    const note = "Strong lane discipline today. Confidence improving steadily.";
    render(<ReportPreview assessment={makeAssessment({ confidenceNote: note })} />);
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it("renders focusAreasNext text in the document", () => {
    const focus = "Work on mirror checks before lane changes.";
    render(<ReportPreview assessment={makeAssessment({ focusAreasNext: focus })} />);
    expect(screen.getByText(focus)).toBeInTheDocument();
  });

  it("renders both note fields when both are provided", () => {
    const note = "Great session overall.";
    const focus = "Speed management on residential streets.";
    render(<ReportPreview assessment={makeAssessment({ confidenceNote: note, focusAreasNext: focus })} />);
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText(focus)).toBeInTheDocument();
  });

  it("renders the fallback placeholder when confidenceNote is null", () => {
    render(<ReportPreview assessment={makeAssessment({ confidenceNote: null })} />);
    expect(screen.getByText("No notes provided.")).toBeInTheDocument();
  });

  it("renders the fallback placeholder when focusAreasNext is null", () => {
    render(<ReportPreview assessment={makeAssessment({ focusAreasNext: null })} />);
    expect(screen.getByText("No focus areas provided.")).toBeInTheDocument();
  });

  it("does not truncate long confidenceNote text", () => {
    // 400 chars — well within the 5 000-char DB limit but long enough to catch
    // any substring clipping in the component
    const longNote = "Observation. ".repeat(30).trim(); // ~390 chars
    render(<ReportPreview assessment={makeAssessment({ confidenceNote: longNote })} />);
    // The full string must appear somewhere in the DOM
    expect(screen.getByText(longNote)).toBeInTheDocument();
  });

  it("preserves multi-line notes via whitespace-pre-wrap (newlines remain in DOM text)", () => {
    const multiLine = "First observation.\nSecond observation.\n\nSummary paragraph.";
    const { container } = render(
      <ReportPreview assessment={makeAssessment({ confidenceNote: multiLine })} />
    );
    // The element that renders notes has whitespace-pre-wrap so \n must be in text content
    const noteEl = container.querySelector(".whitespace-pre-wrap");
    expect(noteEl).not.toBeNull();
    expect(noteEl!.textContent).toContain("First observation.");
    expect(noteEl!.textContent).toContain("Second observation.");
    expect(noteEl!.textContent).toContain("Summary paragraph.");
    // Newlines must not have been stripped
    expect(noteEl!.textContent).toContain("\n");
  });

  it("renders HTML-like characters without double-escaping", () => {
    // React handles escaping inside JSX; the component must not pre-escape the
    // string before passing it to the text node.
    const rawNote = "Student asked: <can I merge here?> & \"Yes,\" said instructor.";
    render(<ReportPreview assessment={makeAssessment({ confidenceNote: rawNote })} />);
    // getByText does an exact DOM text match — double-escaping would cause a mismatch
    expect(screen.getByText(rawNote)).toBeInTheDocument();
  });

  it("renders the finalization status badge label", () => {
    render(<ReportPreview assessment={makeAssessment({ finalizationStatus: "dispatched" })} />);
    expect(screen.getByText("Report Dispatched")).toBeInTheDocument();
  });

  it("shows updated notes after an edit (simulates post-PATCH GET response)", () => {
    // Simulate what the detail page does: receive a fresh assessment from GET
    // after the instructor edits notes, then render ReportPreview with it.
    const original = makeAssessment({ confidenceNote: "Old note.", focusAreasNext: "Old focus." });
    const { rerender } = render(<ReportPreview assessment={original} />);
    expect(screen.getByText("Old note.")).toBeInTheDocument();

    // Instructor edits via the dialog; query is invalidated; ReportPreview receives
    // the new assessment object from the refreshed GET response.
    const updated = makeAssessment({
      confidenceNote: "Updated note after edit.",
      focusAreasNext: "Updated focus after edit.",
    });
    rerender(<ReportPreview assessment={updated} />);

    expect(screen.getByText("Updated note after edit.")).toBeInTheDocument();
    expect(screen.getByText("Updated focus after edit.")).toBeInTheDocument();
    // Old text must no longer be in the document
    expect(screen.queryByText("Old note.")).not.toBeInTheDocument();
    expect(screen.queryByText("Old focus.")).not.toBeInTheDocument();
  });
});
