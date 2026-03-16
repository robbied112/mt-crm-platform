import { describe, it, expect } from 'vitest';
import { calculateMarketPricing, makeDefaultMarketInputs } from '../genericCalculator';
import { MARKET_CONFIGS, getMarketConfig } from '../configs';

// ---- Test every market with default inputs ----

describe('Generic Market Calculator', () => {
  for (const config of MARKET_CONFIGS) {
    describe(config.name, () => {
      const inputs = makeDefaultMarketInputs(config);
      const result = calculateMarketPricing(config, inputs);

      it('produces a valid result with correct market ID', () => {
        expect(result.marketId).toBe(config.id);
        expect(result.marketName).toBe(config.name);
      });

      it('generates a non-empty waterfall', () => {
        expect(result.waterfall.length).toBeGreaterThan(0);
      });

      it('has positive SRP bottle and case prices', () => {
        expect(result.summary.srpBottle).toBeGreaterThan(0);
        expect(result.summary.srpCase).toBeGreaterThan(0);
      });

      it('SRP case = SRP bottle × case pack (within rounding)', () => {
        expect(result.summary.srpCase).toBeCloseTo(
          result.summary.srpBottle * inputs.casePack,
          1,
        );
      });

      it('generates layer recaps for each active chain layer', () => {
        const activeLayers = config.chain.filter(
          (l) => !l.skippable || inputs.activeLayers.includes(l.id),
        );
        expect(result.layerRecaps.length).toBe(activeLayers.length);
      });

      it('all layer sell prices exceed buy prices', () => {
        for (const recap of result.layerRecaps) {
          expect(recap.sellPrice).toBeGreaterThan(recap.buyPrice);
          expect(recap.grossProfit).toBeGreaterThan(0);
        }
      });

      it('has no error-severity warnings with default inputs', () => {
        const errors = result.warnings.filter((w) => w.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('has correct currency in assumptions', () => {
        expect(result.assumptions.currency).toBe(config.currency.target);
      });
    });
  }
});

// ---- Edge cases ----

describe('Edge Cases', () => {
  const usConfig = getMarketConfig('us-import')!;

  it('handles zero cost gracefully', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    inputs.costPerBottle = 0;
    const result = calculateMarketPricing(usConfig, inputs);
    // SRP won't be exactly 0 because flat per-case logistics still apply,
    // but the base cost contribution should be zero
    expect(result.summary.baseCostCase).toBe(0);
    expect(result.warnings.some((w) => w.field === 'costPerBottle')).toBe(true);
  });

  it('handles 99% margin — produces high but finite SRP', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    inputs.margins[usConfig.chain[0].id] = 99;
    const result = calculateMarketPricing(usConfig, inputs);
    expect(Number.isFinite(result.summary.srpBottle)).toBe(true);
    expect(result.summary.srpBottle).toBeGreaterThan(100);
    expect(result.warnings.some((w) => w.severity === 'warn')).toBe(true);
  });

  it('100% margin produces Infinity and error warning', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    inputs.margins[usConfig.chain[0].id] = 100;
    const result = calculateMarketPricing(usConfig, inputs);
    expect(result.warnings.some((w) => w.severity === 'error')).toBe(true);
  });

  it('skipping a layer lowers the SRP', () => {
    const euConfig = getMarketConfig('eu-internal')!;
    const inputs1 = makeDefaultMarketInputs(euConfig);
    const result1 = calculateMarketPricing(euConfig, inputs1);

    const inputs2 = makeDefaultMarketInputs(euConfig);
    const skippable = euConfig.chain.find((l) => l.skippable);
    if (skippable) {
      inputs2.activeLayers = inputs2.activeLayers.filter((id) => id !== skippable.id);
      const result2 = calculateMarketPricing(euConfig, inputs2);
      expect(result2.summary.srpBottle).toBeLessThan(result1.summary.srpBottle);
    }
  });

  it('changing exchange rate proportionally affects output', () => {
    const inputs1 = makeDefaultMarketInputs(usConfig);
    inputs1.exchangeRate = 1.0;
    inputs1.exchangeBuffer = 0;
    const result1 = calculateMarketPricing(usConfig, inputs1);

    const inputs2 = makeDefaultMarketInputs(usConfig);
    inputs2.exchangeRate = 2.0;
    inputs2.exchangeBuffer = 0;
    const result2 = calculateMarketPricing(usConfig, inputs2);

    // With doubled exchange rate, the SRP should roughly double
    expect(result2.summary.srpBottle).toBeGreaterThan(result1.summary.srpBottle * 1.5);
  });

  it('zero exchange rate produces error warning', () => {
    const inputs = makeDefaultMarketInputs(usConfig);
    inputs.exchangeRate = 0;
    const result = calculateMarketPricing(usConfig, inputs);
    expect(result.warnings.some((w) => w.field === 'exchangeRate')).toBe(true);
  });
});

