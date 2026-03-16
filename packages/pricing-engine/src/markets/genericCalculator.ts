import type {
  MarketConfig,
  MarketPricingInputs,
  MarketPricingResult,
  WaterfallStep,
  LayerRecap,
  MarketWarning,
  TaxDef,
  TaxTiming,
} from './types';

/**
 * Generic market-aware pricing calculator.
 *
 * Processes any MarketConfig by walking through its distribution chain,
 * applying taxes and logistics at the appropriate points, and computing
 * margins using the specified mode (margin-on-selling or markup).
 *
 * Supports pathway variants (e.g., DI vs SS for US Import) which control:
 * - Whether taxes/logistics are active
 * - Whether they apply before or after a layer's margin
 * - What base value taxes are calculated on (FOB vs running cost)
 */
export function calculateMarketPricing(
  config: MarketConfig,
  inputs: MarketPricingInputs,
): MarketPricingResult {
  const casePack = inputs.casePack || 12;
  const warnings: MarketWarning[] = [];
  const waterfall: WaterfallStep[] = [];
  const layerRecaps: LayerRecap[] = [];
  const pathway = inputs.pathway;

  // Filter taxes and logistics by active pathway
  const activeTaxes = config.taxes.filter(
    (t) => !t.activeWhen || t.activeWhen === pathway,
  );
  const activeLogistics = config.logistics.filter(
    (l) => !l.activeWhen || l.activeWhen === pathway,
  );

  // ---- Step 1: Base cost in source currency ----
  const baseCaseSource = (inputs.costPerBottle || 0) * casePack;

  // ---- Step 2: FX conversion ----
  const effectiveRate = config.currency.needsConversion
    ? (inputs.exchangeRate || 1) * (1 + (inputs.exchangeBuffer || 0) / 100)
    : 1;
  const baseCaseTarget = baseCaseSource * effectiveRate;

  waterfall.push({
    id: 'base-cost',
    label: 'Base Case Cost',
    category: 'cost',
    perCase: baseCaseTarget,
    perBottle: casePack > 0 ? baseCaseTarget / casePack : 0,
    helper: config.currency.needsConversion
      ? `${formatVal(baseCaseSource, config.currency.sourceSymbol)} × ${effectiveRate.toFixed(4)}`
      : `${casePack} btl × ${formatVal(inputs.costPerBottle, config.currency.symbol)}`,
  });

  // ---- Step 3: Apply base-level taxes (before any margins) ----
  let runningCost = baseCaseTarget;
  const baseTaxes = activeTaxes.filter((t) => resolveTiming(t, pathway) === 'on_base_cost');
  for (const tax of baseTaxes) {
    const taxAmount = computeTax(tax, inputs, runningCost, casePack);
    if (taxAmount > 0) {
      waterfall.push({
        id: `tax-${tax.id}`,
        label: tax.label,
        category: 'tax',
        perCase: taxAmount,
        perBottle: casePack > 0 ? taxAmount / casePack : 0,
        helper: formatTaxHelper(tax, inputs),
      });
      runningCost += taxAmount;
    }
  }

  // ---- Step 4: Apply base-level logistics ----
  const baseLogistics = activeLogistics.filter((l) => l.afterLayer === '_base');
  for (const log of baseLogistics) {
    const logAmount = computeLogistics(log, inputs, runningCost);
    if (logAmount > 0) {
      waterfall.push({
        id: `logistics-${log.id}`,
        label: log.label,
        category: 'logistics',
        perCase: logAmount,
        perBottle: casePack > 0 ? logAmount / casePack : 0,
      });
      runningCost += logAmount;
    }
  }

  // ---- Step 5: Walk through each chain layer ----
  let landedCase = 0;
  let wholesaleCase = 0;
  let srpCase = 0;
  const activeLayers = config.chain.filter(
    (layer) => !layer.skippable || inputs.activeLayers.includes(layer.id),
  );

  for (let i = 0; i < activeLayers.length; i++) {
    const layer = activeLayers[i];
    // Save the buy price at the START of the layer (before any pre-margin additions)
    // This is used as the base for taxes with baseOn: 'layer_buy_price' (e.g., tariff on FOB)
    const layerBuyPrice = runningCost;

    // ---- Pre-margin taxes (before:{layerId}) ----
    // These are absorbed into the layer's cost basis (e.g., tariff into LIC for SS)
    const preMarginTaxes = activeTaxes.filter(
      (t) => resolveTiming(t, pathway) === `before:${layer.id}`,
    );
    for (const tax of preMarginTaxes) {
      const base = resolveBaseOn(tax, pathway) === 'layer_buy_price'
        ? layerBuyPrice
        : runningCost;
      const taxAmount = computeTax(tax, inputs, base, casePack);
      if (taxAmount > 0) {
        waterfall.push({
          id: `tax-${tax.id}`,
          label: tax.label,
          category: 'tax',
          perCase: taxAmount,
          perBottle: casePack > 0 ? taxAmount / casePack : 0,
          helper: formatTaxHelper(tax, inputs),
        });
        runningCost += taxAmount;
      }
    }

    // ---- Pre-margin logistics (beforeMargin: true) ----
    // These are absorbed into the layer's cost basis (e.g., ocean freight into LIC for SS)
    const preMarginLogistics = activeLogistics.filter(
      (l) => l.afterLayer === layer.id && l.beforeMargin,
    );
    for (const log of preMarginLogistics) {
      const logAmount = computeLogistics(log, inputs, runningCost);
      if (logAmount > 0) {
        waterfall.push({
          id: `logistics-${log.id}`,
          label: log.label,
          category: 'logistics',
          perCase: logAmount,
          perBottle: casePack > 0 ? logAmount / casePack : 0,
        });
        runningCost += logAmount;
      }
    }

    // ---- Apply margin ----
    // The effective buy price now includes any pre-margin taxes/logistics (LIC for SS)
    const effectiveBuyPrice = runningCost;
    const marginPct = inputs.margins[layer.id] ?? layer.defaultMargin;

    let layerSellPrice: number;
    if (layer.marginMode === 'on_selling') {
      layerSellPrice = marginPct >= 100 ? Infinity : effectiveBuyPrice / (1 - marginPct / 100);
    } else {
      layerSellPrice = effectiveBuyPrice * (1 + marginPct / 100);
    }

    const grossProfit = layerSellPrice - effectiveBuyPrice;

    waterfall.push({
      id: `layer-${layer.id}`,
      label: `${layer.label} Sell`,
      category: 'margin',
      perCase: layerSellPrice,
      perBottle: casePack > 0 ? layerSellPrice / casePack : 0,
      helper: `${marginPct.toFixed(1)}% ${layer.marginLabel.toLowerCase()}`,
    });

    layerRecaps.push({
      layerId: layer.id,
      label: layer.label,
      buyPrice: effectiveBuyPrice,
      sellPrice: layerSellPrice,
      grossProfit,
      marginPercent: marginPct,
    });

    runningCost = layerSellPrice;

    // ---- Post-margin taxes (after:{layerId}) ----
    const afterLayerTaxes = activeTaxes.filter(
      (t) => resolveTiming(t, pathway) === `after:${layer.id}`,
    );
    for (const tax of afterLayerTaxes) {
      const base = resolveBaseOn(tax, pathway) === 'layer_buy_price'
        ? layerBuyPrice
        : runningCost;
      const taxAmount = computeTax(tax, inputs, base, casePack);
      if (taxAmount > 0) {
        waterfall.push({
          id: `tax-${tax.id}`,
          label: tax.label,
          category: 'tax',
          perCase: taxAmount,
          perBottle: casePack > 0 ? taxAmount / casePack : 0,
          helper: formatTaxHelper(tax, inputs),
        });
        runningCost += taxAmount;
      }
    }

    // ---- Post-margin logistics ----
    const afterLayerLogistics = activeLogistics.filter(
      (l) => l.afterLayer === layer.id && !l.beforeMargin,
    );
    for (const log of afterLayerLogistics) {
      const logAmount = computeLogistics(log, inputs, runningCost);
      if (logAmount > 0) {
        waterfall.push({
          id: `logistics-${log.id}`,
          label: log.label,
          category: 'logistics',
          perCase: logAmount,
          perBottle: casePack > 0 ? logAmount / casePack : 0,
        });
        runningCost += logAmount;
      }
    }

    // Track key milestones
    if (i === 0 && activeLayers.length > 1) {
      // After first layer + its taxes/logistics = landed cost
      landedCase = runningCost;
    }
    if (i === activeLayers.length - 2) {
      // Second-to-last = wholesale
      wholesaleCase = runningCost;
    }
  }

  // For simple chains (1-2 layers), set reasonable defaults
  if (activeLayers.length <= 1) {
    landedCase = baseCaseTarget;
    wholesaleCase = runningCost;
  }
  if (activeLayers.length === 2) {
    landedCase = baseCaseTarget;
  }

  srpCase = runningCost;

  // Add landed subtotal to waterfall (before distribution layers)
  // We'll add this in a second pass for proper ordering

  // ---- Step 6: Apply wholesale-level taxes (e.g., WET) ----
  // WET applies to wholesale value and must be added before final taxes (GST is inclusive of WET)
  const wholesaleTaxes = activeTaxes.filter((t) => resolveTiming(t, pathway) === 'on_wholesale');
  for (const tax of wholesaleTaxes) {
    const taxRate = (inputs.taxes[tax.id] ?? tax.defaultValue) / 100;
    const wetAmount = wholesaleCase * taxRate;
    srpCase += wetAmount;
    waterfall.push({
      id: `tax-${tax.id}`,
      label: tax.label,
      category: 'tax',
      perCase: wetAmount,
      perBottle: casePack > 0 ? wetAmount / casePack : 0,
      helper: `${(inputs.taxes[tax.id] ?? tax.defaultValue).toFixed(1)}% of wholesale value`,
    });
  }

  // ---- Step 7: Apply final taxes (VAT/GST) ----
  // These apply on the final price, inclusive of any wholesale-level taxes
  const finalTaxes = activeTaxes.filter((t) => resolveTiming(t, pathway) === 'on_final');
  for (const tax of finalTaxes) {
    const taxAmount = computeTax(tax, inputs, srpCase, casePack);
    if (taxAmount > 0) {
      srpCase += taxAmount;
      waterfall.push({
        id: `tax-${tax.id}`,
        label: `${tax.label} (incl.)`,
        category: 'tax',
        perCase: srpCase,
        perBottle: casePack > 0 ? srpCase / casePack : 0,
        helper: `${(inputs.taxes[tax.id] ?? tax.defaultValue).toFixed(1)}% on retail price`,
        highlight: true,
      });
    }
  }

  // ---- Warnings ----
  if (!inputs.costPerBottle || inputs.costPerBottle <= 0) {
    warnings.push({ field: 'costPerBottle', message: 'Cost per bottle is zero — output reflects $0 cost basis.', severity: 'warn' });
  }
  if (config.currency.needsConversion && (!inputs.exchangeRate || inputs.exchangeRate <= 0)) {
    warnings.push({ field: 'exchangeRate', message: 'Exchange rate is zero or missing.', severity: 'error' });
  }
  for (const layer of activeLayers) {
    const m = inputs.margins[layer.id] ?? layer.defaultMargin;
    if (m >= 100) {
      warnings.push({ field: `margin-${layer.id}`, message: `${layer.label} margin of ${m}% — margin on selling price cannot reach 100%.`, severity: 'error' });
    }
    if (m >= 60 && m < 100) {
      warnings.push({ field: `margin-${layer.id}`, message: `${layer.label} margin of ${m}% is unusually high.`, severity: 'warn' });
    }
  }

  const srpBottle = casePack > 0 ? srpCase / casePack : 0;

  return {
    marketId: config.id,
    marketName: config.name,
    inputs,
    waterfall,
    summary: {
      baseCostCase: baseCaseSource,
      baseCostCaseTarget: baseCaseTarget,
      landedCase,
      wholesaleCase,
      srpCase,
      srpBottle,
    },
    layerRecaps,
    warnings,
    assumptions: {
      currency: config.currency.target,
      effectiveRate,
      marginMode: 'on_selling_price',
    },
  };
}

