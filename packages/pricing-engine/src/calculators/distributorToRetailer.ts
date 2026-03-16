import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Distributor → Retailer.
 * Distributor sells from US warehouse to retail accounts.
 */
export function calculateDistributorToRetailer(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;

  const distributorBaseCase = (inputs.exCellarBottle || 0) * casePack;
  const landedCase = distributorBaseCase + (inputs.statesideLogisticsPerCase || 0);

  const wholesaleCase = applyMarginOnSelling(landedCase, inputs.distributorMarginPercent);

  const srpCase = applyMarginOnSelling(wholesaleCase, inputs.retailerMarginPercent);

  const distributorGPPerCase = wholesaleCase - landedCase;
  const retailerGPPerCase = srpCase - wholesaleCase;

  return buildResult('Distributor_ToRetailer', inputs, {
    currency: 'USD',
    effectiveExchangeRate: 1,
    baseCaseSource: distributorBaseCase,
    baseCaseUSD: distributorBaseCase,
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
