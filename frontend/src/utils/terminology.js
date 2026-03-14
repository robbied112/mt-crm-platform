/**
 * Terminology helper — returns tenant-specific labels with fallbacks.
 * Extracted from index.html t() function.
 */

import TENANT_CONFIG from "../config/tenant";

const DEFAULTS = {
  volume: "CE",
  longPeriod: "13W",
  shortPeriod: "4W",
  distributor: "Distributor",
  account: "Account",
  depletion: "Depletion",
};

/**
 * Get the tenant-specific term for a given key.
 * @param {string} key - One of: volume, longPeriod, shortPeriod, distributor, account, depletion
 * @returns {string}
 */
export function t(key) {
  const terms = TENANT_CONFIG.terminology || {};
  return terms[key] || DEFAULTS[key] || key;
}
