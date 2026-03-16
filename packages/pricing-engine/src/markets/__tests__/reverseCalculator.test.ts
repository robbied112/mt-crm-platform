import { describe, it, expect } from 'vitest';
import {
  reverseCalculate,
  calculatePriceTiers,
  calculateFxSensitivity,
  computeValueChain,
  RETAIL_TIERS,
} from '../reverseCalculator';
import { calculateMarketPricing, makeDefaultMarketInputs } from '../genericCalculator';
import { MARKET_CONFIGS, getMarketConfig } from '../configs';

// ---- reverseCalculate ----

describe('reverseCalculate', () => {
  const usConfig = getMarketConfig('us-import')!;
  const ukConfig = getMarketConfig('uk-import')!;

  it('finds max FOB cost that lands at target SRP', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const targetSrp = 14.99;
    const maxCost = reverseCalculate(usConfig, targetSrp, inputs);

    expect(maxCost).toBeGreaterThan(0);
    expect(maxCost).toBeLessThan(targetSrp);

    // Verify: plugging maxCost back in should land at the target SRP
    const verification = calculateMarketPricing(usConfig, { ...inputs, costPerBottle: maxCost });
    expect(verification.summary.srpBottle).toBeCloseTo(targetSrp, 1);
  });

  it('returns 0 for target SRP = 0', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    expect(reverseCalculate(usConfig, 0, inputs)).toBe(0);
  });

  it('returns 0 for negative target SRP', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    expect(reverseCalculate(usConfig, -10, inputs)).toBe(0);
  });

  it('returns -1 when target is below cost floor', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    // The cost floor is the minimum SRP from fixed logistics, even at 0 wine cost
    const maxCost = reverseCalculate(usConfig, 0.01, inputs);
    expect(maxCost).toBe(-1);
  });

  it('works for every market with a reasonable target', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      const target = 15; // reasonable shelf price in any currency
      const maxCost = reverseCalculate(config, target, inputs);

      // Should either be achievable (positive) or not (-1)
      expect(maxCost === -1 || maxCost > 0).toBe(true);

      if (maxCost > 0) {
        // Verify accuracy
        const verification = calculateMarketPricing(config, { ...inputs, costPerBottle: maxCost });
        expect(verification.summary.srpBottle).toBeCloseTo(target, 0);
      }
    }
  });

  it('higher target SRP allows higher max cost', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const cost1 = reverseCalculate(usConfig, 14.99, inputs);
    const cost2 = reverseCalculate(usConfig, 24.99, inputs);

    expect(cost1).toBeGreaterThan(0);
    expect(cost2).toBeGreaterThan(0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  it('precision is within $0.01', () => {
    const inputs = makeDefaultMarketInputs(ukConfig);
    const target = 10.99;
    const maxCost = reverseCalculate(ukConfig, target, inputs);

    if (maxCost > 0) {
      const verification = calculateMarketPricing(ukConfig, { ...inputs, costPerBottle: maxCost });
      expect(Math.abs(verification.summary.srpBottle - target)).toBeLessThan(0.01);
    }
  });
});

// ---- calculatePriceTiers ----

describe('calculatePriceTiers', () => {
  const usConfig = getMarketConfig('us-import')!;

  it('returns correct number of tiers for USD', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const tiers = calculatePriceTiers(usConfig, inputs, result.summary.srpBottle);

    expect(tiers.length).toBe(RETAIL_TIERS['USD'].length);
  });

  it('each tier has expected structure', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const tiers = calculatePriceTiers(usConfig, inputs, result.summary.srpBottle);

    for (const tier of tiers) {
      expect(tier).toHaveProperty('tier');
      expect(tier).toHaveProperty('maxCost');
      expect(tier).toHaveProperty('achievable');
      expect(tier).toHaveProperty('currentAbove');
      expect(typeof tier.tier).toBe('number');
      expect(typeof tier.achievable).toBe('boolean');
      expect(typeof tier.currentAbove).toBe('boolean');
    }
  });

  it('tiers are in ascending order of shelf price', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const tiers = calculatePriceTiers(usConfig, inputs, result.summary.srpBottle);

    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].tier).toBeGreaterThan(tiers[i - 1].tier);
    }
  });

  it('achievable tiers have positive maxCost', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const tiers = calculatePriceTiers(usConfig, inputs, result.summary.srpBottle);

    for (const tier of tiers) {
      if (tier.achievable) {
        expect(tier.maxCost).toBeGreaterThan(0);
      } else {
        expect(tier.maxCost).toBe(-1);
      }
    }
  });

  it('higher tiers allow higher max costs', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const tiers = calculatePriceTiers(usConfig, inputs, result.summary.srpBottle);

    const achievable = tiers.filter((t) => t.achievable);
    for (let i = 1; i < achievable.length; i++) {
      expect(achievable[i].maxCost).toBeGreaterThan(achievable[i - 1].maxCost);
    }
  });

  it('currentAbove is correct relative to current SRP', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const result = calculateMarketPricing(usConfig, inputs);
    const currentSrp = result.summary.srpBottle;
    const tiers = calculatePriceTiers(usConfig, inputs, currentSrp);

    for (const tier of tiers) {
      expect(tier.currentAbove).toBe(currentSrp > tier.tier);
    }
  });

  it('uses correct currency tiers for each market', () => {
    const ukConfig = getMarketConfig('uk-import')!;
    const inputs = makeDefaultMarketInputs(ukConfig);
    const result = calculateMarketPricing(ukConfig, inputs);
    const tiers = calculatePriceTiers(ukConfig, inputs, result.summary.srpBottle);

    expect(tiers.length).toBe(RETAIL_TIERS['GBP'].length);
    expect(tiers[0].tier).toBe(RETAIL_TIERS['GBP'][0]);
  });
});

