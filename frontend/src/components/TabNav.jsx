/**
 * TabNav component — adaptive tab navigation.
 * Tabs requiring missing data show a "needs data" indicator.
 */

const TABS = [
  { key: "performance", label: "My Territory", dataKey: null },
  { key: "depletions", label: "Depletions", termKey: "depletion", suffix: "s", dataKey: "depletions" },
  { key: "distributor-detail", termKey: "distributor", suffix: "s", dataKey: "distributorHealth" },
  { key: "inventory", label: "Inventory", dataKey: "inventory" },
  { key: "accounts", termKey: "account", suffix: " Insights", dataKey: "accounts" },
  { key: "opportunities", label: "Opportunities", dataKey: "opportunities" },
  { key: "reorder", label: "Reorder Forecast", dataKey: "reorder" },
  { key: "pipeline", label: "Customer Pipeline", accent: true, dataKey: "pipeline" },
  { key: "admin-settings", label: "Settings", adminOnly: true, dataKey: null },
];

export default function TabNav({
  activeTab,
  onTabChange,
  onHelpClick,
  isAdmin = false,
  terminology,
  availability,
}) {
  function getLabel(tab) {
    if (tab.termKey && terminology) {
      const term = terminology[tab.termKey];
      if (term) return term + (tab.suffix || "");
    }
    return tab.label;
  }

  return (
    <nav className="tabs" role="tablist" aria-label="Dashboard sections">
      {TABS.map((tab) => {
        if (tab.adminOnly && !isAdmin) return null;

        const isActive = activeTab === tab.key;
        const hasData = !tab.dataKey || !availability || availability[tab.dataKey];
        let className = "tab";
        if (isActive) className += " active";
        if (tab.accent) className += " tab-accent-blue";

        return (
          <button
            key={tab.key}
            className={className}
            data-tab={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            style={!hasData ? { opacity: 0.5 } : undefined}
          >
            {getLabel(tab)}
            {!hasData && (
              <span style={{
                display: "inline-block",
                width: 6, height: 6,
                borderRadius: "50%",
                background: "#d97706",
                marginLeft: 5,
                verticalAlign: "middle",
              }} title="Data required" />
            )}
          </button>
        );
      })}
      <button
        onClick={onHelpClick}
        style={{
          background: "none",
          border: "none",
          fontSize: 18,
          cursor: "pointer",
          color: "#6B7280",
          padding: "8px 12px",
          marginLeft: "auto",
        }}
        title="Help & Legend"
        aria-label="Help and Legend"
      >
        ?
      </button>
    </nav>
  );
}