// ---- Pathway-aware helpers ----

/** Resolve effective tax timing, checking for pathway overrides */
function resolveTiming(tax: TaxDef, pathway?: string): TaxTiming {
  if (pathway && tax.pathwayOverrides?.[pathway]?.timing) {
    return tax.pathwayOverrides[pathway].timing!;
  }
  return tax.timing;
}

/** Resolve effective baseOn, checking for pathway overrides */
function resolveBaseOn(tax: TaxDef, pathway?: string): 'running_cost' | 'layer_buy_price' {
  if (pathway && tax.pathwayOverrides?.[pathway]?.baseOn) {
    return tax.pathwayOverrides[pathway].baseOn!;
  }
  return tax.baseOn || 'running_cost';
}

// ---- Tax computation helpers ----

function computeTax(
  tax: TaxDef,
  inputs: MarketPricingInputs,
  baseValue: number,
  casePack: number,
): number {
  const rate = inputs.taxes[tax.id] ?? tax.defaultValue;

  switch (tax.type) {
    case 'percent_of_value':
      return baseValue * (rate / 100);
    case 'per_bottle':
      return rate * casePack;
    case 'per_liter': {
      const bottleLiters = (inputs.bottleSizeMl || 750) / 1000;
      return rate * bottleLiters * casePack;
    }
    case 'per_liter_alcohol': {
      // rate is per litre of pure alcohol (e.g., UK £30.62/LAA)
      const litres = (inputs.bottleSizeMl || 750) / 1000;
      const abvFraction = (inputs.abv || 13) / 100;
      return rate * litres * abvFraction * casePack;
    }
    case 'per_case':
      return rate;
    default:
      return 0;
  }
}

