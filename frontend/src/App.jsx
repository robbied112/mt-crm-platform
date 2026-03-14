import { useState } from "react";
import "./styles/Global.css";
import {
  Header,
  FilterBar,
  TabNav,
  UserBar,
  Footer,
  MyTerritory,
  Depletions,
  DistributorHealth,
  Inventory,
  AccountInsights,
  Opportunities,
  ReorderForecast,
  CustomerPipeline,
  Settings,
  Login,
  ExecutiveSummary,
} from "./components";
import useFilters from "./hooks/useFilters";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";

function App() {
  const [activeTab, setActiveTab] = useState("performance");
  const { filters, updateFilter, clearAll } = useFilters();
  const { currentUser, logout, loading: authLoading } = useAuth();
  const {
    distScorecard,
    reorderData,
    accountsTop,
    pipelineAccounts,
    pipelineMeta,
    inventoryData,
    newWins,
    distHealth,
    reEngagementData,
    placementSummary,
    qbDistOrders,
    acctConcentration,
    tenantConfig,
    availability,
    loading: dataLoading,
    updateTenantConfig,
  } = useData();

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#64748b", fontSize: "15px" }}>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <>
      <a href="#mainContent" className="skip-link">
        Skip to main content
      </a>

      <UserBar
        user={currentUser}
        visible={!!currentUser}
        onLogout={logout}
        onManageUsers={() => {}}
      />

      <div className="container" id="mainContent" role="main">
        <Header
          companyName={tenantConfig.companyName || "Sidekick BI"}
          logo={tenantConfig.logo}
          syncStatus={dataLoading ? "syncing" : "connected"}
        />

        <ExecutiveSummary />

        <FilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onClearAll={clearAll}
          regions={Object.values(tenantConfig.regionMap || {}).filter(
            (v, i, a) => a.indexOf(v) === i
          )}
          states={Object.keys(tenantConfig.stateNames || {})}
          reps={[]}
          products={tenantConfig.productLines || []}
          distributors={[...new Set(distScorecard.map((d) => d.name))]}
          userName={currentUser?.displayName || currentUser?.email}
        />

        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onHelpClick={() => setActiveTab("admin-settings")}
          isAdmin={true}
          terminology={tenantConfig.terminology}
          availability={availability}
        />

        {/* === Tab Content Panels === */}

        {activeTab === "performance" && (
          <div id="performance" className="tab-content active">
            {!availability.hasAnyData ? (
              <WelcomeState onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <MyTerritory
                user={currentUser}
                filters={filters}
                distScorecard={distScorecard}
                reorderData={reorderData}
                accountsTop={accountsTop}
                pipelineAccounts={pipelineAccounts}
                pipelineMeta={pipelineMeta}
                qbDistOrders={qbDistOrders}
                newWins={newWins}
                recentActivity={[]}
                myAccounts={[]}
                onAccountClick={(name) =>
                  console.log("Open account panel:", name)
                }
              />
            )}
          </div>
        )}

        {activeTab === "depletions" && (
          <div id="depletions" className="tab-content active">
            {!availability.depletions ? (
              <DataRequiredState tab="Depletions" dataType="depletion report" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <Depletions
                distScorecard={distScorecard}
                filters={filters}
                user={currentUser}
                onDrillIn={(distName) => {
                  console.log("Drill into distributor:", distName);
                  setActiveTab("distributor-detail");
                }}
                onExport={() =>
                  console.log("Export scorecard — XLSX not yet wired")
                }
              />
            )}
          </div>
        )}

        {activeTab === "distributor-detail" && (
          <div id="distributor-detail" className="tab-content active">
            {!availability.distributorHealth && !availability.depletions ? (
              <DataRequiredState tab="Distributor Health" dataType="distributor inventory or depletion data" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <DistributorHealth
                distHealth={distHealth}
                distScorecard={distScorecard}
                user={currentUser}
                filters={filters}
              />
            )}
          </div>
        )}

        {activeTab === "inventory" && (
          <div id="inventory" className="tab-content active">
            {!availability.inventory ? (
              <DataRequiredState tab="Inventory" dataType="inventory report" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <Inventory
                inventoryData={inventoryData}
                warehouseInventory={null}
                filters={filters}
                user={currentUser}
                onExport={() =>
                  console.log("Export inventory — XLSX not yet wired")
                }
              />
            )}
          </div>
        )}

        {activeTab === "accounts" && (
          <div id="accounts" className="tab-content active">
            {!availability.accounts ? (
              <DataRequiredState tab="Account Insights" dataType="depletion or sales data" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <AccountInsights
                accountsTop={accountsTop}
                acctConcentration={acctConcentration}
                filters={filters}
                user={currentUser}
                onAccountClick={(name) =>
                  console.log("Open account panel:", name)
                }
                onExport={() =>
                  console.log("Export accounts — XLSX not yet wired")
                }
              />
            )}
          </div>
        )}

        {activeTab === "opportunities" && (
          <div id="opportunities" className="tab-content active">
            {!availability.opportunities ? (
              <DataRequiredState tab="Opportunities" dataType="depletion data" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <Opportunities
                reEngagementData={reEngagementData}
                newWins={newWins}
                placementSummary={placementSummary}
                filters={filters}
                user={currentUser}
                onAccountClick={(name) =>
                  console.log("Open account panel:", name)
                }
              />
            )}
          </div>
        )}

        {activeTab === "reorder" && (
          <div id="reorder" className="tab-content active">
            {!availability.reorder ? (
              <DataRequiredState tab="Reorder Forecast" dataType="purchase history with dates" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <ReorderForecast
                reorderData={reorderData}
                filters={filters}
                user={currentUser}
                onAccountClick={(name) =>
                  console.log("Open account panel:", name)
                }
                onExport={() =>
                  console.log("Export reorder — XLSX not yet wired")
                }
              />
            )}
          </div>
        )}

        {activeTab === "pipeline" && (
          <div id="pipeline" className="tab-content active">
            {!availability.pipeline ? (
              <DataRequiredState tab="Customer Pipeline" dataType="pipeline or QuickBooks data" onGoToSettings={() => setActiveTab("admin-settings")} />
            ) : (
              <CustomerPipeline
                pipelineAccounts={pipelineAccounts}
                pipelineMeta={pipelineMeta}
                user={currentUser}
                onAccountClick={(name) =>
                  console.log("Open pipeline detail:", name)
                }
                onAddNew={() => console.log("Add new pipeline account")}
                onExportCSV={() => console.log("Export CSV")}
                onExportXLSX={() => console.log("Export XLSX")}
              />
            )}
          </div>
        )}

        {activeTab === "admin-settings" && (
          <div id="admin-settings" className="tab-content active">
            <Settings
              config={tenantConfig}
              onChangePassword={() =>
                console.log("Change password — not yet wired")
              }
              onSaveBranding={(b) => updateTenantConfig(b)}
              onSaveTerminology={(t) => updateTenantConfig({ terminology: t })}
              onSaveGoals={(g) => updateTenantConfig({ goals: g })}
              onResetSettings={() =>
                console.log("Reset settings — not yet wired")
              }
              onManageBilling={() =>
                console.log("Manage billing — not yet wired")
              }
            />
          </div>
        )}

        <Footer
          companyName={tenantConfig.companyName || "Sidekick BI"}
          dataThrough={dataLoading ? "syncing..." : availability.hasAnyData ? "live" : "--"}
        />
      </div>
    </>
  );
}

