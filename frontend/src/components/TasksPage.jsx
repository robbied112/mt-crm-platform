/**
 * TasksPage — Task management with filters, priority, due dates.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import TaskForm from "./TaskForm";

const PRIORITY_COLORS = {
  urgent: { bg: "rgba(197, 48, 48, 0.08)", color: "#C53030" },
  high: { bg: "rgba(184, 115, 51, 0.1)", color: "#B87333" },
  medium: { bg: "rgba(192, 123, 1, 0.08)", color: "#C07B01" },
  low: { bg: "#F5EDE3", color: "#6B6B6B" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export default function TasksPage() {
  const { tasks, createTask, updateTask } = useCrm();
  const navigate = useNavigate();

  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    switch (filter) {
      case "overdue":
        return tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate && t.dueDate < today);
      case "today":
        return tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate === today);
      case "upcoming":
        return tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && (!t.dueDate || t.dueDate >= today));
      case "completed":
        return tasks.filter((t) => t.status === "completed");
      default:
        return tasks;
    }
  }, [tasks, filter, today]);

  const overdueCount = useMemo(() =>
    tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate && t.dueDate < today).length,
    [tasks, today]
  );

  const handleToggle = (task) => {
    updateTask(task.id, {
      status: task.status === "completed" ? "open" : "completed",
      completedAt: task.status === "completed" ? null : new Date().toISOString(),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Tasks</h2>
          <p className="page-subtitle">
            {tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length} open
            {overdueCount > 0 && <span style={{ color: "#C53030", marginLeft: 8 }}>{overdueCount} overdue</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Task</button>
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab${filter === tab.key ? " active" : ""}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            {tab.key === "overdue" && overdueCount > 0 && (
              <span style={{ marginLeft: 4, background: "#C53030", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="table-container">
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#6B6B6B" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u2705"}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#2E2E2E", marginBottom: 4 }}>
              {filter === "all" ? "No tasks yet" : `No ${filter} tasks`}
            </p>
            <p style={{ fontSize: 13 }}>
              {filter === "all" ? "Create your first task to start tracking follow-ups." : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Task</th>
                <th>Account</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const isOverdue = task.status !== "completed" && task.dueDate && task.dueDate < today;
                const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

                return (
                  <tr key={task.id} style={{ opacity: task.status === "completed" ? 0.6 : 1 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={task.status === "completed"}
                        onChange={() => handleToggle(task)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, textDecoration: task.status === "completed" ? "line-through" : "none" }}>
                        {task.title}
                      </div>
                      {task.description && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{task.description}</div>}
                    </td>
                    <td>
                      {task.accountId ? (
                        <span className="acct-clickable" onClick={() => navigate(`/accounts/${task.accountId}`)}>
                          {task.accountName}
                        </span>
                      ) : "--"}
                    </td>
                    <td style={{ color: isOverdue ? "#C53030" : "var(--text)", fontWeight: isOverdue ? 600 : 400 }}>
                      {task.dueDate || "--"}
                      {isOverdue && <span style={{ marginLeft: 4, fontSize: 11 }}>(overdue)</span>}
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: pc.bg, color: pc.color,
                      }}>
                        {task.priority || "medium"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${task.status === "completed" ? "badge-green" : task.status === "in_progress" ? "badge-blue" : "badge-yellow"}`}>
                        {formatLabel(task.status || "open")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <TaskForm
          onSave={createTask}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
