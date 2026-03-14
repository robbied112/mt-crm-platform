/**
 * Header component
 * Extracted from index.html lines 1098-1108.
 * Displays the brand logo, title, and sync status indicator.
 */

export default function Header({ companyName, logo, syncStatus }) {
  const statusColors = {
    connected: "#4ade80",
    syncing: "#facc15",
    offline: "#f87171",
  };

  return (
    <header role="banner" aria-label="Sidekick BI Dashboard Header">
      <img
        id="brandLogo"
        src={logo || "/logo.png"}
        alt={companyName || "Sidekick BI"}
        style={{ height: 40 }}
      />
      <div className="header-text">
        <h1 id="headerTitle">{companyName || "Sidekick BI"}</h1>
        <p>Real-time sales intelligence</p>
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          opacity: 0.9,
        }}
        aria-live="polite"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusColors[syncStatus] || statusColors.connected,
            display: "inline-block",
          }}
        />
        <span style={{ color: "#fff" }}>
          {syncStatus === "syncing"
            ? "Syncing..."
            : syncStatus === "offline"
              ? "Offline"
              : "Connected"}
        </span>
      </div>
    </header>
  );
}
