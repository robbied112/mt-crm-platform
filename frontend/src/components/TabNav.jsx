/**
 * TabNav component
 * Extracted from index.html lines 1182-1193.
 * Horizontal tab navigation for the dashboard sections.
 */

const TABS = [
  { key: "performance", label: "My Territory" },
  { key: "depletions", label: "Depletions", termKey: "depletion", suffix: "s" },
  { key: "distributor-detail", label: "Distributors" },
  { key: "inventory", label: "Inventory" },
  { key: "accounts", label: "Account Insights" },
  { key: "opportunities", label: "Opportunities" },
  { key: "reorder", label: "Reorder Forecast" },
  { key: "pipeline", label: "Customer Pipeline", accent: true },
  { key: "admin-settings", label: "Settings", adminOnly: true },
];

export default function TabNav({
  activeTab,
  onTabChange,
  onHelpClick,
  isAdmin = false,
  terminology,
}) {
  // Resolve the display label, applying terminology overrides if provided
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
          >
            {getLabel(tab)}
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
