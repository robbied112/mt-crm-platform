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
            <div className="kpi-row">
              <KpiCard label="Total 13W CE" value="0" />
              <KpiCard label="4W CE" value="0" />
              <KpiCard label="Markets w/ Momentum" value="0" />
              <KpiCard label="Consistency Score" value="0%" />
            </div>
            <div className="charts-row">
              <div className="chart-container">
                <div className="chart-title">Weekly CE by Top Distributors</div>
                <div className="chart-wrapper">
                  {/* Chart.js canvas will be mounted here */}
                </div>
              </div>
              <div className="chart-container">
                <div className="chart-title">SKU Mix</div>
                <div className="chart-wrapper">
                  {/* Chart.js canvas will be mounted here */}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "distributor-detail" && (
          <div id="distributor-detail" className="tab-content active">
            <div className="section-header">
              <h3>Distributors</h3>
              <p>Distributor health and detail view — pending migration.</p>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div id="inventory" className="tab-content active">
            <div className="section-header">
              <h3>Inventory</h3>
              <p>Inventory tracking view — pending migration.</p>
            </div>
          </div>
        )}

        {activeTab === "accounts" && (
          <div id="accounts" className="tab-content active">
            <div className="section-header">
              <h3>Account Insights</h3>
              <p>Account analytics view — pending migration.</p>
            </div>
          </div>
        )}

        {activeTab === "opportunities" && (
          <div id="opportunities" className="tab-content active">
            <div className="section-header">
              <h3>Opportunities</h3>
              <p>
                Re-engagement and new win opportunities — pending migration.
              </p>
            </div>
          </div>
        )}

        {activeTab === "reorder" && (
          <div id="reorder" className="tab-content active">
            <div className="section-header">
              <h3>Reorder Forecast</h3>
              <p>Reorder prediction engine — pending migration.</p>
            </div>
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
