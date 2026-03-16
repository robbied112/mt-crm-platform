import type { Preset } from '../core/types';

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'eu-baseline',
    name: 'EU Baseline',
    description: 'Standard 12-pack EU import at 15% tariff with typical margins.',
    lockedFields: [
      'tariffPercent',
      'exchangeBuffer',
      'diFreightPerCase',
      'statesideLogisticsPerCase',
      'importerMarginPercent',
      'distributorMarginPercent',
      'retailerMarginPercent',
    ],
    values: {
      exchangeBuffer: 2,
      tariffPercent: 15,
      diFreightPerCase: 13,
      statesideLogisticsPerCase: 10,
      importerMarginPercent: 30,
      distributorMarginPercent: 30,
      retailerMarginPercent: 33,
    },
  },
  {
    id: 'aggressive-margin',
    name: 'Aggressive Margin',
    description: 'Lower margins across the chain for competitive pricing.',
    lockedFields: [
      'importerMarginPercent',
      'distributorMarginPercent',
      'retailerMarginPercent',
    ],
    values: {
      importerMarginPercent: 25,
      distributorMarginPercent: 27,
      retailerMarginPercent: 30,
    },
  },
  {
    id: '6-pack-program',
    name: '6-Pack Program',
    description: '6-bottle case with adjusted logistics.',
    lockedFields: ['casePack', 'diFreightPerCase'],
    values: {
      casePack: 6,
      diFreightPerCase: 8,
    },
  },
  {
    id: 'low-freight',
    name: 'Low Freight',
    description: 'Reduced DI freight and stateside logistics for efficient shipping.',
    lockedFields: ['diFreightPerCase', 'statesideLogisticsPerCase'],
    values: {
      diFreightPerCase: 8,
      statesideLogisticsPerCase: 6,
    },
  },
  {
    id: 'high-tariff',
    name: 'High Tariff',
    description: 'Elevated tariff scenario for stress-testing pricing.',
    lockedFields: ['tariffPercent'],
    values: {
      tariffPercent: 25,
    },
  },
  {
    id: 'domestic-standard',
    name: 'Domestic Standard',
    description: 'Standard domestic winery 3-tier assumptions.',
    lockedFields: [
      'statesideLogisticsPerCase',
      'distributorMarginPercent',
      'retailerMarginPercent',
    ],
    values: {
      statesideLogisticsPerCase: 10,
      distributorMarginPercent: 30,
      retailerMarginPercent: 33,
    },
  },
];
