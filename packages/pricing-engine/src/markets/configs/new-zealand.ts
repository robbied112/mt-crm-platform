import type { MarketConfig } from '../types';

/**
 * New Zealand Import Market
 *
 * NZ wine taxes:
 * - Excise: ~NZ$3.83 per liter for wine (varies by ABV)
 * - GST: 15% on the final price
 * - Import duty: 0% from most wine-producing countries (free trade agreements)
 */
export const NEW_ZEALAND_IMPORT: MarketConfig = {
  id: 'nz-import',
  name: 'New Zealand',
  flag: '🇳🇿',
  region: 'Asia-Pacific',
  description: 'Wine imported into New Zealand. Includes per-liter excise duty and 15% GST.',

  currency: {
    source: 'EUR',
    target: 'NZD',
    symbol: 'NZ$',
    sourceSymbol: '€',
    needsConversion: true,
  },

  chain: [
    {
      id: 'importer',
      role: 'importer',
      label: 'Importer',
      marginLabel: 'Importer margin',
      marginMode: 'on_selling',
      defaultMargin: 25,
    },
    {
      id: 'distributor',
      role: 'distributor',
      label: 'Distributor',
      marginLabel: 'Distributor margin',
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
      defaultMargin: 35,
    },
  ],

  taxes: [
    {
      id: 'excise',
      label: 'Excise Duty',
      inputLabel: 'Excise / liter',
      type: 'per_liter',
      defaultValue: 3.83,
      timing: 'on_base_cost',
      editable: true,
      formatAs: 'currency_per_unit',
      requiresBottleSize: true,
    },
    {
      id: 'gst',
      label: 'GST',
      inputLabel: 'GST rate',
      type: 'percent_of_value',
      defaultValue: 15,
      timing: 'on_final',
      editable: true,
      formatAs: 'percent',
      inclusive: true,
    },
  ],

  logistics: [
    {
      id: 'shipping',
      label: 'Ocean Freight',
      type: 'per_case',
      defaultValue: 18,
      afterLayer: '_base',
      editable: true,
    },
    {
      id: 'clearance',
      label: 'Customs & Clearance',
      type: 'per_case',
      defaultValue: 4,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: false,
  requiresBottleSize: true,

  defaults: {
    costPerBottle: 4,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13,
    exchangeRate: 1.78,
    exchangeBuffer: 2,
  },
};
