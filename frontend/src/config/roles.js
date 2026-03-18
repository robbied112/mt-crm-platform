/**
 * Role definitions — single source of truth for team role capabilities.
 *
 * Used by: usePermissions (frontend), joinTeam Cloud Function (backend).
 *
 * Role hierarchy: admin > manager > rep > viewer
 */

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  REP: "rep",
  VIEWER: "viewer",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.MANAGER]: "Manager",
  [ROLES.REP]: "Rep",
  [ROLES.VIEWER]: "Viewer",
};

export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: "Full access — manage team, settings, and all data",
  [ROLES.MANAGER]: "Manage accounts and reps, view all territories",
  [ROLES.REP]: "Manage assigned accounts within your territory",
  [ROLES.VIEWER]: "View-only access to dashboards and reports",
};

/**
 * Role badge colors — calibrated to DESIGN.md palette.
 *   Admin:   Deep Burgundy (authority, brand primary)
 *   Manager: Warm Copper (secondary emphasis)
 *   Rep:     Success green (active, doing the work)
 *   Viewer:  Warm Slate (neutral, read-only)
 */
export const ROLE_COLORS = {
  [ROLES.ADMIN]: "#6B1E1E",
  [ROLES.MANAGER]: "#B87333",
  [ROLES.REP]: "#1F865A",
  [ROLES.VIEWER]: "#6B6B6B",
};

/**
 * Capability matrix — what each role can do.
 * Used by usePermissions() hook to derive boolean flags.
 */
export const ROLE_CAPABILITIES = {
  [ROLES.ADMIN]: {
    canWrite: true,
    canManageTeam: true,
    canAccessSettings: true,
    canViewAllTerritories: true,
    canAssignAccounts: true,
    canImportData: true,
    canDeleteData: true,
    canManageBilling: true,
  },
  [ROLES.MANAGER]: {
    canWrite: true,
    canManageTeam: false,
    canAccessSettings: false,
    canViewAllTerritories: true,
    canAssignAccounts: true,
    canImportData: true,
    canDeleteData: false,
    canManageBilling: false,
  },
  [ROLES.REP]: {
    canWrite: true,
    canManageTeam: false,
    canAccessSettings: false,
    canViewAllTerritories: false,
    canAssignAccounts: false,
    canImportData: false,
    canDeleteData: false,
    canManageBilling: false,
  },
  [ROLES.VIEWER]: {
    canWrite: false,
    canManageTeam: false,
    canAccessSettings: false,
    canViewAllTerritories: false,
    canAssignAccounts: false,
    canImportData: false,
    canDeleteData: false,
    canManageBilling: false,
  },
};

/**
 * Ordered list of roles for display (highest to lowest authority).
 */
export const ROLES_ORDERED = [ROLES.ADMIN, ROLES.MANAGER, ROLES.REP, ROLES.VIEWER];