// ---- Currency conversion ----

describe('Currency Conversion', () => {
  it('USD domestic market has effectiveRate = 1', () => {
    const config = getMarketConfig('us-domestic')!;
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    expect(result.assumptions.effectiveRate).toBe(1);
  });

  it('UK market converts EUR to GBP', () => {
    const config = getMarketConfig('uk-import')!;
    expect(config.currency.needsConversion).toBe(true);
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    expect(result.assumptions.effectiveRate).toBeGreaterThan(0);
    expect(result.assumptions.currency).toBe('GBP');
  });

  it('EU internal has no FX conversion', () => {
    const config = getMarketConfig('eu-internal')!;
    expect(config.currency.needsConversion).toBe(false);
    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    expect(result.assumptions.effectiveRate).toBe(1);
  });

  it('exchange buffer increases effective rate', () => {
    const config = getMarketConfig('uk-import')!;
    const inputs1 = makeDefaultMarketInputs(config);
    inputs1.exchangeBuffer = 0;
    const result1 = calculateMarketPricing(config, inputs1);

    const inputs2 = makeDefaultMarketInputs(config);
    inputs2.exchangeBuffer = 5;
    const result2 = calculateMarketPricing(config, inputs2);

    expect(result2.assumptions.effectiveRate).toBeGreaterThan(result1.assumptions.effectiveRate);
  });
});

// ---- Tax types ----

describe('Tax Types', () => {
  it('UK wine duty is per-liter-alcohol — scales with ABV and bottle size', () => {
    const config = getMarketConfig('uk-import')!;
    const dutyTax = config.taxes.find((t) => t.id === 'uk-duty')!;
    expect(dutyTax.type).toBe('per_liter_alcohol');

    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const dutyStep = result.waterfall.find((w) => w.id === 'tax-uk-duty');
    expect(dutyStep).toBeDefined();
    if (dutyStep) {
      const litres = inputs.bottleSizeMl / 1000;
      const abvFraction = inputs.abv / 100;
      const expected = dutyTax.defaultValue * litres * abvFraction * inputs.casePack;
      expect(dutyStep.perCase).toBeCloseTo(expected, 2);
    }
  });

  it('NZ excise is per-liter — respects bottle size', () => {
    const config = getMarketConfig('nz-import')!;
    const exciseTax = config.taxes.find((t) => t.id === 'excise')!;
    expect(exciseTax.type).toBe('per_liter');

    const inputs = makeDefaultMarketInputs(config);
    const result = calculateMarketPricing(config, inputs);
    const exciseStep = result.waterfall.find((w) => w.id === 'tax-excise');
    expect(exciseStep).toBeDefined();
    if (exciseStep) {
      const bottleLiters = inputs.bottleSizeMl / 1000;
      const expectedCase = exciseTax.defaultValue * bottleLiters * inputs.casePack;
      expect(exciseStep.perCase).toBeCloseTo(expectedCase, 2);
    }
  });

  it('Australia GST timing is on_final', () => {
    const config = getMarketConfig('au-import')!;
    const gst = config.taxes.find((t) => t.id === 'gst')!;
    expect(gst.timing).toBe('on_final');
    expect(gst.inclusive).toBe(true);
  });

  it('US tariff applies after importer layer', () => {
    const config = getMarketConfig('us-import')!;
    const tariff = config.taxes.find((t) => t.id === 'tariff')!;
    expect(tariff.timing).toBe('after:importer');
    expect(tariff.type).toBe('percent_of_value');
  });
});

// ---- Market config registry ----

describe('Market Config Registry', () => {
  it('has 8 market configs', () => {
    expect(MARKET_CONFIGS).toHaveLength(8);
  });

  it('all market IDs are unique', () => {
    const ids = MARKET_CONFIGS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getMarketConfig returns correct config', () => {
    for (const config of MARKET_CONFIGS) {
      expect(getMarketConfig(config.id)).toBe(config);
    }
  });

  it('getMarketConfig returns undefined for unknown ID', () => {
    expect(getMarketConfig('nonexistent')).toBeUndefined();
  });

  it('all markets have at least one chain layer', () => {
    for (const config of MARKET_CONFIGS) {
      expect(config.chain.length).toBeGreaterThan(0);
    }
  });

  it('all markets have defaults with positive cost', () => {
    for (const config of MARKET_CONFIGS) {
      expect(config.defaults.costPerBottle).toBeGreaterThan(0);
      expect(config.defaults.casePack).toBeGreaterThan(0);
    }
  });
});

