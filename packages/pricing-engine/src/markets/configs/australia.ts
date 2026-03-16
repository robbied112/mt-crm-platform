import type { MarketConfig } from '../types';

/**
 * Australia Import Market
 *
 * Australia's wine tax system includes:
 * - Import duty: 5% (from most countries)
 * - WET (Wine Equalisation Tax): 29% of the wholesale value
 * - GST: 10% on the final price (inclusive of WET)
 */
export const AUSTRALIA_IMPORT: MarketConfig = {
  id: 'au-import',
  name: 'Australia',
  flag: '🇦🇺',
  region: 'Asia-Pacific',
  description: 'Wine imported into Australia. Includes import duty, WET (29%), and GST (10%).',

  currency: {
    source: 'EUR',
    target: 'AUD',
    symbol: 'A$',
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
      defaultMargin: 25,
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
      id: 'import-duty',
      label: 'Import Duty',
      inputLabel: 'Import duty',
      type: 'percent_of_value',
      defaultValue: 5,
      timing: 'on_base_cost',
      editable: true,
      formatAs: 'percent',
    },
    {
      id: 'wet',
      label: 'WET',
      inputLabel: 'Wine Equalisation Tax',
      type: 'percent_of_value',
      defaultValue: 29,
      timing: 'on_wholesale',
      editable: true,
      formatAs: 'percent',
    },
    {
      id: 'gst',
      label: 'GST',
      inputLabel: 'GST rate',
      type: 'percent_of_value',
      defaultValue: 10,
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
      defaultValue: 15,
      afterLayer: '_base',
      editable: true,
    },
    {
      id: 'clearance',
      label: 'Customs Clearance',
      type: 'per_case',
      defaultValue: 5,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: false,
  requiresBottleSize: false,

  defaults: {
    costPerBottle: 4,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13.5,
    exchangeRate: 1.65,
    exchangeBuffer: 2,
  },
};
