/**
 * usePermissions — single source of truth for current user's capabilities.
 *
 * Derives boolean permission flags from the user's role.
 * Defaults to viewer (most restrictive) if role is missing.
 */

import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { ROLES, ROLE_CAPABILITIES, ROLE_LABELS, ROLE_COLORS } from "../config/roles";

export default function usePermissions() {
  const { userRole } = useAuth();

  return useMemo(() => {
    const role = userRole || ROLES.VIEWER;
    const capabilities = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES[ROLES.VIEWER];

    return {
      role,
      roleLabel: ROLE_LABELS[role] || "Viewer",
      roleColor: ROLE_COLORS[role] || ROLE_COLORS[ROLES.VIEWER],
      ...capabilities,
    };
  }, [userRole]);
}
