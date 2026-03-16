/**
 * Sidebar — collapsible vertical navigation replacing the old TabNav.
 * Inspired by Linear/HubSpot: icons + labels, sections, user menu at bottom.
 */

import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROUTES } from "../config/routes";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

const ICONS = {
  territory: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M8 3v14" />
    </svg>
  ),
  depletions: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16V8M8 16V4M12 16V10M16 16V6" />
    </svg>
  ),
  distributors: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17V5a2 2 0 012-2h10a2 2 0 012 2v12" />
      <path d="M7 8h6M7 11h4" />
      <path d="M1 17h18" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12l1 4H3l1-4z" />
      <rect x="3" y="8" width="14" height="9" rx="1" />
      <path d="M8 11h4" />
    </svg>
  ),
  accounts: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  ),
  opportunities: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" />
    </svg>
  ),
  reorder: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  ),
  pipeline: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h16l-3 5 3 5H2l3-5-3-5z" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4" />
    </svg>
  ),
  // Tools icons
  pricing: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v16M6 6l8 8M14 6l-8 8" />
      <circle cx="10" cy="10" r="7" />
    </svg>
  ),
  // CRM icons
  crmAccounts: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 8h6M7 11h4" />
    </svg>
  ),
  contacts: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="13" cy="7" r="2.5" />
      <path d="M2 16c0-2.5 2-4.5 5-4.5s5 2 5 4.5" />
      <path d="M13 11.5c2 0 4 1.5 4 4.5" />
    </svg>
  ),
  activities: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v12M4 8h8M4 12h6" />
      <circle cx="14" cy="6" r="2" />
    </svg>
  ),
  tasks: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 10l2 2 4-4" />
    </svg>
  ),
  // Billback icons
  billbacks: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <path d="M7 6h6M7 9h6M7 12h4" />
      <path d="M12 14l2-2-2-2" />
    </svg>
  ),
  wines: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2h6l1 6c0 2.2-1.8 4-4 4s-4-1.8-4-4l1-6z" />
      <path d="M10 12v4M7 16h6" />
    </svg>
  ),
};

