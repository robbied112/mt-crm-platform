/**
 * Header component
 * Extracted from index.html lines 1098-1108.
 * Displays the brand logo, title, and sync status indicator.
 */

import CruFolioLogo from "./CruFolioLogo";

export default function Header({ companyName, logo, syncStatus }) {
  const statusColors = {
    connected: "#1F865A",
    syncing: "#C07B01",
    offline: "#C53030",
  };

  return (
    <header role="banner" aria-label="CruFolio Dashboard Header">
      {logo ? (
        <img
          id="brandLogo"
          src={logo}
          alt={companyName || "CruFolio"}
          style={{ height: 40 }}
        />
      ) : (
        <CruFolioLogo size={40} />
      )}
      <div className="header-text">
        <h1 id="headerTitle">{companyName || "CruFolio"}</h1>
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
