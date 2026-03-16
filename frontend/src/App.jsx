import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import "./styles/Global.css";
import {
  Header,
  FilterBar,
  Sidebar,
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
  DemoBanner,
  AccountsPage,
  AccountDetailPage,
  ContactsPage,
  ActivitiesPage,
  TasksPage,
} from "./components";
import useFilters from "./hooks/useFilters";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";
import { clearDemoData } from "./services/demoData";
import { KEY_TO_PATH } from "./config/routes";

// Analytics routes that show the filter bar
const ANALYTICS_PATHS = new Set([
  "/territory", "/depletions", "/distributor-health",
  "/inventory", "/account-insights", "/opportunities",
  "/reorder", "/pipeline",
]);

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, updateFilter, clearAll } = useFilters();
  const { currentUser, logout, isAdmin, authError, loading: authLoading } = useAuth();
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
    tenantId,
    availability,
    loading: dataLoading,
    updateTenantConfig,
    refreshData,
  } = useData();

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#64748b", fontSize: "15px" }}>Loading...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 12 }}>
        <p style={{ color: "#dc2626", fontSize: "15px" }}>{authError}</p>
        <button className="btn btn-primary" onClick={logout}>Sign Out</button>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  const showFilterBar = ANALYTICS_PATHS.has(location.pathname);
  const goSettings = () => {
    if (isAdmin) {
      navigate(KEY_TO_PATH.SETTINGS);
    }
  };

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

      <div className="app-layout">
        <Sidebar
          isAdmin={isAdmin}
          terminology={tenantConfig.terminology}
          availability={availability}
        />

        <main className="main-content" id="mainContent" role="main">
          <Header
            companyName={tenantConfig.companyName || "Sidekick BI"}
            logo={tenantConfig.logo}
            syncStatus={dataLoading ? "syncing" : "connected"}
          />

          <DemoBanner
            onGoToSettings={goSettings}
            onClearDemo={async () => {
              await clearDemoData(tenantId);
              refreshData();
            }}
          />

          <ExecutiveSummary />

          {showFilterBar && (
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
          )}

          <Routes>
            <Route path="/" element={<Navigate to="/territory" replace />} />

            <Route path="/territory" element={
              !availability.hasAnyData ? (
                <WelcomeState onGoToSettings={goSettings} />
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
                  onAccountClick={(name) => console.log("Open account panel:", name)}
                />
              )
            } />

            <Route path="/depletions" element={
              !availability.depletions ? (
                <DataRequiredState tab="Depletions" dataType="depletion report" onGoToSettings={goSettings} />
              ) : (
                <Depletions
                  distScorecard={distScorecard}
                  filters={filters}
                  user={currentUser}
                  onDrillIn={() => navigate("/distributor-health")}
                  onExport={() => console.log("Export scorecard")}
                />
              )
            } />

            <Route path="/distributor-health" element={
              !availability.distributorHealth && !availability.depletions ? (
                <DataRequiredState tab="Distributor Health" dataType="distributor inventory or depletion data" onGoToSettings={goSettings} />
              ) : (
                <DistributorHealth
                  distHealth={distHealth}
                  distScorecard={distScorecard}
                  user={currentUser}
                  filters={filters}
                />
              )
            } />

            <Route path="/inventory" element={
              !availability.inventory ? (
                <DataRequiredState tab="Inventory" dataType="inventory report" onGoToSettings={goSettings} />
              ) : (
                <Inventory
                  inventoryData={inventoryData}
                  warehouseInventory={null}
                  filters={filters}
                  user={currentUser}
                  onExport={() => console.log("Export inventory")}
                />
              )
            } />

            <Route path="/account-insights" element={
              !availability.accounts ? (
                <DataRequiredState tab="Account Insights" dataType="depletion or sales data" onGoToSettings={goSettings} />
              ) : (
                <AccountInsights
                  accountsTop={accountsTop}
                  acctConcentration={acctConcentration}
                  filters={filters}
                  user={currentUser}
                  onAccountClick={(name) => console.log("Open account panel:", name)}
                  onExport={() => console.log("Export accounts")}
                />
              )
            } />

            <Route path="/opportunities" element={
              !availability.opportunities ? (
                <DataRequiredState tab="Opportunities" dataType="depletion data" onGoToSettings={goSettings} />
              ) : (
                <Opportunities
                  reEngagementData={reEngagementData}
                  newWins={newWins}
                  placementSummary={placementSummary}
                  filters={filters}
                  user={currentUser}
                  onAccountClick={(name) => console.log("Open account panel:", name)}
                />
              )
            } />

            <Route path="/reorder" element={
              !availability.reorder ? (
                <DataRequiredState tab="Reorder Forecast" dataType="purchase history with dates" onGoToSettings={goSettings} />
              ) : (
                <ReorderForecast
                  reorderData={reorderData}
                  filters={filters}
                  user={currentUser}
                  onAccountClick={(name) => console.log("Open account panel:", name)}
                  onExport={() => console.log("Export reorder")}
                />
              )
            } />

            <Route path="/pipeline" element={
              !availability.pipeline ? (
                <DataRequiredState tab="Customer Pipeline" dataType="pipeline or QuickBooks data" onGoToSettings={goSettings} />
              ) : (
                <CustomerPipeline
                  pipelineAccounts={pipelineAccounts}
                  pipelineMeta={pipelineMeta}
                  user={currentUser}
                  onAccountClick={(name) => console.log("Open pipeline detail:", name)}
                  onAddNew={() => console.log("Add new pipeline account")}
                  onExportCSV={() => console.log("Export CSV")}
                  onExportXLSX={() => console.log("Export XLSX")}
                />
              )
            } />

            {/* CRM routes */}
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/tasks" element={<TasksPage />} />

            {isAdmin && (
              <Route path="/settings" element={
                <Settings
                  config={tenantConfig}
                  onChangePassword={() => console.log("Change password")}
                  onSaveBranding={(b) => updateTenantConfig(b)}
                  onSaveTerminology={(t) => updateTenantConfig({ terminology: t })}
                  onSaveGoals={(g) => updateTenantConfig({ goals: g })}
                  onResetSettings={() => console.log("Reset settings")}
                  onManageBilling={() => console.log("Manage billing")}
                />
              } />
            )}

            <Route path="*" element={<Navigate to="/territory" replace />} />
          </Routes>

          <Footer
            companyName={tenantConfig.companyName || "Sidekick BI"}
            dataThrough={dataLoading ? "syncing..." : availability.hasAnyData ? "live" : "--"}
          />
        </main>
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
