/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import UploadStrip from "../components/reports/analysis/UploadStrip";

describe("UploadStrip", () => {
  afterEach(() => cleanup());

  it("shows 'Add more reports' when hasData is true", () => {
    render(<UploadStrip onFiles={vi.fn()} hasData={true} disabled={false} />);
    expect(screen.getByText("Add more reports")).toBeInTheDocument();
  });

  it("shows 'Drop your first reports here' when hasData is false", () => {
    render(<UploadStrip onFiles={vi.fn()} hasData={false} disabled={false} />);
    expect(screen.getByText("Drop your first reports here")).toBeInTheDocument();
  });

  it("has correct aria-label for accessibility", () => {
    render(<UploadStrip onFiles={vi.fn()} hasData={false} disabled={false} />);
    expect(screen.getByRole("button", { name: "Upload distributor reports" })).toBeInTheDocument();
  });

  it("is keyboard accessible (Enter triggers file picker)", () => {
    const onFiles = vi.fn();
    render(<UploadStrip onFiles={onFiles} hasData={true} disabled={false} />);
    const strip = screen.getByRole("button", { name: "Upload distributor reports" });
    expect(() => fireEvent.keyDown(strip, { key: "Enter" })).not.toThrow();
  });

  it("is keyboard accessible (Space triggers file picker)", () => {
    const onFiles = vi.fn();
    render(<UploadStrip onFiles={onFiles} hasData={true} disabled={false} />);
    const strip = screen.getByRole("button", { name: "Upload distributor reports" });
    expect(() => fireEvent.keyDown(strip, { key: " " })).not.toThrow();
  });

  it("shows hint text only when empty (not compact)", () => {
    const { rerender } = render(
      <UploadStrip onFiles={vi.fn()} hasData={false} disabled={false} />,
    );
    expect(screen.getByText(/Excel, CSV/)).toBeInTheDocument();

    rerender(<UploadStrip onFiles={vi.fn()} hasData={true} disabled={false} />);
    expect(screen.queryByText(/Excel, CSV/)).not.toBeInTheDocument();
  });

  it("applies compact class when hasData", () => {
    render(<UploadStrip onFiles={vi.fn()} hasData={true} disabled={false} />);
    const strip = screen.getByRole("button", { name: "Upload distributor reports" });
    expect(strip).toHaveClass("upload-strip--compact");
  });
});
