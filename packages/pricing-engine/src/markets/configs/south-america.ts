import type { MarketConfig } from '../types';

/**
 * South America Export (Chile / Argentina)
 *
 * Models FOB export pricing from a Chilean or Argentine winery.
 * The "target" is the FOB USD price that an importer would pay.
 * Minimal export taxes; main costs are production + inland logistics to port.
 */
export const SOUTH_AMERICA_EXPORT: MarketConfig = {
  id: 'sa-export',
  name: 'Chile / Argentina',
  flag: '🇨🇱',
  region: 'South America',
  description: 'FOB export pricing from Chilean or Argentine wineries to international buyers.',

  currency: {
    source: 'CLP',
    target: 'USD',
    symbol: '$',
    sourceSymbol: 'CLP$',
    needsConversion: true,
  },

  chain: [
    {
      id: 'export-agent',
      role: 'agent',
      label: 'Export Agent',
      marginLabel: 'Agent commission',
      marginMode: 'on_selling',
      defaultMargin: 10,
      skippable: true,
    },
  ],

  taxes: [],

  logistics: [
    {
      id: 'inland-freight',
      label: 'Inland Freight to Port',
      type: 'per_case',
      defaultValue: 3,
      afterLayer: '_base',
      editable: true,
    },
    {
      id: 'port-handling',
      label: 'Port & Handling',
      type: 'per_case',
      defaultValue: 2,
      afterLayer: '_base',
      editable: true,
    },
  ],

  requiresAbv: false,
  requiresBottleSize: false,

  defaults: {
    costPerBottle: 2500,
    casePack: 12,
    bottleSizeMl: 750,
    abv: 13.5,
    exchangeRate: 0.00106,
    exchangeBuffer: 3,
  },
};
