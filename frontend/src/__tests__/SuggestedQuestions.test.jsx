/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SuggestedQuestions from "../components/reports/analysis/SuggestedQuestions";

describe("SuggestedQuestions", () => {
  afterEach(() => cleanup());

  it("renders questions as <button> elements", () => {
    const questions = ["Which accounts are growing?", "Best performing SKU?"];
    render(<SuggestedQuestions questions={questions} onAsk={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Which accounts are growing/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Best performing SKU/ })).toBeInTheDocument();
  });

  it("calls onAsk with question text on click", () => {
    const onAsk = vi.fn();
    const questions = ["What is my DOH?"];
    render(<SuggestedQuestions questions={questions} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole("button", { name: /What is my DOH/ }));
    expect(onAsk).toHaveBeenCalledWith("What is my DOH?");
  });

  it("handles empty questions array gracefully", () => {
    const { container } = render(<SuggestedQuestions questions={[]} onAsk={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("handles null questions gracefully", () => {
    const { container } = render(<SuggestedQuestions questions={null} onAsk={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders multiple questions", () => {
    const questions = ["Q1?", "Q2?", "Q3?"];
    render(<SuggestedQuestions questions={questions} onAsk={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });
});
