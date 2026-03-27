import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import "./styles/Global.css";
import {
  FilterBar,
  Footer,
  AIBriefing,
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
  BillbackDashboard,
  WineList,
  WineDetail,
  PricingStudio,
  SetupAssistant,
  PipelineKanban,
  PortfolioList,
  ProductDetail,
  RevenueSales,
  ExecutiveDashboard,
  JoinPage,
} from "./components";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import DataGate from "./components/DataGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { WelcomeState } from "./components/EmptyState";
import UpgradeModal from "./components/UpgradeModal";
import SubscriptionBanner from "./components/SubscriptionBanner";
import useFilters from "./hooks/useFilters";
import useSubscription from "./hooks/useSubscription";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";
import { BriefingProvider } from "./context/BriefingContext";
import { clearDemoData } from "./services/demoData";
import { deleteAllData } from "./services/firestoreService";
import { deleteAllCrmData } from "./services/crmService";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "./config/firebase";
import TENANT_CONFIG from "./config/tenant";

function App() {
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authView, setAuthView] = useState("landing"); // "landing" | "login" | "signup"
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState(null);
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
    skuBreakdown,
    spendByWine,
    spendByDistributor,
    billbackSummary,
    revenueByChannel,
    revenueByProduct,
    revenueSummary,
    arAgingSummary,
    apAgingSummary,
    budget,
    tenantConfig,
    tenantId,
    availability,
    loading: dataLoading,
    updateTenantConfig,
    updateBudget,
    refreshData,
  } = useData();

  const subscription = useSubscription();

  const openUpgradeModal = useCallback((context) => {
    setUpgradeContext(context || null);
    setUpgradeModalOpen(true);
  }, []);

  const openBillingPortal = useCallback(async () => {
    try {
      const fns = getFunctions();
      const createPortal = httpsCallable(fns, "createBillingPortalSession");
      const result = await createPortal({
        tenantId,
        origin: window.location.origin,
        returnUrl: `${window.location.origin}/settings`,
      });
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err) {
      alert("Unable to open billing portal: " + err.message);
    }
  }, [tenantId]);

  // Verify checkout session on return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true" && tenantId) {
      const sessionId = sessionStorage.getItem("pendingCheckoutSession");
      if (sessionId) {
        sessionStorage.removeItem("pendingCheckoutSession");
        const functions = getFunctions();
        const verify = httpsCallable(functions, "verifyCheckoutSession");
        verify({ tenantId, sessionId }).catch((err) => {
          console.warn("Checkout verification failed (webhook will handle it):", err.message);
        });
      }
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [tenantId]);

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

  // Join page renders outside the normal auth flow — accessible to both
  // logged-in and unauthenticated users (they can sign up inline).
  const location = useLocation();
  if (location.pathname.startsWith("/join/")) {
    return <JoinPage />;
  }

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
          onOpenUpgradeModal={openUpgradeModal}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <main className="main-content" id="mainContent">
          {/* Subscription status banner */}
          <SubscriptionBanner onUpgrade={() => openUpgradeModal()} onOpenBillingPortal={openBillingPortal} />

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
              states={[...new Set(distScorecard.map((d) => d.st).filter((s) => s && s !== "--"))].sort()}
              reps={[]}
              products={skuBreakdown.length > 0
                ? skuBreakdown.map((s) => s.sku).filter(Boolean)
                : (tenantConfig.productLines || [])
              }
              distributors={[...new Set(distScorecard.map((d) => d.name).filter(Boolean))]}
            />
          </div>

          {/* Page content */}
          <div className="page-content">
            <ErrorBoundary>
            <Routes>
              <Route
                path="/"
                element={
                  <BriefingProvider>
                    <AIBriefing />
                  </BriefingProvider>
                }
              />

              <Route
                path="/territory"
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
                      skuBreakdown={skuBreakdown}
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
                path="/revenue"
                element={
                  <DataGate dataKey="revenue" tabLabel="Revenue & Sales">
                    <RevenueSales
                      revenueByChannel={revenueByChannel}
                      revenueByProduct={revenueByProduct}
                      revenueSummary={revenueSummary}
                      budget={budget}
                      onUpdateBudget={updateBudget}
                    />
                  </DataGate>
                }
              />

              <Route
                path="/executive"
                element={
                  <ExecutiveDashboard
                    distScorecard={distScorecard}
                    inventoryData={inventoryData}
                    placementSummary={placementSummary}
                    revenueSummary={revenueSummary}
                    arAgingSummary={arAgingSummary}
                    apAgingSummary={apAgingSummary}
                  />
                }
              />

              <Route
                path="/pipeline"
                element={<PipelineKanban />}
              />

              {/* Portfolio routes */}
              <Route path="/portfolio" element={<PortfolioList />} />
              <Route path="/portfolio/:productId" element={<ProductDetail />} />

              {/* Billback routes (feature-gated) */}
              {tenantConfig?.features?.billbacks && (
                <>
                  <Route
                    path="/billbacks"
                    element={
                      <DataGate dataKey="billbacks" tabLabel="Trade Spend">
                        <BillbackDashboard
                          spendByWine={spendByWine}
                          spendByDistributor={spendByDistributor}
                          billbackSummary={billbackSummary}
                          filters={filters}
                        />
                      </DataGate>
                    }
                  />
                  <Route path="/wines" element={<WineList wines={[]} />} />
                  <Route
                    path="/wines/:wineId"
                    element={<WineDetail wines={[]} spendByWine={spendByWine} />}
                  />
                </>
              )}

              {/* Tools routes */}
              <Route path="/pricing" element={<PricingStudio />} />

              {/* Setup / Onboarding */}
              <Route path="/setup" element={<SetupAssistant />} />

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
                      onChangePassword={async () => {
                        if (!currentUser?.email) {
                          alert("No email address found for your account.");
                          return;
                        }
                        try {
                          await sendPasswordResetEmail(auth, currentUser.email);
                          alert("Password reset email sent to " + currentUser.email);
                        } catch (err) {
                          alert("Failed to send reset email: " + err.message);
                        }
                      }}
                      onSaveBranding={(b) => updateTenantConfig(b)}
                      onSaveTerminology={(t) => updateTenantConfig({ terminology: t })}
                      onSaveGoals={(g) => updateTenantConfig({ goals: g })}
                      onResetSettings={async () => {
                        if (!window.confirm("Are you sure? This will reset all settings to defaults. This cannot be undone.")) return;
                        try {
                          await updateTenantConfig({
                            userRole: TENANT_CONFIG.userRole,
                            companyName: TENANT_CONFIG.companyName,
                            logo: TENANT_CONFIG.logo,
                            primaryColor: TENANT_CONFIG.primaryColor,
                            accentColor: TENANT_CONFIG.accentColor,
                            terminology: TENANT_CONFIG.terminology,
                            goals: {},
                            pipelineStages: TENANT_CONFIG.pipelineStages,
                            channels: TENANT_CONFIG.channels,
                            tags: TENANT_CONFIG.tags,
                            features: TENANT_CONFIG.features,
                          });
                          alert("Settings have been reset to defaults.");
                          window.location.reload();
                        } catch (err) {
                          alert("Failed to reset settings: " + err.message);
                        }
                      }}
                      onDeleteAllData={async () => {
                        if (!window.confirm("Are you sure you want to delete ALL data? This includes all dashboard datasets, imports, CRM accounts, contacts, activities, tasks, opportunities, products, and upload history. This cannot be undone.")) return;
                        if (!window.confirm("This is your last chance. Type OK in the next prompt to confirm.")) return;
                        const confirmation = window.prompt("Type DELETE to permanently remove all data:");
                        if (confirmation !== "DELETE") {
                          alert("Deletion cancelled.");
                          return;
                        }
                        try {
                          await Promise.all([
                            deleteAllData(tenantId),
                            deleteAllCrmData(tenantId),
                          ]);
                          alert("All data has been deleted.");
                          window.location.reload();
                        } catch (err) {
                          alert("Failed to delete data: " + err.message);
                        }
                      }}
                      onManageBilling={() => openUpgradeModal()}
                      onOpenBillingPortal={openBillingPortal}
                    />
                  }
                />
              )}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ErrorBoundary>
          </div>

          <Footer
            companyName={tenantConfig.companyName || "CruFolio"}
            dataThrough={dataLoading ? "syncing..." : availability.hasAnyData ? "live" : "--"}
          />
        </main>
      </div>

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
      />

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentPlan={subscription.plan}
        context={upgradeContext}
      />
    </>
  );
}

export default App;
