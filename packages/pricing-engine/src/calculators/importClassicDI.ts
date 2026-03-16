import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * ImportedModelDI: Euro Winery → Importer → Distributor → Retail
 * Inventory at Euro winery, importer sells DI containers to distributor.
 *
 * Key distinction: Tariff is calculated on importer FOB (after importer margin).
 */
export function calculateImportedDI(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;
  const effectiveRate = inputs.exchangeRate * (1 + (inputs.exchangeBuffer || 0) / 100);

  const importerCostCaseUSD = (inputs.exCellarBottle || 0) * casePack * effectiveRate;

  const importerFOBCaseUSD = applyMarginOnSelling(importerCostCaseUSD, inputs.importerMarginPercent);

  const tariffCaseUSD = importerFOBCaseUSD * ((inputs.tariffPercent || 0) / 100);
  const diFreightCaseUSD = inputs.diFreightPerCase || 0;

  const distributorLandedCaseUSD = importerFOBCaseUSD + tariffCaseUSD + diFreightCaseUSD;

  const wholesaleCaseUSD = applyMarginOnSelling(distributorLandedCaseUSD, inputs.distributorMarginPercent);

  const srpCaseUSD = applyMarginOnSelling(wholesaleCaseUSD, inputs.retailerMarginPercent);

  const importerGPPerCase = importerFOBCaseUSD - importerCostCaseUSD;
  const distributorGPPerCase = wholesaleCaseUSD - distributorLandedCaseUSD;
  const retailerGPPerCase = srpCaseUSD - wholesaleCaseUSD;

  return buildResult('ImportedModelDI', inputs, {
    currency: 'EUR',
    effectiveExchangeRate: effectiveRate,
    baseCaseSource: (inputs.exCellarBottle || 0) * casePack,
    baseCaseUSD: importerCostCaseUSD,
    importerFOBCase: importerFOBCaseUSD,
    importerLaidInCase: importerCostCaseUSD,
    tariffCase: tariffCaseUSD,
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
