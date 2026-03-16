import type { MarketConfig } from '../types';

export const US_DOMESTIC: MarketConfig = {
  id: 'us-domestic',
  name: 'US Domestic',
  flag: '🇺🇸',
  region: 'Americas',
  description: 'Domestic US winery or supplier selling through the three-tier system.',

  currency: {
    source: 'USD',
    target: 'USD',
    symbol: '$',
    sourceSymbol: '$',
    needsConversion: false,
  },

  chain: [
    {
      id: 'distributor',
      role: 'distributor',
      label: 'Distributor',
      marginLabel: 'Distributor margin',
      marginMode: 'on_selling',
      defaultMargin: 30,
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

  taxes: [],

  logistics: [
    {
      id: 'stateside',
      label: 'Freight & Logistics',
      type: 'per_case',
      defaultValue: 10,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: false,
  requiresBottleSize: false,

  defaults: {
    costPerBottle: 8,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13.5,
    exchangeRate: 1,
    exchangeBuffer: 0,
  },
};
