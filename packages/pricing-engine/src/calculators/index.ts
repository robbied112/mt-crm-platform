import type { PricingInputs, PricingResult } from '../core/types';
import type { PricingModelIdType } from '../core/enums';
import { resolvePricingModelId } from '../core/resolver';
import { MODEL_LABELS } from '../core/constants';
import { calculateImportedDI } from './importClassicDI';
import { calculateImportedSS } from './importStatesideSS';
import { calculateEuroDIToRetailer } from './euroDIToRetailer';
import { calculateDomesticToDistributor } from './domesticToDistributor';
import { calculateDomesticSelfDistribution } from './domesticSelfDistribution';
import { calculateSupplierToDistributor } from './supplierToDistributor';
import { calculateSupplierToRetailer } from './supplierToRetailer';
import { calculateDistributorToRetailer } from './distributorToRetailer';

const CALCULATOR_MAP: Record<PricingModelIdType, (inputs: PricingInputs) => PricingResult> = {
  ImportedModelDI: calculateImportedDI,
  ImportedModelSS: calculateImportedSS,
  Euro_DI_ToRetailer: calculateEuroDIToRetailer,
  Domestic_Winery_ToDistributor: calculateDomesticToDistributor,
  Domestic_Winery_ToRetailer: calculateDomesticSelfDistribution,
  Domestic_Supplier_ToDistributor: calculateSupplierToDistributor,
  Domestic_Supplier_ToRetailer: calculateSupplierToRetailer,
  Distributor_ToRetailer: calculateDistributorToRetailer,
};

/**
 * Main pricing dispatch. Resolves the model from context, then runs the right calculator.
 */
export function calculatePricing(inputs: PricingInputs): PricingResult {
  const modelId = resolvePricingModelId(inputs.whoAmI, inputs.sellingTo, inputs.inventory);

  if (!modelId || !(modelId in CALCULATOR_MAP)) {
    return {
      modelId: 'UnknownModel',
      modelLabel: MODEL_LABELS['UnknownModel'],
      inputs,
      bottle: { baseBottleCost: 0, baseBottleUSD: 0, wholesaleBottle: 0, srpBottle: 0 },
      case: {
        baseCaseSource: 0, baseCaseUSD: 0, importerFOBCase: null, importerLaidInCase: null,
        tariffCase: null, diFreightCase: null, landedCase: 0, wholesaleCase: 0, srpCase: 0,
      },
      margins: {
        importerGrossProfitPerCase: null, importerMarginPercent: null,
        distributorGrossProfitPerCase: null, distributorMarginPercent: null,
        retailerGrossProfitPerCase: 0, retailerMarginPercent: 0,
      },
      assumptions: { currency: 'USD', effectiveExchangeRate: 1, marginMode: 'on_selling_price' },
      warnings: [{ field: 'model', message: 'Could not resolve pricing model from context', severity: 'error' }],
    };
  }

  return CALCULATOR_MAP[modelId](inputs);
}

export {
  calculateImportedDI,
  calculateImportedSS,
  calculateEuroDIToRetailer,
  calculateDomesticToDistributor,
  calculateDomesticSelfDistribution,
  calculateSupplierToDistributor,
  calculateSupplierToRetailer,
  calculateDistributorToRetailer,
};
