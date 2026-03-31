/**
 * CreateTaskModal — compact modal to create a CRM task from an AI action.
 *
 * Pre-filled with action text, related account, due date = tomorrow.
 * Uses useCrm().createTask() for persistence. Focus-trapped, Escape to close.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useCrm } from "../../../context/CrmContext";
import { useAuth } from "../../../context/AuthContext";

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function CreateTaskModal({ action, onClose, onCreated }) {
  const { createTask } = useCrm();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState(action?.text || "");
  const [dueDate, setDueDate] = useState(getTomorrowDate());
  const [assignee, setAssignee] = useState(currentUser?.displayName || currentUser?.email || "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus trap + Escape handler
  useEffect(() => {
    firstInputRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'input, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await createTask({
        title,
        dueDate: dueDate || null,
        assignee: assignee || null,
        notes: notes || null,
        accountId: action?.accountId || null,
        accountName: action?.relatedAccount || null,
        source: "ai-analyst",
      });
      onCreated?.();
    } catch (err) {
      setError(err.message || "Failed to create task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [createTask, title, dueDate, assignee, notes, action, onCreated]);

  return (
    <div className="create-task-modal__backdrop" onClick={onClose}>
      <div
        className="create-task-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create task"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="create-task-modal__title">Create Task</h2>

        <form onSubmit={handleSubmit}>
          <div className="create-task-modal__field">
            <label htmlFor="task-title">Title</label>
            <input
              ref={firstInputRef}
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {action?.relatedAccount && (
            <div className="create-task-modal__field">
              <label>Related Account</label>
              <p className="create-task-modal__readonly">{action.relatedAccount}</p>
            </div>
          )}

          <div className="create-task-modal__field">
            <label htmlFor="task-due">Due Date</label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="create-task-modal__field">
            <label htmlFor="task-assignee">Assignee</label>
            <input
              id="task-assignee"
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          <div className="create-task-modal__field">
            <label htmlFor="task-notes">Notes</label>
            <textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="create-task-modal__error">{error}</p>}

          <div className="create-task-modal__actions">
            <button
              type="button"
              className="create-task-modal__btn create-task-modal__btn--cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-task-modal__btn create-task-modal__btn--submit"
              disabled={submitting || !title.trim()}
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