// ---- RETAIL_TIERS ----

describe('RETAIL_TIERS', () => {
  it('has tiers for USD, GBP, AUD, NZD, EUR, ZAR', () => {
    expect(RETAIL_TIERS).toHaveProperty('USD');
    expect(RETAIL_TIERS).toHaveProperty('GBP');
    expect(RETAIL_TIERS).toHaveProperty('AUD');
    expect(RETAIL_TIERS).toHaveProperty('NZD');
    expect(RETAIL_TIERS).toHaveProperty('EUR');
    expect(RETAIL_TIERS).toHaveProperty('ZAR');
  });

  it('all tier arrays are sorted ascending', () => {
    for (const [, tiers] of Object.entries(RETAIL_TIERS)) {
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]).toBeGreaterThan(tiers[i - 1]);
      }
    }
  });
});

// ---- calculateFxSensitivity ----

describe('calculateFxSensitivity', () => {
  const usConfig = getMarketConfig('us-import')!;

  it('returns rows for default deltas', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const rows = calculateFxSensitivity(usConfig, inputs);

    expect(rows).toHaveLength(7); // default deltas: -10, -5, -2, 0, 2, 5, 10
  });

  it('marks current rate row with isCurrent = true', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const rows = calculateFxSensitivity(usConfig, inputs);

    const currentRow = rows.find((r) => r.isCurrent);
    expect(currentRow).toBeDefined();
    expect(currentRow!.deltaPercent).toBe(0);
    expect(currentRow!.change).toBeCloseTo(0, 4);
  });

  it('higher exchange rate produces higher SRP (for cross-border)', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const rows = calculateFxSensitivity(usConfig, inputs);

    const negRow = rows.find((r) => r.deltaPercent === -10)!;
    const posRow = rows.find((r) => r.deltaPercent === 10)!;
    const currentRow = rows.find((r) => r.isCurrent)!;

    // Higher rate → higher SRP
    expect(posRow.srpBottle).toBeGreaterThan(currentRow.srpBottle);
    // Lower rate → lower SRP
    expect(negRow.srpBottle).toBeLessThan(currentRow.srpBottle);
  });

  it('exchange rates match expected deltas', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const baseRate = inputs.exchangeRate;
    const rows = calculateFxSensitivity(usConfig, inputs);

    for (const row of rows) {
      const expectedRate = baseRate * (1 + row.deltaPercent / 100);
      expect(row.exchangeRate).toBeCloseTo(expectedRate, 4);
    }
  });

  it('change values are relative to current SRP', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const rows = calculateFxSensitivity(usConfig, inputs);
    const currentRow = rows.find((r) => r.isCurrent)!;

    for (const row of rows) {
      expect(row.change).toBeCloseTo(row.srpBottle - currentRow.srpBottle, 2);
    }
  });

  it('supports custom deltas', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    const customDeltas = [-20, -15, 0, 15, 20];
    const rows = calculateFxSensitivity(usConfig, inputs, customDeltas);

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.deltaPercent)).toEqual(customDeltas);
  });

  it('works for every cross-border market', () => {
    for (const config of MARKET_CONFIGS) {
      if (config.currency.needsConversion) {
        const inputs = makeDefaultMarketInputs(config);
        const rows = calculateFxSensitivity(config, inputs);
        expect(rows.length).toBe(7);
        expect(rows.every((r) => Number.isFinite(r.srpBottle))).toBe(true);
      }
    }
  });
});

// ---- computeValueChain ----

describe('computeValueChain', () => {
  it('decomposes the full SRP into slices that sum to 100%', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      const result = calculateMarketPricing(config, inputs);
      const chain = computeValueChain(result);

      if (chain.length === 0) continue;

      const totalPercent = chain.reduce((sum, s) => sum + s.percent, 0);
      expect(totalPercent).toBeCloseTo(100, 0);
    }
  });

  it('has a producer cost slice', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const chain = computeValueChain(result);

    const producerSlice = chain.find((s) => s.category === 'cost');
    expect(producerSlice).toBeDefined();
    expect(producerSlice!.label).toBe('Producer Cost');
    expect(producerSlice!.perCase).toBeGreaterThan(0);
  });

  it('has margin slices matching the chain layers', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const chain = computeValueChain(result);

    const marginSlices = chain.filter((s) => s.category === 'margin');
    expect(marginSlices.length).toBe(result.layerRecaps.length);

    for (const slice of marginSlices) {
      expect(slice.perCase).toBeGreaterThan(0);
      expect(slice.percent).toBeGreaterThan(0);
    }
  });

  it('has an overhead slice for taxes/duties/freight', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const chain = computeValueChain(result);

    const overheadSlice = chain.find((s) => s.category === 'overhead');
    expect(overheadSlice).toBeDefined();
    expect(overheadSlice!.label).toBe('Taxes, Duties & Freight');
  });

  it('perBottle = perCase / casePack', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const chain = computeValueChain(result);
    const casePack = inputs.casePack;

    for (const slice of chain) {
      expect(slice.perBottle).toBeCloseTo(slice.perCase / casePack, 2);
    }
  });

  it('all slices have color assignments', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const chain = computeValueChain(result);

    for (const slice of chain) {
      expect(slice.color).toBeTruthy();
      expect(slice.color.startsWith('bg-')).toBe(true);
    }
  });

  it('returns empty array for zero SRP', () => {
    const config = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);

    // Mutate summary to test edge case
    const fakeResult = { ...result, summary: { ...result.summary, srpCase: 0 } };
    const chain = computeValueChain(fakeResult);
    expect(chain).toHaveLength(0);
  });
});
