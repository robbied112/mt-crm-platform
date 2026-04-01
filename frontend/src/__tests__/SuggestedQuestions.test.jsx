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

  it("renders input and submit for empty questions", () => {
    render(<SuggestedQuestions questions={[]} onAsk={vi.fn()} />);
    expect(screen.getByPlaceholderText(/type your own/i)).toBeInTheDocument();
  });

  it("renders input and submit for null questions", () => {
    render(<SuggestedQuestions questions={null} onAsk={vi.fn()} />);
    expect(screen.getByPlaceholderText(/type your own/i)).toBeInTheDocument();
  });

  it("renders question buttons plus custom input", () => {
    const questions = ["Q1?", "Q2?", "Q3?"];
    render(<SuggestedQuestions questions={questions} onAsk={vi.fn()} />);

    // 3 question buttons + 1 submit button
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("submits custom question via input", () => {
    const onAsk = vi.fn();
    render(<SuggestedQuestions questions={[]} onAsk={onAsk} />);

    const input = screen.getByPlaceholderText(/type your own/i);
    fireEvent.change(input, { target: { value: "Custom question?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask question/i }));
    expect(onAsk).toHaveBeenCalledWith("Custom question?");
  });
});
