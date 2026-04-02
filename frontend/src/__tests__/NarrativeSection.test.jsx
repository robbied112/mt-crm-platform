/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import NarrativeSection, {
  parseNarrative,
  parseMetrics,
  formatRelativeTime,
} from "../components/reports/analysis/NarrativeSection";

describe("NarrativeSection", () => {
  afterEach(() => cleanup());

  it("renders hook line with correct styling class", () => {
    const narrative = {
      segments: [
        { type: "text", content: "California depletions surged this quarter." },
      ],
    };
    render(<NarrativeSection narrative={narrative} />);
    const hook = screen.getByText("California depletions surged this quarter.");
    expect(hook.closest("h1")).toHaveClass("narrative-section__hook");
  });

  it("renders body segments after hook line", () => {
    const narrative = {
      segments: [
        { type: "text", content: "Hook line here." },
        { type: "text", content: "Body paragraph one." },
        { type: "text", content: "Body paragraph two." },
      ],
    };
    render(<NarrativeSection narrative={narrative} />);
    expect(screen.getByText("Body paragraph one.")).toBeInTheDocument();
    expect(screen.getByText("Body paragraph two.")).toBeInTheDocument();
  });

  it("parses **bold** markers into <strong> elements", () => {
    const narrative = {
      segments: [
        { type: "text", content: "Check **Total Wine** for reorder." },
      ],
    };
    render(<NarrativeSection narrative={narrative} />);
    const strong = screen.getByText("Total Wine");
    expect(strong.tagName).toBe("STRONG");
  });

  it("parses +47% as positive metric pill", () => {
    const narrative = {
      segments: [{ type: "text", content: "Depletions up +47% this month." }],
    };
    render(<NarrativeSection narrative={narrative} />);
    const pill = screen.getByText("+47%");
    expect(pill).toHaveClass("metric-pill--positive");
  });

  it("parses -12% as negative metric pill", () => {
    const narrative = {
      segments: [{ type: "text", content: "Volume down -12% in Texas." }],
    };
    render(<NarrativeSection narrative={narrative} />);
    const pill = screen.getByText("-12%");
    expect(pill).toHaveClass("metric-pill--negative");
  });

  it("parses '38 DOH' as neutral metric pill", () => {
    const narrative = {
      segments: [{ type: "text", content: "Inventory sits at 38 DOH overall." }],
    };
    render(<NarrativeSection narrative={narrative} />);
    const pill = screen.getByText("38 DOH");
    expect(pill).toHaveClass("metric-pill--neutral");
  });

  it("falls back to plain text when no markers", () => {
    const narrative = {
      segments: [{ type: "text", content: "Simple narrative text." }],
    };
    render(<NarrativeSection narrative={narrative} />);
    expect(screen.getByText("Simple narrative text.")).toBeInTheDocument();
  });

  it("handles malformed markdown gracefully (no crash)", () => {
    const narrative = {
      segments: [{ type: "text", content: "This has ** open bold and no close." }],
    };
    // Should not throw
    expect(() => render(<NarrativeSection narrative={narrative} />)).not.toThrow();
    expect(screen.getByText(/This has/)).toBeInTheDocument();
  });

  it("renders empty state for empty segments", () => {
    render(<NarrativeSection narrative={{ segments: [] }} />);
    expect(screen.getByText(/still processing/)).toBeInTheDocument();
  });

  it("renders empty state for null narrative", () => {
    render(<NarrativeSection narrative={null} />);
    expect(screen.getByText(/still processing/)).toBeInTheDocument();
  });

  it("shows timestamp with relative time", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const narrative = {
      segments: [{ type: "text", content: "Hook." }],
    };
    render(<NarrativeSection narrative={narrative} updatedAt={tenMinutesAgo} />);
    expect(screen.getByText(/Updated 10m ago/)).toBeInTheDocument();
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent timestamps", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("returns null for null input", () => {
    expect(formatRelativeTime(null)).toBeNull();
  });

  it("handles Firestore-style timestamp with toDate()", () => {
    const fakeTimestamp = { toDate: () => new Date(Date.now() - 120000) };
    expect(formatRelativeTime(fakeTimestamp)).toBe("2m ago");
  });
});
