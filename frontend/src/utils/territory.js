/**
 * Territory matching utilities
 * Extracted from index.html matchesUserTerritory() (line 3317).
 */

import TENANT_CONFIG from "../config/tenant";

/**
 * Check if a state falls within a user's assigned territory.
 * Admins/managers and users with 'all' territory see everything.
 * @param {string} state - State abbreviation to check
 * @param {object|null} user - Current user object with { role, territory }
 * @param {object} [territories] - Dynamic territory config from tenantConfig.territories
 *   e.g. { "Southeast": ["GA", "FL", "SC"], "Northeast": ["NY", "NJ"] }
 * @returns {boolean}
 */
export function matchesUserTerritory(state, user, territories) {
  if (!user || user.role === "admin" || user.role === "manager") return true;
  const terr = user.territory;
  if (!terr || terr === "all") return true;
  if (Array.isArray(terr)) return terr.includes(state);

  // Named territory — check dynamic config first, then legacy regionMap
  if (territories && territories[terr]) {
    return territories[terr].includes(state);
  }
  const { regionMap } = TENANT_CONFIG;
  if (regionMap && regionMap[state] === terr) return true;
  return state === terr;
}

/**
 * Build a regionMap from the dynamic territories config.
 * Inverts { "Southeast": ["GA", "FL"] } → { "GA": "Southeast", "FL": "Southeast" }
 * @param {object} territories - Territory config from tenantConfig.territories
 * @returns {object} state → territory name map
 */
export function buildRegionMap(territories) {
  if (!territories) return {};
  const map = {};
  for (const [name, states] of Object.entries(territories)) {
    for (const st of states) {
      map[st] = name;
    }
  }
  return map;
}
