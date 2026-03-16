import { describe, test, expect } from 'vitest';
import { compareScenarios } from '../comparison/compareScenarios';
import { calculatePricing } from '../calculators';
import type { PricingInputs } from '../core/types';

function makeInputs(overrides: Partial<PricingInputs> = {}): PricingInputs {
  return {
    whoAmI: 'DomesticWinery', sellingTo: 'Distributor', inventory: 'US_Winery',
    exCellarBottle: 10, casePack: 12, exchangeRate: 1.0, exchangeBuffer: 0,
    diFreightPerCase: 13, tariffPercent: 0, statesideLogisticsPerCase: 10,
    importerMarginPercent: 30, distributorMarginPercent: 25, retailerMarginPercent: 33,
    ...overrides,
  };
}

describe('compareScenarios', () => {
  test('identical scenarios → all deltas zero', () => {
    const result = calculatePricing(makeInputs());
    const { deltas, changedInputs } = compareScenarios(result, result);
    expect(changedInputs).toHaveLength(0);
    deltas.forEach((d) => expect(d.delta).toBe(0));
  });

  test('different inputs → correct deltas and changedInputs', () => {
    const a = calculatePricing(makeInputs({ distributorMarginPercent: 25 }));
    const b = calculatePricing(makeInputs({ distributorMarginPercent: 35 }));
    const { deltas, changedInputs } = compareScenarios(a, b);
    expect(changedInputs).toContain('distributorMarginPercent');
    const ws = deltas.find((d) => d.field === 'wholesaleCase')!;
    expect(ws.delta).not.toBe(0);
    expect(ws.comparison).toBeGreaterThan(ws.baseline);
  });
});
