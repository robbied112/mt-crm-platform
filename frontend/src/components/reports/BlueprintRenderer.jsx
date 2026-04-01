/**
 * BlueprintRenderer — top-level component that renders an AI-generated dashboard.
 * Loads the active blueprint, renders tab navigation, global filters, and the active tab.
 */
import { useBlueprint } from "../../context/BlueprintContext";
import TabRenderer from "./TabRenderer";
import BlueprintFilterBar from "./BlueprintFilterBar";

function DataDiagnostic({ blueprint }) {
  const sources = blueprint?.dataSources || [];
  const tabs = blueprint?.tabs || [];
  const sectionCount = tabs.reduce((sum, t) => sum + (t.sections?.length || 0), 0);

  return (
    <div className="blueprint-diagnostic">
      <p className="blueprint-diagnostic__title">Dashboard generated but some sections may be empty</p>
      <p className="blueprint-diagnostic__detail">
        {sources.length > 0
          ? `We read ${sources.length} file${sources.length > 1 ? "s" : ""} (${sources.map((s) => s.fileName).join(", ")}) and created ${tabs.length} tab${tabs.length > 1 ? "s" : ""} with ${sectionCount} sections.`
          : "No data sources detected."
        }
        {" "}If charts show "No data available," your file headers may not match the expected format. Try re-uploading or check that your file has columns like Account, Distributor, Cases/Units, and State.
      </p>
    </div>
  );
}

export default function BlueprintRenderer() {
  const {
    blueprint,
    computedData,
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

  // Check if the active tab's computed data appears mostly empty
  const tabComputed = computedData[activeTab];
  const hasComputedData = tabComputed?.sections && Object.values(tabComputed.sections).some(
    (s) => Array.isArray(s) ? s.length > 0 : s != null
  );

  return (
    <div className="blueprint-dashboard">
      <div className="blueprint-header">
        <h1 className="blueprint-title">{blueprint.name || "Dashboard"}</h1>
        {blueprint.generatedBy === "ai" && (
          <span className="blueprint-badge">AI Generated</span>
        )}
        {blueprint.generatedBy === "template" && (
          <span className="blueprint-badge blueprint-badge--template">Template</span>
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

      {/* Diagnostic hint when tab data appears empty */}
      {tabComputed && !hasComputedData && <DataDiagnostic blueprint={blueprint} />}

      {/* Active Tab Content */}
      {currentTab && <TabRenderer tab={currentTab} />}
    </div>
  );
}
