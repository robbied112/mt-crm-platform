import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Domestic Supplier → Distributor.
 * Supplier sells from US warehouse to distributor.
 */
export function calculateSupplierToDistributor(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;

  const supplierBaseCase = (inputs.exCellarBottle || 0) * casePack;
  const distributorLaidInCase = supplierBaseCase + (inputs.statesideLogisticsPerCase || 0);

  const wholesaleCase = applyMarginOnSelling(distributorLaidInCase, inputs.distributorMarginPercent);

  const srpCase = applyMarginOnSelling(wholesaleCase, inputs.retailerMarginPercent);

  const distributorGPPerCase = wholesaleCase - distributorLaidInCase;
  const retailerGPPerCase = srpCase - wholesaleCase;

  return buildResult('Domestic_Supplier_ToDistributor', inputs, {
    currency: 'USD',
    effectiveExchangeRate: 1,
    baseCaseSource: supplierBaseCase,
    baseCaseUSD: supplierBaseCase,
    importerFOBCase: null,
    importerLaidInCase: null,
    tariffCase: null,
    diFreightCase: null,
    landedCase: distributorLaidInCase,
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
