/**
 * Territory matching utilities
 * Extracted from index.html matchesUserTerritory() (line 3317).
 */

import TENANT_CONFIG from "../config/tenant";

/**
 * Check if a state falls within a user's assigned territory.
 * Admins and users with 'all' territory see everything.
 * @param {string} state - State abbreviation to check
 * @param {object|null} user - Current user object with { role, territory }
 * @returns {boolean}
 */
export function matchesUserTerritory(state, user) {
  if (!user || user.role === "admin") return true;
  const terr = user.territory;
  if (!terr || terr === "all") return true;
  if (Array.isArray(terr)) return terr.includes(state);
  // Named region — look up in tenant regionMap
  const { regionMap } = TENANT_CONFIG;
  if (regionMap && regionMap[state] === terr) return true;
  return state === terr;
}
