import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Domestic Winery → Retail (self-distribution).
 * Winery acts as both supplier and distributor. No distributor margin layer.
 */
export function calculateDomesticSelfDistribution(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;

  const baseCaseUSD = (inputs.exCellarBottle || 0) * casePack;
  const landedCase = baseCaseUSD + (inputs.statesideLogisticsPerCase || 0);

  // No distributor step — wholesale equals landed
  const wholesaleCase = landedCase;

  const srpCase = applyMarginOnSelling(wholesaleCase, inputs.retailerMarginPercent);

  const retailerGPPerCase = srpCase - wholesaleCase;

  return buildResult('Domestic_Winery_ToRetailer', inputs, {
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
    distributorGPPerCase: null,
    distributorMarginPercent: null,
    retailerGPPerCase,
    retailerMarginPercent: inputs.retailerMarginPercent,
  });
}
