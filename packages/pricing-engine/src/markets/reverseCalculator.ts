import type { MarketConfig, MarketPricingInputs, MarketPricingResult } from './types';
import { calculateMarketPricing } from './genericCalculator';

/**
 * Reverse Pricing Engine
 *
 * The #1 question in wine trade: "I need to hit $14.99 on shelf.
 * What's the most I can pay the winery?"
 *
 * Uses binary search — works universally for ANY market configuration
 * regardless of tax structure, chain layers, or margin modes.
 * 50 iterations yields precision to < $0.001.
 */
export function reverseCalculate(
  config: MarketConfig,
  targetSrpBottle: number,
  baseInputs: MarketPricingInputs,
): number {
  if (targetSrpBottle <= 0) return 0;

  // Check floor: even at cost = 0, fixed logistics/taxes create a minimum SRP
  const floorResult = calculateMarketPricing(config, { ...baseInputs, costPerBottle: 0 });
  if (floorResult.summary.srpBottle >= targetSrpBottle) {
    return -1; // Target is below the cost floor — not achievable
  }

  let low = 0;
  // Upper bound must account for exchange rate — cost is in source currency,
  // target SRP is in market currency. E.g., CLP→USD rate ~0.001 means
  // a $15 SRP requires ~15,000 CLP cost.
  const rate = (config.currency.needsConversion && baseInputs.exchangeRate > 0)
    ? baseInputs.exchangeRate
    : 1;
  let high = (targetSrpBottle / rate) * 10;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const result = calculateMarketPricing(config, { ...baseInputs, costPerBottle: mid });

    if (Math.abs(result.summary.srpBottle - targetSrpBottle) < 0.005) {
      return mid;
    }

    if (result.summary.srpBottle < targetSrpBottle) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Price Tier Analysis
 *
 * For each retail price tier ($9.99, $14.99, etc.), calculate the
 * maximum FOB cost per bottle that lands at or below that tier.
 */

export const RETAIL_TIERS: Record<string, number[]> = {
  USD: [9.99, 12.99, 14.99, 19.99, 24.99, 29.99],
  GBP: [6.99, 8.99, 10.99, 14.99, 19.99],
  AUD: [12.99, 15.99, 19.99, 24.99, 29.99],
  NZD: [14.99, 19.99, 24.99, 29.99],
  EUR: [5.99, 7.99, 9.99, 12.99, 14.99],
  ZAR: [79.99, 99.99, 129.99, 179.99, 249.99, 349.99],
};

export interface TierResult {
  tier: number;
  maxCost: number;      // -1 means not achievable (below cost floor)
  achievable: boolean;
  currentAbove: boolean; // is current SRP above this tier?
}

export function calculatePriceTiers(
  config: MarketConfig,
  inputs: MarketPricingInputs,
  currentSrp: number,
): TierResult[] {
  const tiers = RETAIL_TIERS[config.currency.target] || RETAIL_TIERS['USD'];

  return tiers.map((tier) => {
    const maxCost = reverseCalculate(config, tier, inputs);
    return {
      tier,
      maxCost,
      achievable: maxCost >= 0,
      currentAbove: currentSrp > tier,
    };
  });
}

/**
 * FX Sensitivity Analysis
 *
 * Shows how exchange rate movements affect the shelf price.
 * Critical for anyone in international wine trade.
 */

export interface FxSensitivityRow {
  deltaPercent: number;
  exchangeRate: number;
  srpBottle: number;
  srpCase: number;
  change: number;
  isCurrent: boolean;
}

export function calculateFxSensitivity(
  config: MarketConfig,
  baseInputs: MarketPricingInputs,
  deltas = [-10, -5, -2, 0, 2, 5, 10],
): FxSensitivityRow[] {
  const baseResult = calculateMarketPricing(config, baseInputs);
  const baseSrp = baseResult.summary.srpBottle;
  const baseRate = baseInputs.exchangeRate;

  return deltas.map((delta) => {
    const rate = baseRate * (1 + delta / 100);
    const inputs = { ...baseInputs, exchangeRate: rate };
    const result = calculateMarketPricing(config, inputs);

    return {
      deltaPercent: delta,
      exchangeRate: rate,
      srpBottle: result.summary.srpBottle,
      srpCase: result.summary.srpCase,
      change: result.summary.srpBottle - baseSrp,
      isCurrent: delta === 0,
    };
  });
}

/**
 * Value Chain Decomposition
 *
 * Answers: "Who captures what % of the bottle price?"
 * Breaks the consumer price into producer cost, each layer's margin,
 * and taxes/duties/logistics overhead.
 */

export interface ValueChainSlice {
  label: string;
  category: 'cost' | 'margin' | 'overhead';
  perCase: number;
  perBottle: number;
  percent: number;
  color: string;
}

const MARGIN_COLORS = [
  'bg-blue-600', 'bg-blue-400', 'bg-sky-400', 'bg-cyan-400',
];

export function computeValueChain(result: MarketPricingResult): ValueChainSlice[] {
  const srpCase = result.summary.srpCase;
  const casePack = result.inputs.casePack || 12;

  if (srpCase <= 0) return [];

  const producerCost = result.summary.baseCostCaseTarget;
  const totalMargins = result.layerRecaps.reduce((sum, r) => sum + r.grossProfit, 0);
  const overhead = srpCase - producerCost - totalMargins;

  const slices: Omit<ValueChainSlice, 'perBottle' | 'percent'>[] = [
    { label: 'Producer Cost', category: 'cost', perCase: producerCost, color: 'bg-amber-400' },
    ...result.layerRecaps.map((r, i) => ({
      label: `${r.label} Margin`,
      category: 'margin' as const,
      perCase: r.grossProfit,
      color: MARGIN_COLORS[i] || 'bg-blue-300',
    })),
    { label: 'Taxes, Duties & Freight', category: 'overhead', perCase: overhead, color: 'bg-slate-300' },
  ];

  return slices.map((s) => ({
    ...s,
    perBottle: casePack > 0 ? s.perCase / casePack : 0,
    percent: srpCase > 0 ? (s.perCase / srpCase) * 100 : 0,
  }));
}
