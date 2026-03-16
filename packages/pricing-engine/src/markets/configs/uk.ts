import type { MarketConfig } from '../types';

/**
 * UK Import Market
 *
 * Since Feb 2025, UK wine duty is based on ABV: £30.62 per litre of
 * pure alcohol (for still wines 8.5–22% ABV).
 * For a 750ml bottle at 13% ABV: £30.62 × 0.75 × 0.13 = £2.99.
 * VAT at 20% is applied on the final retail price (inclusive).
 */
export const UK_IMPORT: MarketConfig = {
  id: 'uk-import',
  name: 'UK Import',
  flag: '🇬🇧',
  region: 'Europe',
  description: 'Wine imported into the UK market. Duty is ABV-based (£30.62/LAA) plus VAT at 20%.',

  currency: {
    source: 'EUR',
    target: 'GBP',
    symbol: '£',
    sourceSymbol: '€',
    needsConversion: true,
  },

  chain: [
    {
      id: 'importer',
      role: 'importer',
      label: 'Importer / Agent',
      marginLabel: 'Importer margin',
      marginMode: 'on_selling',
      defaultMargin: 25,
    },
    {
      id: 'wholesaler',
      role: 'wholesaler',
      label: 'Wholesaler',
      marginLabel: 'Wholesaler margin',
      marginMode: 'on_selling',
      defaultMargin: 20,
      skippable: true,
    },
    {
      id: 'retailer',
      role: 'retailer',
      label: 'Retailer',
      marginLabel: 'Retailer margin',
      marginMode: 'on_selling',
      defaultMargin: 40,
    },
  ],

  taxes: [
    {
      id: 'uk-duty',
      label: 'UK Wine Duty',
      inputLabel: 'Duty rate (£/LAA)',
      type: 'per_liter_alcohol',
      defaultValue: 30.62,
      timing: 'on_base_cost',
      editable: true,
      formatAs: 'currency_per_unit',
      requiresAbv: true,
      requiresBottleSize: true,
    },
    {
      id: 'vat',
      label: 'VAT',
      inputLabel: 'VAT rate',
      type: 'percent_of_value',
      defaultValue: 20,
      timing: 'on_final',
      editable: true,
      formatAs: 'percent',
      inclusive: true,
    },
  ],

  logistics: [
    {
      id: 'shipping',
      label: 'Shipping',
      type: 'per_case',
      defaultValue: 12,
      afterLayer: '_base',
      editable: true,
    },
    {
      id: 'clearance',
      label: 'UK Clearance',
      type: 'per_case',
      defaultValue: 3,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: true,
  requiresBottleSize: true,

  defaults: {
    costPerBottle: 4,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13,
    exchangeRate: 0.86,
    exchangeBuffer: 2,
  },
};
