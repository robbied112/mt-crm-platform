import type { PricingInputs, PricingResult, PricingWarning } from '../core/types';
import type { PricingModelIdType, CurrencyType } from '../core/enums';
import { MODEL_LABELS } from '../core/constants';

/**
 * Generate validation warnings based on inputs and computed results.
 */
function generateWarnings(
  inputs: PricingInputs,
  data: {
    currency: CurrencyType;
    srpCase: number;
    importerMarginPercent: number | null;
    distributorMarginPercent: number | null;
    retailerMarginPercent: number;
  },
): PricingWarning[] {
  const warnings: PricingWarning[] = [];

  if (!inputs.exCellarBottle || inputs.exCellarBottle <= 0) {
    warnings.push({ field: 'exCellarBottle', message: 'Ex-cellar price is zero — output reflects $0 cost basis.', severity: 'warn' });
  }

  if (data.currency === 'EUR' && (!inputs.exchangeRate || inputs.exchangeRate <= 0)) {
    warnings.push({ field: 'exchangeRate', message: 'Exchange rate is zero or missing — USD values will be $0.', severity: 'error' });
  }

  const margins = [
    { field: 'importerMarginPercent', value: data.importerMarginPercent, label: 'Importer' },
    { field: 'distributorMarginPercent', value: data.distributorMarginPercent, label: 'Distributor' },
    { field: 'retailerMarginPercent', value: data.retailerMarginPercent, label: 'Retailer' },
  ];

  for (const m of margins) {
    if (m.value !== null && m.value >= 100) {
      warnings.push({ field: m.field, message: `${m.label} margin is ${m.value}% — margin on selling price cannot reach 100%.`, severity: 'error' });
    }
    if (m.value !== null && m.value >= 60 && m.value < 100) {
      warnings.push({ field: m.field, message: `${m.label} margin of ${m.value}% is unusually high.`, severity: 'warn' });
    }
  }

  const casePack = inputs.casePack || 12;
  const srpBottle = casePack > 0 ? data.srpCase / casePack : 0;
  if (srpBottle > 500) {
    warnings.push({ field: 'srpBottle', message: `SRP of $${srpBottle.toFixed(2)}/bottle is extremely high — check inputs.`, severity: 'warn' });
  }

  return warnings;
}

/**
 * Build the normalized PricingResult shell.
 * Individual calculators fill in the specifics.
 */
export function buildResult(
  modelId: PricingModelIdType,
  inputs: PricingInputs,
  data: {
    currency: CurrencyType;
    effectiveExchangeRate: number;
    baseCaseSource: number;
    baseCaseUSD: number;
    importerFOBCase: number | null;
    importerLaidInCase: number | null;
    tariffCase: number | null;
    diFreightCase: number | null;
    landedCase: number;
    wholesaleCase: number;
    srpCase: number;
    importerGPPerCase: number | null;
    importerMarginPercent: number | null;
    distributorGPPerCase: number | null;
    distributorMarginPercent: number | null;
    retailerGPPerCase: number;
    retailerMarginPercent: number;
    warnings?: PricingWarning[];
  },
): PricingResult {
  const casePack = inputs.casePack || 12;

  const autoWarnings = generateWarnings(inputs, {
    currency: data.currency,
    srpCase: data.srpCase,
    importerMarginPercent: data.importerMarginPercent,
    distributorMarginPercent: data.distributorMarginPercent,
    retailerMarginPercent: data.retailerMarginPercent,
  });

  return {
    modelId,
    modelLabel: MODEL_LABELS[modelId] || modelId,
    inputs,
    bottle: {
      baseBottleCost: casePack > 0 ? data.baseCaseSource / casePack : 0,
      baseBottleUSD: casePack > 0 ? data.baseCaseUSD / casePack : 0,
      wholesaleBottle: casePack > 0 ? data.wholesaleCase / casePack : 0,
      srpBottle: casePack > 0 ? data.srpCase / casePack : 0,
    },
    case: {
      baseCaseSource: data.baseCaseSource,
      baseCaseUSD: data.baseCaseUSD,
      importerFOBCase: data.importerFOBCase,
      importerLaidInCase: data.importerLaidInCase,
      tariffCase: data.tariffCase,
      diFreightCase: data.diFreightCase,
      landedCase: data.landedCase,
      wholesaleCase: data.wholesaleCase,
      srpCase: data.srpCase,
    },
    margins: {
      importerGrossProfitPerCase: data.importerGPPerCase,
      importerMarginPercent: data.importerMarginPercent,
      distributorGrossProfitPerCase: data.distributorGPPerCase,
      distributorMarginPercent: data.distributorMarginPercent,
      retailerGrossProfitPerCase: data.retailerGPPerCase,
      retailerMarginPercent: data.retailerMarginPercent,
    },
    assumptions: {
      currency: data.currency,
      effectiveExchangeRate: data.effectiveExchangeRate,
      marginMode: 'on_selling_price',
    },
    warnings: [...autoWarnings, ...(data.warnings || [])],
  };
}
