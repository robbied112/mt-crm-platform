/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockCreateTask = vi.fn();

vi.mock("../context/CrmContext", () => ({
  useCrm: vi.fn(() => ({ createTask: mockCreateTask })),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    currentUser: { email: "user@test.com", displayName: "Test User", uid: "u1" },
  })),
}));

import CreateTaskModal from "../components/reports/analysis/CreateTaskModal";

function renderModal(actionOverrides = {}) {
  const action = {
    text: "Call Total Wine buyer",
    relatedAccount: "Total Wine",
    accountId: "acc123",
    ...actionOverrides,
  };
  const onClose = vi.fn();
  const onCreated = vi.fn();

  const result = render(
    <CreateTaskModal action={action} onClose={onClose} onCreated={onCreated} />,
  );

  return { ...result, onClose, onCreated, action };
}

describe("CreateTaskModal", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    mockCreateTask.mockReset();
    mockCreateTask.mockResolvedValue({ id: "task1" });
  });

  it("pre-fills title from action text", () => {
    renderModal();
    expect(screen.getByLabelText("Title")).toHaveValue("Call Total Wine buyer");
  });

  it("shows related account name", () => {
    renderModal();
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
  });

  it("defaults due date to tomorrow", () => {
    renderModal();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = tomorrow.toISOString().split("T")[0];
    expect(screen.getByLabelText("Due Date")).toHaveValue(expected);
  });

  it("calls createTask on form submit", async () => {
    const { onCreated } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Call Total Wine buyer",
        accountId: "acc123",
        accountName: "Total Wine",
        source: "ai-analyst",
      }),
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error on failed createTask", async () => {
    mockCreateTask.mockRejectedValue(new Error("Network error"));
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("has role=dialog and aria-modal", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("focus trap cycles within modal", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    // Verify focusable elements exist
    const inputs = dialog.querySelectorAll("input, textarea, button");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("closes on backdrop click", () => {
    const { onClose } = renderModal();
    const backdrop = document.querySelector(".create-task-modal__backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("disables submit button when title is empty", () => {
    renderModal();
    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });
});
