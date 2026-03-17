/**
 * UserBar component
 * Extracted from index.html lines 1055-1060.
 * Floating bar in the top-right showing the logged-in user with manage/logout actions.
 */

export default function UserBar({
  user,
  onManageUsers,
  onLogout,
  visible = false,
}) {
  if (!visible || !user) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 16,
        zIndex: 100,
        background: "#fff",
        borderRadius: 20,
        padding: "4px 14px 4px 10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e5e7eb",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#0F766E",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {user.initials || "?"}
      </div>
      <span style={{ fontWeight: 600, color: "#2E2E2E" }}>
        {user.name || "--"}
      </span>
      {onManageUsers && (
        <button
          onClick={onManageUsers}
          style={{
            background: "none",
            border: "none",
            color: "#6B6B6B",
            fontSize: 13,
            cursor: "pointer",
            padding: "2px 4px",
          }}
          title="Manage Users"
        >
          &#9881;
        </button>
      )}
      <button
        onClick={onLogout}
        style={{
          background: "none",
          border: "none",
          color: "#9ca3af",
          fontSize: 11,
          cursor: "pointer",
          padding: "2px 6px",
        }}
      >
        Logout
      </button>
    </div>
  );
}