// ---- makeDefaultMarketInputs ----

describe('makeDefaultMarketInputs', () => {
  it('includes all chain layer margins', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      for (const layer of config.chain) {
        expect(inputs.margins[layer.id]).toBe(layer.defaultMargin);
      }
    }
  });

  it('includes all tax defaults (deduplicated by ID)', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      const uniqueTaxIds = new Set(config.taxes.map((t) => t.id));
      for (const taxId of uniqueTaxIds) {
        const tax = config.taxes.find((t) => t.id === taxId)!;
        expect(inputs.taxes[taxId]).toBe(tax.defaultValue);
      }
    }
  });

  it('includes all logistics defaults (deduplicated by ID)', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      const uniqueLogIds = new Set(config.logistics.map((l) => l.id));
      for (const logId of uniqueLogIds) {
        const log = config.logistics.find((l) => l.id === logId)!;
        expect(inputs.logistics[logId]).toBe(log.defaultValue);
      }
    }
  });

  it('includes all chain layers in activeLayers', () => {
    for (const config of MARKET_CONFIGS) {
      const inputs = makeDefaultMarketInputs(config);
      for (const layer of config.chain) {
        expect(inputs.activeLayers).toContain(layer.id);
      }
    }
  });

  it('sets default pathway for markets with pathways', () => {
    const usConfig = getMarketConfig('us-import')!;
    const inputs = makeDefaultMarketInputs(usConfig);
    expect(inputs.pathway).toBe('di');
  });

  it('does not set pathway for markets without pathways', () => {
    const ukConfig = getMarketConfig('uk-import')!;
    const inputs = makeDefaultMarketInputs(ukConfig);
    expect(inputs.pathway).toBeUndefined();
  });
});

// ---- US Import DI vs SS Pathway Tests ----

