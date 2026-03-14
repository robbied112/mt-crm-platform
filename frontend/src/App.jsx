import { useState } from "react";
import "./styles/Global.css";
import {
  Header,
  FilterBar,
  TabNav,
  UserBar,
  Footer,
  KpiCard,
  MyTerritory,
  Depletions,
  DistributorHealth,
  Inventory,
  AccountInsights,
  Opportunities,
  ReorderForecast,
} from "./components";
import useFilters from "./hooks/useFilters";
import TENANT_CONFIG from "./config/tenant";

function App() {
  const [activeTab, setActiveTab] = useState("performance");
  const { filters, updateFilter, clearAll } = useFilters();

  // Placeholder user — will be wired to Firebase auth during migration
  const [currentUser] = useState(null);

  return (
    <>
      <a href="#mainContent" className="skip-link">
        Skip to main content
      </a>

      <UserBar
        user={currentUser}
        visible={!!currentUser}
        onLogout={() => {}}
        onManageUsers={() => {}}
      />

      <div className="container" id="mainContent" role="main">
        <Header
          companyName={TENANT_CONFIG.companyName}
          logo={TENANT_CONFIG.logo}
          syncStatus="connected"
        />

        <FilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onClearAll={clearAll}
          regions={Object.values(TENANT_CONFIG.regionMap).filter(
            (v, i, a) => a.indexOf(v) === i
          )}
          states={Object.keys(TENANT_CONFIG.stateNames)}
          reps={[]}
          products={TENANT_CONFIG.productLines}
          distributors={[]}
          userName={currentUser?.name}
        />

        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onHelpClick={() => {}}
          isAdmin={currentUser?.role === "admin"}
          terminology={TENANT_CONFIG.terminology}
        />

        {/* === Tab Content Panels === */}
        {activeTab === "performance" && (
          <div id="performance" className="tab-content active">
            <MyTerritory
              user={currentUser}
              filters={filters}
              distScorecard={[]}
              reorderData={[]}
              accountsTop={[]}
              pipelineAccounts={[]}
              pipelineMeta={{}}
              qbDistOrders={{}}
              newWins={[]}
              recentActivity={[]}
              myAccounts={[]}
              onAccountClick={(name) =>
                console.log("Open account panel:", name)
              }
            />
          </div>
        )}

        {activeTab === "depletions" && (
          <div id="depletions" className="tab-content active">
            <Depletions
              distScorecard={[]}
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
          </div>
        )}

        {activeTab === "distributor-detail" && (
          <div id="distributor-detail" className="tab-content active">
            <DistributorHealth
              distHealth={[]}
              distScorecard={[]}
              user={currentUser}
              filters={filters}
            />
          </div>
        )}

        {activeTab === "inventory" && (
          <div id="inventory" className="tab-content active">
            <Inventory
              inventoryData={[]}
              warehouseInventory={null}
              filters={filters}
              user={currentUser}
              onExport={() =>
                console.log("Export inventory — XLSX not yet wired")
              }
            />
          </div>
        )}

        {activeTab === "accounts" && (
          <div id="accounts" className="tab-content active">
            <AccountInsights
              accountsTop={[]}
              acctConcentration={{}}
              filters={filters}
              user={currentUser}
              onAccountClick={(name) =>
                console.log("Open account panel:", name)
              }
              onExport={() =>
                console.log("Export accounts — XLSX not yet wired")
              }
            />
          </div>
        )}

        {activeTab === "opportunities" && (
          <div id="opportunities" className="tab-content active">
            <Opportunities
              reEngagementData={[]}
              newWins={[]}
              placementSummary={[]}
              filters={filters}
              user={currentUser}
              onAccountClick={(name) =>
                console.log("Open account panel:", name)
              }
            />
          </div>
        )}

        {activeTab === "reorder" && (
          <div id="reorder" className="tab-content active">
            <ReorderForecast
              reorderData={[]}
              filters={filters}
              user={currentUser}
              onAccountClick={(name) =>
                console.log("Open account panel:", name)
              }
              onExport={() =>
                console.log("Export reorder — XLSX not yet wired")
              }
            />
          </div>
        )}

        {activeTab === "pipeline" && (
          <div id="pipeline" className="tab-content active">
            <div className="section-header">
              <h3>Customer Pipeline</h3>
              <p>Sales pipeline management — pending migration.</p>
            </div>
          </div>
        )}

        {activeTab === "admin-settings" && (
          <div id="admin-settings" className="tab-content active">
            <div className="section-header">
              <h3>Settings</h3>
              <p>Admin settings panel — pending migration.</p>
            </div>
          </div>
        )}

        <Footer
          companyName={TENANT_CONFIG.companyName}
          dataThrough="--"
        />
      </div>
    </>
  );
}

export default App;