function computeLogistics(
  log: { type: 'per_case' | 'percent'; defaultValue: number; id: string },
  inputs: MarketPricingInputs,
  baseValue: number,
): number {
  const val = inputs.logistics[log.id] ?? log.defaultValue;
  if (log.type === 'per_case') return val;
  if (log.type === 'percent') return baseValue * (val / 100);
  return 0;
}

function formatTaxHelper(tax: TaxDef, inputs: MarketPricingInputs): string {
  const rate = inputs.taxes[tax.id] ?? tax.defaultValue;
  if (tax.formatAs === 'percent') return `${rate}% ${tax.label.toLowerCase()}`;
  if (tax.type === 'per_liter_alcohol') return `${rate}/LAA × ${inputs.abv || 13}% ABV`;
  return `${rate} per unit`;
}

function formatVal(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}

// ---- Default inputs from market config ----

export function makeDefaultMarketInputs(config: MarketConfig): MarketPricingInputs {
  const margins: Record<string, number> = {};
  const taxes: Record<string, number> = {};
  const logistics: Record<string, number> = {};
  const activeLayers: string[] = [];

  for (const layer of config.chain) {
    margins[layer.id] = layer.defaultMargin;
    if (!layer.skippable) {
      activeLayers.push(layer.id);
    }
  }

  // Include skippable layers by default too
  for (const layer of config.chain) {
    if (layer.skippable) {
      activeLayers.push(layer.id);
    }
  }

  for (const tax of config.taxes) {
    // Deduplicate by ID (same tax may appear for multiple pathways)
    if (!(tax.id in taxes)) {
      taxes[tax.id] = tax.defaultValue;
    }
  }

  for (const log of config.logistics) {
    // Deduplicate by ID (same logistics may appear for multiple pathways)
    if (!(log.id in logistics)) {
      logistics[log.id] = log.defaultValue;
    }
  }

  // Set default pathway
  const pathway = config.pathways?.find((p) => p.default)?.id
    ?? config.pathways?.[0]?.id;

  return {
    marketId: config.id,
    costPerBottle: config.defaults.costPerBottle,
    casePack: config.defaults.casePack,
    bottleSizeMl: config.defaults.bottleSizeMl,
    abv: config.defaults.abv,
    exchangeRate: config.defaults.exchangeRate,
    exchangeBuffer: config.defaults.exchangeBuffer,
    margins,
    taxes,
    logistics,
    activeLayers,
    pathway,
  };
}
