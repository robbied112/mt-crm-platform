import type { MarketConfig } from '../types';

/**
 * South Africa Import Market
 *
 * European wine imported into South Africa. Key costs:
 * - 60% ad valorem import duty on FOB value
 * - R5.95 per litre excise duty
 * - 15% VAT on final retail price (inclusive)
 * - EUR → ZAR conversion (~19.27)
 *
 * Distribution: Importer → Distributor (optional) → Retailer
 */
export const SOUTH_AFRICA_IMPORT: MarketConfig = {
  id: 'za-import',
  name: 'South Africa',
  flag: '🇿🇦',
  region: 'Africa',
  description: 'European wine imported into South Africa. 60% import duty, excise, and 15% VAT.',

  currency: {
    source: 'EUR',
    target: 'ZAR',
    symbol: 'R',
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
      defaultMargin: 30,
    },
    {
      id: 'distributor',
      role: 'distributor',
      label: 'Distributor',
      marginLabel: 'Distributor margin',
      marginMode: 'on_selling',
      defaultMargin: 25,
      skippable: true,
    },
    {
      id: 'retailer',
      role: 'retailer',
      label: 'Retailer',
      marginLabel: 'Retailer margin',
      marginMode: 'on_selling',
      defaultMargin: 33,
    },
  ],

  taxes: [
    {
      id: 'import-duty',
      label: 'Import Duty',
      inputLabel: 'Import duty rate',
      type: 'percent_of_value',
      defaultValue: 60,
      timing: 'on_base_cost',
      editable: true,
      formatAs: 'percent',
    },
    {
      id: 'excise',
      label: 'Excise Duty',
      inputLabel: 'Excise (R/litre)',
      type: 'per_liter',
      defaultValue: 5.95,
      timing: 'on_base_cost',
      editable: true,
      formatAs: 'currency_per_unit',
      requiresBottleSize: true,
    },
    {
      id: 'vat',
      label: 'VAT',
      inputLabel: 'VAT rate',
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
      label: 'Shipping (sea freight)',
      type: 'per_case',
      defaultValue: 45,
      afterLayer: '_base',
      editable: true,
    },
    {
      id: 'clearance',
      label: 'Clearance & Handling',
      type: 'per_case',
      defaultValue: 15,
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
    abv: 13.5,
    exchangeRate: 19.27,
    exchangeBuffer: 2,
  },
};
