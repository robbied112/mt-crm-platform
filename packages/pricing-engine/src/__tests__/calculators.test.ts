import { describe, test, expect } from 'vitest';
import { calculatePricing } from '../calculators';
import { resolvePricingModelId } from '../core/resolver';
import type { PricingInputs } from '../core/types';

function makeInputs(overrides: Partial<PricingInputs> = {}): PricingInputs {
  return {
    whoAmI: 'DomesticWinery',
    sellingTo: 'Distributor',
    inventory: 'US_Winery',
    exCellarBottle: 10,
    casePack: 12,
    exchangeRate: 1.0,
    exchangeBuffer: 0,
    diFreightPerCase: 13,
    tariffPercent: 0,
    statesideLogisticsPerCase: 10,
    importerMarginPercent: 30,
    distributorMarginPercent: 25,
    retailerMarginPercent: 33,
    ...overrides,
  };
}

describe('Model resolver', () => {
  test('DomesticWinery → Distributor resolves correctly', () => {
    expect(resolvePricingModelId('DomesticWinery', 'Distributor', 'US_Winery'))
      .toBe('Domestic_Winery_ToDistributor');
  });

  test('EuroWinery → Distributor at Euro FOB resolves to ImportedModelDI', () => {
    expect(resolvePricingModelId('EuroWinery', 'Distributor', 'Euro_FOB_Winery'))
      .toBe('ImportedModelDI');
  });

  test('EuroWinery → Distributor at US WH resolves to ImportedModelSS', () => {
    expect(resolvePricingModelId('EuroWinery', 'Distributor', 'US_Importer_WH'))
      .toBe('ImportedModelSS');
  });

  test('Tolerates human-readable inventory labels', () => {
    expect(resolvePricingModelId('Importer', 'Distributor', 'Euro FOB (Winery)'))
      .toBe('ImportedModelDI');
  });

  test('Unknown combo returns null', () => {
    expect(resolvePricingModelId('Retailer', 'Distributor', 'US_Winery'))
      .toBeNull();
  });
});

describe('Domestic Winery → Distributor (spec example)', () => {
  // From spec: ex-cellar 10, pack 12, logistics 10, dist margin 25%, retail margin 33%
  const inputs = makeInputs({
    exCellarBottle: 10,
    casePack: 12,
    statesideLogisticsPerCase: 10,
    distributorMarginPercent: 25,
    retailerMarginPercent: 33,
  });

  test('resolves and calculates correctly', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('Domestic_Winery_ToDistributor');
    expect(result.case.wholesaleCase).toBeCloseTo(173.33, 2);
    expect(result.bottle.wholesaleBottle).toBeCloseTo(14.44, 2);
    expect(result.bottle.srpBottle).toBeCloseTo(21.56, 2);
    expect(result.margins.retailerGrossProfitPerCase).toBeCloseTo(85.37, 2);
  });
});

describe('Domestic Winery → Retail self-distribution (spec example)', () => {
  const inputs = makeInputs({
    whoAmI: 'DomesticWinery',
    sellingTo: 'Retailer',
    inventory: 'US_Winery',
    exCellarBottle: 10,
    casePack: 12,
    statesideLogisticsPerCase: 10,
    retailerMarginPercent: 33,
  });

  test('no distributor layer, SRP matches spec', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('Domestic_Winery_ToRetailer');
    expect(result.case.wholesaleCase).toBeCloseTo(130.0, 2);
    expect(result.bottle.wholesaleBottle).toBeCloseTo(10.83, 2);
    expect(result.bottle.srpBottle).toBeCloseTo(16.17, 2);
    expect(result.margins.retailerGrossProfitPerCase).toBeCloseTo(64.03, 2);
  });
});

describe('Imported Model DI (spec example)', () => {
  // From spec: ex-cellar 5 EUR, pack 12, FX 1.16, freight 13, tariff 15%,
  // importer 30%, distributor 30%, retailer 33%
  const inputs = makeInputs({
    whoAmI: 'EuroWinery',
    sellingTo: 'Distributor',
    inventory: 'Euro_FOB_Winery',
    exCellarBottle: 5,
    casePack: 12,
    exchangeRate: 1.16,
    exchangeBuffer: 0,
    diFreightPerCase: 13,
    tariffPercent: 15,
    importerMarginPercent: 30,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  });

  test('DI model matches spec values', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('ImportedModelDI');
    expect(result.case.wholesaleCase).toBeCloseTo(181.92, 2);
    expect(result.bottle.wholesaleBottle).toBeCloseTo(15.16, 2);
    expect(result.bottle.srpBottle).toBeCloseTo(22.63, 2);
    expect(result.margins.distributorGrossProfitPerCase).toBeCloseTo(54.58, 2);
    expect(result.margins.retailerGrossProfitPerCase).toBeCloseTo(89.60, 2);
  });
});

