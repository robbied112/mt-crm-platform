import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Domestic Supplier → Retailer direct.
 * Supplier sells from US warehouse direct to retail, no distributor layer.
 */
export function calculateSupplierToRetailer(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;

  const supplierBaseCase = (inputs.exCellarBottle || 0) * casePack;
  const retailerLaidInCase = supplierBaseCase + (inputs.statesideLogisticsPerCase || 0);

  const wholesaleCase = retailerLaidInCase;

  const srpCase = applyMarginOnSelling(wholesaleCase, inputs.retailerMarginPercent);

  const retailerGPPerCase = srpCase - wholesaleCase;

  return buildResult('Domestic_Supplier_ToRetailer', inputs, {
    currency: 'USD',
    effectiveExchangeRate: 1,
    baseCaseSource: supplierBaseCase,
    baseCaseUSD: supplierBaseCase,
    importerFOBCase: null,
    importerLaidInCase: null,
    tariffCase: null,
    diFreightCase: null,
    landedCase: retailerLaidInCase,
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
