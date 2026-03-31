/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AnalysisSkeleton from "../components/reports/analysis/AnalysisSkeleton";

describe("AnalysisSkeleton", () => {
  afterEach(() => cleanup());

  it("renders fallback steps when no steps provided", () => {
    render(<AnalysisSkeleton steps={[]} />);
    expect(screen.getByText("Reading files...")).toBeInTheDocument();
    expect(screen.getByText("Detecting data type")).toBeInTheDocument();
    expect(screen.getByText("Finding patterns across your accounts...")).toBeInTheDocument();
    expect(screen.getByText("Building charts and writing your briefing")).toBeInTheDocument();
  });

  it("renders custom steps when provided", () => {
    const steps = [
      { label: "Step A", done: true, active: false },
      { label: "Step B", done: false, active: true },
    ];
    render(<AnalysisSkeleton steps={steps} />);
    expect(screen.getByText("Step A")).toBeInTheDocument();
    expect(screen.getByText("Step B")).toBeInTheDocument();
  });

  it("applies done class to completed steps", () => {
    const steps = [
      { label: "Done step", done: true, active: false },
      { label: "Pending step", done: false, active: false },
    ];
    render(<AnalysisSkeleton steps={steps} />);
    const doneItem = screen.getByText("Done step").closest("li");
    expect(doneItem).toHaveClass("analysis-skeleton__step--done");
  });

  it("applies active class to current step", () => {
    const steps = [
      { label: "Active step", done: false, active: true },
    ];
    render(<AnalysisSkeleton steps={steps} />);
    const activeItem = screen.getByText("Active step").closest("li");
    expect(activeItem).toHaveClass("analysis-skeleton__step--active");
  });

  it("shows checkmark for done steps", () => {
    const steps = [{ label: "Completed", done: true, active: false }];
    render(<AnalysisSkeleton steps={steps} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("has role=status for a11y", () => {
    render(<AnalysisSkeleton steps={[]} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