// ─── Welcome State (no data yet) ───────────────────────────────

function WelcomeState({ onGoToSettings }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "60px 20px",
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>&#128202;</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
        Welcome to Sidekick BI
      </h2>
      <p style={{ fontSize: 15, color: "#64748b", maxWidth: 500, margin: "0 auto 24px" }}>
        Get started by uploading your data. Drop a distributor depletion report,
        QuickBooks export, or any sales data file and the system will
        automatically detect and map your columns.
      </p>
      <button
        className="btn btn-primary"
        style={{ padding: "12px 28px", fontSize: 15 }}
        onClick={onGoToSettings}
      >
        Upload Data in Settings
      </button>
    </div>
  );
}

// ─── Data Required State (tab needs data) ───────────────────────

function DataRequiredState({ tab, dataType, onGoToSettings }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "48px 20px",
      background: "#fffbeb",
      borderRadius: 12,
      border: "1px solid #fde68a",
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>&#128204;</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
        {tab} needs data
      </h3>
      <p style={{ fontSize: 14, color: "#78350f", maxWidth: 420, margin: "0 auto 20px" }}>
        Upload a {dataType} in Settings to populate this tab.
        The system will automatically map your columns and calculate all metrics.
      </p>
      <button
        className="btn btn-primary"
        style={{ padding: "10px 24px" }}
        onClick={onGoToSettings}
      >
        Go to Settings
      </button>
    </div>
  );
}

export default App;
