import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * ImportedModelSS: Euro Winery → US Warehouse → Distributor → Retail
 * Inventory sits in importer's US warehouse. Distributor buys ex-WH.
 *
 * Key distinction: Tariff is calculated on base cost (before importer margin).
 * Importer absorbs DI freight + tariff into their laid-in cost, then applies margin.
 */
export function calculateImportedSS(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;
  const effectiveRate = inputs.exchangeRate * (1 + (inputs.exchangeBuffer || 0) / 100);

  const baseCostCaseUSD = (inputs.exCellarBottle || 0) * casePack * effectiveRate;

  const diFreightCaseUSD = inputs.diFreightPerCase || 0;
  const tariffOnBaseUSD = baseCostCaseUSD * ((inputs.tariffPercent || 0) / 100);

  const importerLaidInCaseUSD = baseCostCaseUSD + diFreightCaseUSD + tariffOnBaseUSD;

  const importerFOBCaseUSD = applyMarginOnSelling(importerLaidInCaseUSD, inputs.importerMarginPercent);

  const statesideCaseUSD = inputs.statesideLogisticsPerCase || 0;
  const distributorLandedCaseUSD = importerFOBCaseUSD + statesideCaseUSD;

  const wholesaleCaseUSD = applyMarginOnSelling(distributorLandedCaseUSD, inputs.distributorMarginPercent);

  const srpCaseUSD = applyMarginOnSelling(wholesaleCaseUSD, inputs.retailerMarginPercent);

  const importerGPPerCase = importerFOBCaseUSD - importerLaidInCaseUSD;
  const distributorGPPerCase = wholesaleCaseUSD - distributorLandedCaseUSD;
  const retailerGPPerCase = srpCaseUSD - wholesaleCaseUSD;

  return buildResult('ImportedModelSS', inputs, {
    currency: 'EUR',
    effectiveExchangeRate: effectiveRate,
    baseCaseSource: (inputs.exCellarBottle || 0) * casePack,
    baseCaseUSD: baseCostCaseUSD,
    importerFOBCase: importerFOBCaseUSD,
    importerLaidInCase: importerLaidInCaseUSD,
    tariffCase: tariffOnBaseUSD,
    diFreightCase: diFreightCaseUSD,
    landedCase: distributorLandedCaseUSD,
    wholesaleCase: wholesaleCaseUSD,
    srpCase: srpCaseUSD,
    importerGPPerCase,
    importerMarginPercent: inputs.importerMarginPercent,
    distributorGPPerCase,
    distributorMarginPercent: inputs.distributorMarginPercent,
    retailerGPPerCase,
    retailerMarginPercent: inputs.retailerMarginPercent,
  });
}
