/**
 * BlueprintRenderer — top-level component that renders an AI-generated dashboard.
 * Loads the active blueprint, renders tab navigation, global filters, and the active tab.
 */
import { useBlueprint } from "../../context/BlueprintContext";
import TabRenderer from "./TabRenderer";
import BlueprintFilterBar from "./BlueprintFilterBar";

export default function BlueprintRenderer() {
  const {
    blueprint,
    loading,
    activeTab,
    setActiveTab,
    hasBlueprint,
  } = useBlueprint();

  if (loading) {
    return (
      <div className="blueprint-loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!hasBlueprint) {
    return (
      <div className="blueprint-empty">
        <h2>No AI Dashboard Yet</h2>
        <p>Upload your data files and the AI will automatically generate a customized dashboard with charts, tables, and insights.</p>
      </div>
    );
  }

  const tabs = blueprint.tabs || [];
  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="blueprint-dashboard">
      <div className="blueprint-header">
        <h1 className="blueprint-title">{blueprint.name || "Dashboard"}</h1>
        {blueprint.generatedBy === "ai" && (
          <span className="blueprint-badge">AI Generated</span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="blueprint-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`blueprint-tab ${tab.id === activeTab ? "blueprint-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Filters */}
      <BlueprintFilterBar />

      {/* Active Tab Content */}
      {currentTab && <TabRenderer tab={currentTab} />}
    </div>
  );
}
