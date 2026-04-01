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

// Stable key for tracking created tasks (survives actions array changes)
function actionKey(action) {
  return `${action.priority || 0}:${action.text}`;
}

export default function ActionsRail({ actions }) {
  const navigate = useNavigate();
  const [taskModalAction, setTaskModalAction] = useState(null);
  const [createdTasks, setCreatedTasks] = useState(new Set());

  if (!actions?.length) {
    return (
      <div className="actions-rail actions-rail--empty">
        <p className="actions-rail__label">DO NEXT</p>
        <p className="actions-rail__empty-text">
          Upload more data for personalized recommendations on your top accounts.
        </p>
      </div>
    );
  }

  const handleTaskCreated = (key) => {
    setCreatedTasks((prev) => new Set([...prev, key]));
    setTaskModalAction(null);
  };

  return (
    <div className="actions-rail">
      <p className="actions-rail__label">DO NEXT</p>
      <ol className="actions-rail__list">
        {actions.map((action, i) => {
          const key = actionKey(action);
          return (
          <li key={key} className="actions-rail__item">
            <span className="actions-rail__badge" aria-label={`Priority ${action.priority || i + 1}`}>
              {action.priority || i + 1}
            </span>
            <div className="actions-rail__content">
              <p className="actions-rail__text">{action.text}</p>
              {action.relatedAccount && (
                <p className="actions-rail__account">{action.relatedAccount}</p>
              )}
              <div className="actions-rail__ctas">
                {createdTasks.has(key) ? (
                  <span className="actions-rail__done" aria-label="Task created">
                    &#10003; Task created
                  </span>
                ) : (
                  <button
                    className="actions-rail__cta"
                    onClick={() => setTaskModalAction({ ...action, _key: key })}
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
          );
        })}
      </ol>

      {taskModalAction && (
        <CreateTaskModal
          action={taskModalAction}
          onClose={() => setTaskModalAction(null)}
          onCreated={() => handleTaskCreated(taskModalAction._key)}
        />
      )}
    </div>
  );
}
