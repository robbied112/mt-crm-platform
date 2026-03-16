import type { MarketConfig } from '../types';

/**
 * EU Internal Market (e.g., France → Germany, Italy → Netherlands)
 *
 * No tariffs within the EU single market.
 * VAT applies at the destination country rate.
 * Some countries have excise duties on wine, others exempt it.
 */
export const EU_INTERNAL: MarketConfig = {
  id: 'eu-internal',
  name: 'EU Internal',
  flag: '🇪🇺',
  region: 'Europe',
  description: 'Intra-EU wine trade. No tariffs, destination VAT applies.',

  currency: {
    source: 'EUR',
    target: 'EUR',
    symbol: '€',
    sourceSymbol: '€',
    needsConversion: false,
  },

  chain: [
    {
      id: 'agent',
      role: 'agent',
      label: 'Agent / Négociant',
      marginLabel: 'Agent margin',
      marginMode: 'on_selling',
      defaultMargin: 15,
      skippable: true,
    },
    {
      id: 'distributor',
      role: 'distributor',
      label: 'Distributor',
      marginLabel: 'Distributor margin',
      marginMode: 'on_selling',
      defaultMargin: 25,
    },
    {
      id: 'retailer',
      role: 'retailer',
      label: 'Retailer',
      marginLabel: 'Retailer margin',
      marginMode: 'on_selling',
      defaultMargin: 30,
    },
  ],

  taxes: [
    {
      id: 'vat',
      label: 'VAT',
      inputLabel: 'Destination VAT',
      type: 'percent_of_value',
      defaultValue: 19,
      timing: 'on_final',
      editable: true,
      formatAs: 'percent',
      inclusive: true,
    },
  ],

  logistics: [
    {
      id: 'freight',
      label: 'Intra-EU Freight',
      type: 'per_case',
      defaultValue: 8,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: false,
  requiresBottleSize: false,

  defaults: {
    costPerBottle: 5,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13,
    exchangeRate: 1,
    exchangeBuffer: 0,
  },
};
