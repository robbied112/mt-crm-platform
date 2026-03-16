/**
 * Live exchange rate service.
 *
 * Fetches current FX rates from open.er-api.com (free, no key, CORS-friendly).
 * Caches in memory for 30 minutes to avoid hitting rate limits.
 */

import type { MarketConfig } from '../markets/types';

// ---- Types ----

/** Map of base currency → { target: rate } */
export type LiveRates = Record<string, Record<string, number>>;

export interface LiveRatesResult {
  rates: LiveRates;
  fetchedAt: number;
}

// ---- Cache ----

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache: LiveRatesResult | null = null;

// ---- Fetch ----

const API_BASE = 'https://open.er-api.com/v6/latest';

/** Currencies we need as base for our markets */
const BASE_CURRENCIES = ['EUR', 'CLP'];

async function fetchSingleBase(base: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${API_BASE}/${base}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success') return null;
    return data.rates as Record<string, number>;
  } catch {
    return null;
  }
}

/**
 * Fetch live exchange rates for all base currencies we need.
 * Returns cached result if still fresh.
 * Returns null on complete failure (caller should fall back to config defaults).
 */
export async function fetchLiveRates(force = false): Promise<LiveRatesResult | null> {
  // Return cached if fresh
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const results: LiveRates = {};
  let anySuccess = false;

  // Fetch all base currencies in parallel
  const fetches = await Promise.all(
    BASE_CURRENCIES.map(async (base) => ({
      base,
      rates: await fetchSingleBase(base),
    })),
  );

  for (const { base, rates } of fetches) {
    if (rates) {
      results[base] = rates;
      anySuccess = true;
    }
  }

  if (!anySuccess) return null;

  cache = { rates: results, fetchedAt: Date.now() };
  return cache;
}

/**
 * Look up the live exchange rate for a specific market.
 * Returns the rate (source → target), or null if not available.
 */
export function getRateForMarket(config: MarketConfig, rates: LiveRates): number | null {
  if (!config.currency.needsConversion) return null;

  const { source, target } = config.currency;
  const baseRates = rates[source];
  if (!baseRates) return null;

  const rate = baseRates[target];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;

  return rate;
}

/**
 * Format a "last updated" timestamp for display.
 */
export function formatRateAge(fetchedAt: number): string {
  const ageMs = Date.now() - fetchedAt;
  const ageMins = Math.floor(ageMs / 60_000);

  if (ageMins < 1) return 'just now';
  if (ageMins === 1) return '1 min ago';
  if (ageMins < 60) return `${ageMins} min ago`;

  const ageHrs = Math.floor(ageMins / 60);
  if (ageHrs === 1) return '1 hr ago';
  return `${ageHrs} hrs ago`;
}
