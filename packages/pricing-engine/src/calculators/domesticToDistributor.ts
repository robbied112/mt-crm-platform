import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Domestic Winery → Distributor (classic 3-tier).
 * No FX, no tariff, no DI freight. Winery sells to distributor who sells to retail.
 */
export function calculateDomesticToDistributor(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;

  const baseCaseUSD = (inputs.exCellarBottle || 0) * casePack;
  const landedCase = baseCaseUSD + (inputs.statesideLogisticsPerCase || 0);

  const wholesaleCase = applyMarginOnSelling(landedCase, inputs.distributorMarginPercent);

  const srpCase = applyMarginOnSelling(wholesaleCase, inputs.retailerMarginPercent);

  const distributorGPPerCase = wholesaleCase - landedCase;
  const retailerGPPerCase = srpCase - wholesaleCase;

  return buildResult('Domestic_Winery_ToDistributor', inputs, {
    currency: 'USD',
    effectiveExchangeRate: 1,
    baseCaseSource: baseCaseUSD,
    baseCaseUSD,
    importerFOBCase: null,
    importerLaidInCase: null,
    tariffCase: null,
    diFreightCase: null,
    landedCase,
    wholesaleCase,
    srpCase,
    importerGPPerCase: null,
    importerMarginPercent: null,
    distributorGPPerCase,
    distributorMarginPercent: inputs.distributorMarginPercent,
    retailerGPPerCase,
    retailerMarginPercent: inputs.retailerMarginPercent,
  });
}
