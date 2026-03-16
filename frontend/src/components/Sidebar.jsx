import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ROUTES, SECTIONS } from "../config/routes";

const STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar({ isAdmin = false, terminology, availability }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed); } catch { /* noop */ }
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  function getLabel(route) {
    if (route.termKey && terminology) {
      const term = terminology[route.termKey];
      if (term) return term + (route.termSuffix || "");
    }
    return route.label;
  }

  function hasData(route) {
    return !route.dataKey || !availability || availability[route.dataKey];
  }

  const routeEntries = Object.entries(ROUTES);

  const nav = (
    <nav className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} aria-label="Main navigation">
      <div className="sidebar__toggle">
        <button
          className="sidebar__toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "\u{25B6}" : "\u{25C0}"}
        </button>
      </div>

      {SECTIONS.map((section) => {
        const sectionRoutes = routeEntries.filter(([, r]) => r.section === section.key);
        if (section.key === "admin" && !isAdmin) return null;
        if (sectionRoutes.length === 0) return null;

        return (
          <div className="sidebar__section" key={section.key}>
            {!collapsed && (
              <div className="sidebar__section-title">{section.label}</div>
            )}
            {sectionRoutes.map(([key, route]) => {
              if (route.adminOnly && !isAdmin) return null;
              const dataAvailable = hasData(route);

              return (
                <NavLink
                  key={key}
                  to={route.path}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? " sidebar__link--active" : ""}${!dataAvailable ? " sidebar__link--dim" : ""}`
                  }
                  title={collapsed ? getLabel(route) : undefined}
                >
                  <span className="sidebar__icon">{route.icon}</span>
                  {!collapsed && (
                    <span className="sidebar__label">
                      {getLabel(route)}
                      {!dataAvailable && <span className="sidebar__dot" title="Data required" />}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="sidebar__mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        &#9776;
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="sidebar__backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop: render directly. Mobile: wrap in overlay */}
      <div className={`sidebar__wrapper${mobileOpen ? " sidebar__wrapper--open" : ""}`}>
        {nav}
      </div>
    </>
  );
}
