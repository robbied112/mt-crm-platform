import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./styles/Global.css";
import {
  FilterBar,
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
  LandingPage,
  ExecutiveSummary,
  DemoBanner,
  AccountsPage,
  AccountDetailPage,
  ContactsPage,
  ActivitiesPage,
  TasksPage,
} from "./components";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import DataGate from "./components/DataGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { WelcomeState } from "./components/EmptyState";
import useFilters from "./hooks/useFilters";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";
import { clearDemoData } from "./services/demoData";

function App() {
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authView, setAuthView] = useState("landing"); // "landing" | "login" | "signup"
  const { filters, updateFilter, clearAll } = useFilters();
  const { currentUser, logout, isAdmin, authError, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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

  // Global Cmd+K listener
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const openCommandPalette = useCallback(() => setCmdPaletteOpen(true), []);

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app-loading">
        <p style={{ color: "#dc2626", fontSize: 15 }}>{authError}</p>
        <button className="btn btn-primary" onClick={logout}>Sign Out</button>
      </div>
    );
  }

  if (!currentUser) {
    if (authView === "landing") {
      return (
        <LandingPage
          onGetStarted={() => setAuthView("signup")}
          onSignIn={() => setAuthView("login")}
        />
      );
    }
    return (
      <Login
        initialMode={authView === "signup" ? "signup" : "signin"}
        onBackToLanding={() => setAuthView("landing")}
      />
    );
  }

  const goSettings = () => {
    if (isAdmin) {
      navigate("/settings");
    }
  };

  return (
    <>
      <a href="#mainContent" className="skip-link">Skip to main content</a>

      <div className="app-layout">
        {/* Mobile hamburger */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {mobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
        )}
        <Sidebar
          onOpenCommandPalette={openCommandPalette}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <main className="main-content" id="mainContent">
          {/* Top bar */}
          <div className="topbar">
            <DemoBanner
              onGoToSettings={goSettings}
              onClearDemo={async () => {
                await clearDemoData(tenantId);
                refreshData();
              }}
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
            />
          </div>

          {/* Page content */}
          <div className="page-content">
            <ErrorBoundary>
            <Routes>
              <Route
                path="/"
                element={
                  !availability.hasAnyData ? (
                    <WelcomeState />
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
                }
              />

              <Route
                path="/depletions"
                element={
                  <DataGate dataKey="depletions" tabLabel="Depletions">
                    <Depletions
                      distScorecard={distScorecard}
                      filters={filters}
                      user={currentUser}
                      onDrillIn={(distName) => navigate("/distributors")}
                      onExport={() => console.log("Export scorecard")}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/distributors"
                element={
                  <DataGate dataKey={["distributorHealth", "depletions"]} tabLabel="Distributor Health">
                    <DistributorHealth
                      distHealth={distHealth}
                      distScorecard={distScorecard}
                      user={currentUser}
                      filters={filters}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/inventory"
                element={
                  <DataGate dataKey="inventory" tabLabel="Inventory">
                    <Inventory
                      inventoryData={inventoryData}
                      warehouseInventory={null}
                      filters={filters}
                      user={currentUser}
                      onExport={() => console.log("Export inventory")}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/account-insights"
                element={
                  <DataGate dataKey="accounts" tabLabel="Account Insights">
                    <AccountInsights
                      accountsTop={accountsTop}
                      acctConcentration={acctConcentration}
                      filters={filters}
                      user={currentUser}
                      onAccountClick={(name) => console.log("Open account panel:", name)}
                      onExport={() => console.log("Export accounts")}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/opportunities"
                element={
                  <DataGate dataKey="opportunities" tabLabel="Opportunities">
                    <Opportunities
                      reEngagementData={reEngagementData}
                      newWins={newWins}
                      placementSummary={placementSummary}
                      filters={filters}
                      user={currentUser}
                      onAccountClick={(name) => console.log("Open account panel:", name)}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/reorder"
                element={
                  <DataGate dataKey="reorder" tabLabel="Reorder Forecast">
                    <ReorderForecast
                      reorderData={reorderData}
                      filters={filters}
                      user={currentUser}
                      onAccountClick={(name) => console.log("Open account panel:", name)}
                      onExport={() => console.log("Export reorder")}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/pipeline"
                element={
                  <DataGate dataKey="pipeline" tabLabel="Customer Pipeline">
                    <CustomerPipeline
                      pipelineAccounts={pipelineAccounts}
                      pipelineMeta={pipelineMeta}
                      user={currentUser}
                      onAccountClick={(name) => console.log("Open pipeline detail:", name)}
                      onAddNew={() => console.log("Add new pipeline account")}
                      onExportCSV={() => console.log("Export CSV")}
                      onExportXLSX={() => console.log("Export XLSX")}
                    />
                  </DataGate>
                }
              />

              {/* CRM routes */}
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/tasks" element={<TasksPage />} />

              {isAdmin && (
                <Route
                  path="/settings"
                  element={
                    <Settings
                      config={tenantConfig}
                      onChangePassword={() => console.log("Change password")}
                      onSaveBranding={(b) => updateTenantConfig(b)}
                      onSaveTerminology={(t) => updateTenantConfig({ terminology: t })}
                      onSaveGoals={(g) => updateTenantConfig({ goals: g })}
                      onResetSettings={() => console.log("Reset settings")}
                      onManageBilling={() => console.log("Manage billing")}
                    />
                  }
                />
              )}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ErrorBoundary>
          </div>

          <Footer
            companyName={tenantConfig.companyName || "Sidekick BI"}
            dataThrough={dataLoading ? "syncing..." : availability.hasAnyData ? "live" : "--"}
          />
        </main>
      </div>

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
      />
    </>
  );
}

export default App;
