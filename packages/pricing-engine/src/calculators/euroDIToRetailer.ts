import type { PricingInputs, PricingResult } from '../core/types';
import { applyMarginOnSelling } from '../core/math';
import { buildResult } from './shared';

/**
 * Euro Winery → Retailer direct, DI.
 * Retailer buys direct, pays all DI costs, no importer or distributor margin.
 */
export function calculateEuroDIToRetailer(inputs: PricingInputs): PricingResult {
  const casePack = inputs.casePack || 12;
  const effectiveRate = inputs.exchangeRate * (1 + (inputs.exchangeBuffer || 0) / 100);

  const baseCostCaseUSD = (inputs.exCellarBottle || 0) * casePack * effectiveRate;

  const diFreightCaseUSD = inputs.diFreightPerCase || 0;
  const tariffOnBaseUSD = baseCostCaseUSD * ((inputs.tariffPercent || 0) / 100);

  const wholesaleCaseUSD = baseCostCaseUSD + diFreightCaseUSD + tariffOnBaseUSD;

  const srpCaseUSD = applyMarginOnSelling(wholesaleCaseUSD, inputs.retailerMarginPercent);

  const retailerGPPerCase = srpCaseUSD - wholesaleCaseUSD;

  return buildResult('Euro_DI_ToRetailer', inputs, {
    currency: 'EUR',
    effectiveExchangeRate: effectiveRate,
    baseCaseSource: (inputs.exCellarBottle || 0) * casePack,
    baseCaseUSD: baseCostCaseUSD,
    importerFOBCase: null,
    importerLaidInCase: null,
    tariffCase: tariffOnBaseUSD,
    diFreightCase: diFreightCaseUSD,
    landedCase: wholesaleCaseUSD,
    wholesaleCase: wholesaleCaseUSD,
    srpCase: srpCaseUSD,
    importerGPPerCase: null,
    importerMarginPercent: null,
    distributorGPPerCase: null,
    distributorMarginPercent: null,
    retailerGPPerCase,
    retailerMarginPercent: inputs.retailerMarginPercent,
  });
}
