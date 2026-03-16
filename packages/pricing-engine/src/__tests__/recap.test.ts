import { describe, test, expect } from 'vitest';
import { buildRecap, buildAllRecaps } from '../recap/buildRecap';
import { RecapActor } from '../core/enums';
import { calculatePricing } from '../calculators';
import type { PricingInputs } from '../core/types';

const inputs: PricingInputs = {
  whoAmI: 'DomesticWinery', sellingTo: 'Distributor', inventory: 'US_Winery',
  exCellarBottle: 10, casePack: 12, exchangeRate: 1.0, exchangeBuffer: 0,
  diFreightPerCase: 13, tariffPercent: 0, statesideLogisticsPerCase: 10,
  importerMarginPercent: 30, distributorMarginPercent: 25, retailerMarginPercent: 33,
};

describe('buildRecap', () => {
  const result = calculatePricing(inputs);

  test('distributor recap has buy < sell', () => {
    const recap = buildRecap(result, RecapActor.Distributor);
    const buy = recap.lines.find((l) => l.label.includes('Buy'))!;
    const sell = recap.lines.find((l) => l.label.includes('Sell'))!;
    expect(buy.perCase).toBeLessThan(sell.perCase);
  });

  test('buildAllRecaps returns all actors', () => {
    const recaps = buildAllRecaps(result);
    expect(recaps).toHaveLength(Object.values(RecapActor).length);
  });
});
