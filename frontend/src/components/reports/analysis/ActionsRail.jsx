/**
 * ActionsRail — numbered priority actions from AI analysis.
 *
 * Each action has a priority badge, text, and CTA buttons:
 * - "Create Task" always shown, opens CreateTaskModal
 * - "View Account" shown only when accountId exists
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateTaskModal from "./CreateTaskModal";

export default function ActionsRail({ actions }) {
  const navigate = useNavigate();
  const [taskModalAction, setTaskModalAction] = useState(null);
  const [createdTasks, setCreatedTasks] = useState(new Set());

  if (!actions?.length) return null;

  const handleTaskCreated = (actionIndex) => {
    setCreatedTasks((prev) => new Set([...prev, actionIndex]));
    setTaskModalAction(null);
  };

  return (
    <div className="actions-rail">
      <p className="actions-rail__label">DO NEXT</p>
      <ol className="actions-rail__list">
        {actions.map((action, i) => (
          <li key={i} className="actions-rail__item">
            <span className="actions-rail__badge" aria-label={`Priority ${action.priority || i + 1}`}>
              {action.priority || i + 1}
            </span>
            <div className="actions-rail__content">
              <p className="actions-rail__text">{action.text}</p>
              {action.relatedAccount && (
                <p className="actions-rail__account">{action.relatedAccount}</p>
              )}
              <div className="actions-rail__ctas">
                {createdTasks.has(i) ? (
                  <span className="actions-rail__done" aria-label="Task created">
                    &#10003; Task created
                  </span>
                ) : (
                  <button
                    className="actions-rail__cta"
                    onClick={() => setTaskModalAction({ ...action, _index: i })}
                    type="button"
                  >
                    Create Task &rarr;
                  </button>
                )}
                {action.accountId && (
                  <button
                    className="actions-rail__cta actions-rail__cta--secondary"
                    onClick={() => navigate(`/accounts/${action.accountId}`)}
                    type="button"
                  >
                    View Account &rarr;
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {taskModalAction && (
        <CreateTaskModal
          action={taskModalAction}
          onClose={() => setTaskModalAction(null)}
          onCreated={() => handleTaskCreated(taskModalAction._index)}
        />
      )}
    </div>
  );
}