export default function Sidebar({ onOpenCommandPalette, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const { currentUser, logout, isAdmin } = useAuth();
  const { availability, tenantConfig, loading: dataLoading } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", collapsed); } catch {}
  }, [collapsed]);

  // Keyboard shortcut: [ to toggle
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const getLabel = (route) => {
    if (route.termKey && tenantConfig?.terminology) {
      const term = tenantConfig.terminology[route.termKey];
      if (term) return term + (route.suffix || "");
    }
    return route.label;
  };

  const hasData = (route) => {
    if (!route.dataKey) return true;
    return availability?.[route.dataKey];
  };

  const user = currentUser;

  // Split routes into sections
  const mainRoutes = ROUTES.filter((r) => !r.adminOnly && !r.section);
  const toolsRoutes = ROUTES.filter((r) => r.section === "tools");
  const crmRoutes = ROUTES.filter((r) => r.section === "crm");
  const billbackRoutes = ROUTES.filter((r) => r.section === "billbacks");
  const adminRoutes = ROUTES.filter((r) => r.adminOnly);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}>
      {/* Brand */}
      <div className="sidebar__brand">
        <img
          src={tenantConfig?.logo || "/logo.png"}
          alt={tenantConfig?.companyName || "Sidekick BI"}
          className="sidebar__logo"
        />
        {!collapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">
              {tenantConfig?.companyName || "Sidekick BI"}
            </span>
            <span className="sidebar__brand-status">
              <span
                className="sidebar__status-dot"
                style={{ background: dataLoading ? "#facc15" : "#4ade80" }}
              />
              {dataLoading ? "Syncing" : "Connected"}
            </span>
          </div>
        )}
        <button
          className="sidebar__collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar [" : "Collapse sidebar ["}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {collapsed
              ? <><path d="M6 4l4 4-4 4" /></>
              : <><path d="M10 4l-4 4 4 4" /></>
            }
          </svg>
        </button>
      </div>

      {/* Search trigger */}
      <button
        className="sidebar__search"
        onClick={onOpenCommandPalette}
        title="Search (⌘K)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        {!collapsed && (
          <>
            <span className="sidebar__search-text">Search</span>
            <kbd className="sidebar__search-kbd">⌘K</kbd>
          </>
        )}
      </button>

      {/* Nav links */}
      <nav className="sidebar__nav">
        <div className="sidebar__nav-section">
          {!collapsed && <span className="sidebar__section-label">Analytics</span>}
          {mainRoutes.map((route) => (
            <NavLink
              key={route.key}
              to={route.path}
              end={route.path === "/"}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""} ${route.accent ? "sidebar__link--accent" : ""}`
              }
              title={collapsed ? getLabel(route) : undefined}
              onClick={onMobileClose}
            >
              <span className="sidebar__link-icon">{ICONS[route.icon]}</span>
              {!collapsed && (
                <>
                  <span className="sidebar__link-label">{getLabel(route)}</span>
                  {!hasData(route) && (
                    <span className="sidebar__link-dot" title="Needs data" />
                  )}
                </>
              )}
              {collapsed && !hasData(route) && (
                <span className="sidebar__link-dot sidebar__link-dot--collapsed" title="Needs data" />
              )}
            </NavLink>
          ))}
        </div>

        {toolsRoutes.length > 0 && (
          <div className="sidebar__nav-section">
            {!collapsed && <span className="sidebar__section-label">Tools</span>}
            {toolsRoutes.map((route) => (
              <NavLink
                key={route.key}
                to={route.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                }
                title={collapsed ? getLabel(route) : undefined}
                onClick={onMobileClose}
              >
                <span className="sidebar__link-icon">{ICONS[route.icon]}</span>
                {!collapsed && <span className="sidebar__link-label">{getLabel(route)}</span>}
              </NavLink>
            ))}
          </div>
        )}

        <div className="sidebar__nav-section">
          {!collapsed && <span className="sidebar__section-label">CRM</span>}
          {crmRoutes.map((route) => (
            <NavLink
              key={route.key}
              to={route.path}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
              }
              title={collapsed ? getLabel(route) : undefined}
              onClick={onMobileClose}
            >
              <span className="sidebar__link-icon">{ICONS[route.icon]}</span>
              {!collapsed && <span className="sidebar__link-label">{getLabel(route)}</span>}
            </NavLink>
          ))}
        </div>

        {tenantConfig?.features?.billbacks && billbackRoutes.length > 0 && (
          <div className="sidebar__nav-section">
            {!collapsed && <span className="sidebar__section-label">Trade Spend</span>}
            {billbackRoutes.map((route) => (
              <NavLink
                key={route.key}
                to={route.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                }
                title={collapsed ? getLabel(route) : undefined}
                onClick={onMobileClose}
              >
                <span className="sidebar__link-icon">{ICONS[route.icon]}</span>
                {!collapsed && (
                  <>
                    <span className="sidebar__link-label">{getLabel(route)}</span>
                    {!hasData(route) && (
                      <span className="sidebar__link-dot" title="Needs data" />
                    )}
                  </>
                )}
                {collapsed && !hasData(route) && (
                  <span className="sidebar__link-dot sidebar__link-dot--collapsed" title="Needs data" />
                )}
              </NavLink>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="sidebar__nav-section">
            {!collapsed && <span className="sidebar__section-label">Admin</span>}
            {adminRoutes.map((route) => (
              <NavLink
                key={route.key}
                to={route.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                }
                title={collapsed ? getLabel(route) : undefined}
                onClick={onMobileClose}
              >
                <span className="sidebar__link-icon">{ICONS[route.icon]}</span>
                {!collapsed && <span className="sidebar__link-label">{getLabel(route)}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="sidebar__user">
        <div className="sidebar__user-info" onClick={isAdmin ? () => navigate("/settings") : undefined} role={isAdmin ? "button" : undefined} tabIndex={isAdmin ? 0 : undefined} style={isAdmin ? { cursor: "pointer" } : undefined}>
          <div className="sidebar__avatar">
            {(user?.displayName || user?.email || "?").split(/[\s@]/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?"}
          </div>
          {!collapsed && (
            <div className="sidebar__user-text">
              <span className="sidebar__user-name">{user?.displayName || user?.email?.split("@")[0] || "User"}</span>
              <span className="sidebar__user-role">{isAdmin ? "Admin" : "Rep"}</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="sidebar__logout" onClick={logout} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M10 12l4-4-4-4M14 8H6" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