describe('Imported Model SS (spec example)', () => {
  const inputs = makeInputs({
    whoAmI: 'EuroWinery',
    sellingTo: 'Distributor',
    inventory: 'US_Importer_WH',
    exCellarBottle: 5,
    casePack: 12,
    exchangeRate: 1.16,
    exchangeBuffer: 0,
    diFreightPerCase: 13,
    tariffPercent: 15,
    statesideLogisticsPerCase: 10,
    importerMarginPercent: 30,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  });

  test('SS model matches spec values', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('ImportedModelSS');
    expect(result.case.wholesaleCase).toBeCloseTo(204.16, 2);
    expect(result.bottle.wholesaleBottle).toBeCloseTo(17.01, 2);
    expect(result.bottle.srpBottle).toBeCloseTo(25.39, 2);
    expect(result.margins.distributorGrossProfitPerCase).toBeCloseTo(61.25, 2);
    expect(result.margins.retailerGrossProfitPerCase).toBeCloseTo(100.56, 2);
  });
});

describe('Euro DI To Retailer (spec example)', () => {
  const inputs = makeInputs({
    whoAmI: 'EuroWinery',
    sellingTo: 'Retailer',
    inventory: 'Euro_FOB_Winery',
    exCellarBottle: 5,
    casePack: 12,
    exchangeRate: 1.16,
    exchangeBuffer: 0,
    diFreightPerCase: 13,
    tariffPercent: 15,
    retailerMarginPercent: 33,
    importerMarginPercent: 0,
    distributorMarginPercent: 0,
  });

  test('Direct retailer model matches spec', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('Euro_DI_ToRetailer');
    expect(result.case.wholesaleCase).toBeCloseTo(93.04, 2);
    expect(result.bottle.wholesaleBottle).toBeCloseTo(7.75, 2);
    expect(result.bottle.srpBottle).toBeCloseTo(11.57, 2);
    expect(result.margins.retailerGrossProfitPerCase).toBeCloseTo(45.83, 2);
  });
});

describe('Distributor → Retailer', () => {
  const inputs = makeInputs({
    whoAmI: 'Distributor',
    sellingTo: 'Retailer',
    inventory: 'US_Distributor_WH',
    exCellarBottle: 10,
    casePack: 12,
    statesideLogisticsPerCase: 10,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  });

  test('resolves and produces positive results', () => {
    const result = calculatePricing(inputs);
    expect(result.modelId).toBe('Distributor_ToRetailer');
    expect(result.case.wholesaleCase).toBeGreaterThan(0);
    expect(result.bottle.srpBottle).toBeGreaterThan(0);
  });
});

describe('Normalized output contract', () => {
  test('every calculator returns complete PricingResult shape', () => {
    const scenarios: Partial<PricingInputs>[] = [
      { whoAmI: 'DomesticWinery', sellingTo: 'Distributor', inventory: 'US_Winery' },
      { whoAmI: 'DomesticWinery', sellingTo: 'Retailer', inventory: 'US_Winery' },
      { whoAmI: 'EuroWinery', sellingTo: 'Distributor', inventory: 'Euro_FOB_Winery', exchangeRate: 1.16 },
      { whoAmI: 'EuroWinery', sellingTo: 'Distributor', inventory: 'US_Importer_WH', exchangeRate: 1.16 },
      { whoAmI: 'EuroWinery', sellingTo: 'Retailer', inventory: 'Euro_FOB_Winery', exchangeRate: 1.16 },
      { whoAmI: 'Supplier', sellingTo: 'Distributor', inventory: 'US_Supplier_WH' },
      { whoAmI: 'Supplier', sellingTo: 'Retailer', inventory: 'US_Supplier_WH' },
      { whoAmI: 'Distributor', sellingTo: 'Retailer', inventory: 'US_Distributor_WH' },
    ];

    for (const overrides of scenarios) {
      const result = calculatePricing(makeInputs(overrides));
      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('modelLabel');
      expect(result).toHaveProperty('bottle');
      expect(result).toHaveProperty('case');
      expect(result).toHaveProperty('margins');
      expect(result).toHaveProperty('assumptions');
      expect(result).toHaveProperty('warnings');
      expect(result.bottle).toHaveProperty('srpBottle');
      expect(result.case).toHaveProperty('wholesaleCase');
      expect(result.margins).toHaveProperty('retailerGrossProfitPerCase');
    }
  });
});