describe('US Import — DI vs SS Pathways', () => {
  const usConfig = getMarketConfig('us-import')!;

  // Standard inputs: €5/btl, 12-pack, FX 1.16, 0% buffer, 15% tariff
  // Margins: importer 30%, distributor 30%, retailer 33%
  function makeDIInputs() {
    const inputs = makeDefaultMarketInputs(usConfig);
    inputs.costPerBottle = 5;
    inputs.exchangeRate = 1.16;
    inputs.exchangeBuffer = 0;
    inputs.taxes['tariff'] = 15;
    inputs.logistics['freight'] = 13;
    inputs.margins['importer'] = 30;
    inputs.margins['distributor'] = 30;
    inputs.margins['retailer'] = 33;
    inputs.pathway = 'di';
    return inputs;
  }

  function makeSSInputs() {
    const inputs = makeDIInputs();
    inputs.pathway = 'ss';
    inputs.logistics['stateside'] = 10;
    return inputs;
  }

  describe('DI pathway — importer margin on FOB, tariff as pass-through', () => {
    const inputs = makeDIInputs();
    const result = calculateMarketPricing(usConfig, inputs);

    it('calculates correct base cost in USD', () => {
      // €5 × 12 × 1.16 = $69.60
      expect(result.summary.baseCostCaseTarget).toBeCloseTo(69.60, 2);
    });

    it('importer buys at FOB and sells with margin on FOB only', () => {
      const importerRecap = result.layerRecaps.find((r) => r.layerId === 'importer')!;
      // Buy price = FOB = $69.60
      expect(importerRecap.buyPrice).toBeCloseTo(69.60, 2);
      // Sell price = $69.60 / (1 - 0.30) = $99.43
      expect(importerRecap.sellPrice).toBeCloseTo(99.43, 1);
    });

    it('tariff is calculated on FOB, not on importer sell price', () => {
      const tariffStep = result.waterfall.find((w) => w.id === 'tax-tariff')!;
      // 15% of FOB ($69.60) = $10.44
      expect(tariffStep.perCase).toBeCloseTo(10.44, 2);
    });

    it('DI freight appears as post-margin logistics', () => {
      const freightStep = result.waterfall.find((w) => w.id === 'logistics-freight')!;
      expect(freightStep.perCase).toBeCloseTo(13.0, 2);
    });

    it('no stateside logistics in DI pathway', () => {
      const statesideStep = result.waterfall.find((w) => w.id === 'logistics-stateside');
      expect(statesideStep).toBeUndefined();
    });

    it('distributor buy price = importer sell + tariff + DI freight', () => {
      const distRecap = result.layerRecaps.find((r) => r.layerId === 'distributor')!;
      // $99.43 + $10.44 + $13.00 = $122.87
      expect(distRecap.buyPrice).toBeCloseTo(122.87, 0);
    });
  });

  describe('SS pathway — importer margin on LIC (FOB + freight + tariff)', () => {
    const inputs = makeSSInputs();
    const result = calculateMarketPricing(usConfig, inputs);

    it('calculates correct base cost in USD', () => {
      expect(result.summary.baseCostCaseTarget).toBeCloseTo(69.60, 2);
    });

    it('importer buys at LIC (FOB + ocean freight + tariff) and margins on LIC', () => {
      const importerRecap = result.layerRecaps.find((r) => r.layerId === 'importer')!;
      // LIC = FOB ($69.60) + ocean freight ($13) + tariff ($10.44) = $93.04
      expect(importerRecap.buyPrice).toBeCloseTo(93.04, 2);
      // Sell = $93.04 / (1 - 0.30) = $132.91
      expect(importerRecap.sellPrice).toBeCloseTo(132.91, 1);
    });

    it('tariff is calculated on FOB and applied before importer margin', () => {
      const tariffStep = result.waterfall.find((w) => w.id === 'tax-tariff')!;
      // 15% of FOB ($69.60) = $10.44 — same calculation, different timing
      expect(tariffStep.perCase).toBeCloseTo(10.44, 2);
    });

    it('ocean freight appears before importer margin (part of LIC)', () => {
      const freightStep = result.waterfall.find((w) => w.id === 'logistics-freight')!;
      expect(freightStep.perCase).toBeCloseTo(13.0, 2);
      // Verify freight appears BEFORE importer sell in waterfall
      const freightIdx = result.waterfall.findIndex((w) => w.id === 'logistics-freight');
      const importerIdx = result.waterfall.findIndex((w) => w.id === 'layer-importer');
      expect(freightIdx).toBeLessThan(importerIdx);
    });

    it('stateside logistics appears after importer margin', () => {
      const statesideStep = result.waterfall.find((w) => w.id === 'logistics-stateside')!;
      expect(statesideStep.perCase).toBeCloseTo(10.0, 2);
      // Verify it appears AFTER importer sell in waterfall
      const statesideIdx = result.waterfall.findIndex((w) => w.id === 'logistics-stateside');
      const importerIdx = result.waterfall.findIndex((w) => w.id === 'layer-importer');
      expect(statesideIdx).toBeGreaterThan(importerIdx);
    });

    it('distributor buy price = importer sell + stateside', () => {
      const distRecap = result.layerRecaps.find((r) => r.layerId === 'distributor')!;
      // $132.91 + $10.00 = $142.91
      expect(distRecap.buyPrice).toBeCloseTo(142.91, 0);
    });

    it('wholesale matches old SS spec value', () => {
      // Distributor sell = $142.91 / (1 - 0.30) = $204.16
      expect(result.summary.wholesaleCase).toBeCloseTo(204.16, 0);
    });

    it('SRP per bottle matches old SS spec value', () => {
      // Retailer sell = $204.16 / (1 - 0.33) = $304.72
      // SRP/btl = $304.72 / 12 = $25.39
      expect(result.summary.srpBottle).toBeCloseTo(25.39, 1);
    });
  });

  describe('SS is more expensive than DI', () => {
    const diResult = calculateMarketPricing(usConfig, makeDIInputs());
    const ssResult = calculateMarketPricing(usConfig, makeSSInputs());

    it('SS SRP > DI SRP (importer margins on LIC vs FOB)', () => {
      expect(ssResult.summary.srpBottle).toBeGreaterThan(diResult.summary.srpBottle);
    });

    it('SS importer gross profit > DI importer gross profit', () => {
      const diImporter = diResult.layerRecaps.find((r) => r.layerId === 'importer')!;
      const ssImporter = ssResult.layerRecaps.find((r) => r.layerId === 'importer')!;
      expect(ssImporter.grossProfit).toBeGreaterThan(diImporter.grossProfit);
    });
  });

  describe('Pathway does not affect non-US markets', () => {
    it('UK import works unchanged (no pathway)', () => {
      const ukConfig = getMarketConfig('uk-import')!;
      const inputs = makeDefaultMarketInputs(ukConfig);
      expect(inputs.pathway).toBeUndefined();
      const result = calculateMarketPricing(ukConfig, inputs);
      expect(result.summary.srpBottle).toBeGreaterThan(0);
    });
  });
});
