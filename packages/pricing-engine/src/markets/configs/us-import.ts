import type { MarketConfig } from '../types';

export const US_IMPORT: MarketConfig = {
  id: 'us-import',
  name: 'US Import',
  flag: '🇺🇸',
  region: 'Americas',
  description: 'European or international wine imported into the US three-tier system.',

  currency: {
    source: 'EUR',
    target: 'USD',
    symbol: '$',
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
      defaultMargin: 30,
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
      id: 'tariff',
      label: 'Import Tariff',
      inputLabel: 'Tariff rate',
      type: 'percent_of_value',
      defaultValue: 15,
      timing: 'after:importer',           // Default (DI): pass-through after importer margin
      baseOn: 'layer_buy_price',           // Always calculated on FOB cost, not sell price
      editable: true,
      formatAs: 'percent',
      pathwayOverrides: {
        ss: { timing: 'before:importer' }, // SS: part of LIC, applied before importer margin
      },
    },
  ],

  logistics: [
    // DI: freight as pass-through after importer margin
    {
      id: 'freight',
      label: 'DI Freight',
      type: 'per_case',
      defaultValue: 13,
      afterLayer: 'importer',
      editable: true,
      activeWhen: 'di',
    },
    // SS: same ocean freight but absorbed into LIC before importer margin
    {
      id: 'freight',
      label: 'Ocean Freight',
      type: 'per_case',
      defaultValue: 13,
      afterLayer: 'importer',
      editable: true,
      activeWhen: 'ss',
      beforeMargin: true,
    },
    // SS: delivery from US warehouse to buyer, after importer margin
    {
      id: 'stateside',
      label: 'Stateside Logistics',
      type: 'per_case',
      defaultValue: 10,
      afterLayer: 'importer',
      editable: true,
      activeWhen: 'ss',
    },
  ],

  requiresAbv: false,
  requiresBottleSize: false,

  defaults: {
    costPerBottle: 5,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13,
    exchangeRate: 1.08,
    exchangeBuffer: 2,
  },

  pathways: [
    {
      id: 'di',
      label: 'Direct Import (DI)',
      description: 'Wine ships directly from overseas to the buyer. Importer margin on FOB only.',
      default: true,
    },
    {
      id: 'ss',
      label: 'Stateside (SS)',
      description: 'Wine sold from US warehouse. Importer margin on full laid-in cost (LIC).',
    },
  ],
};
