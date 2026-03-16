import type { MarketConfig } from '../types';
import { US_IMPORT } from './us-import';
import { US_DOMESTIC } from './us-domestic';
import { UK_IMPORT } from './uk';
import { AUSTRALIA_IMPORT } from './australia';
import { NEW_ZEALAND_IMPORT } from './new-zealand';
import { SOUTH_AMERICA_EXPORT } from './south-america';
import { EU_INTERNAL } from './eu-internal';
import { SOUTH_AFRICA_IMPORT } from './south-africa';

export const MARKET_CONFIGS: MarketConfig[] = [
  US_IMPORT,
  US_DOMESTIC,
  UK_IMPORT,
  AUSTRALIA_IMPORT,
  NEW_ZEALAND_IMPORT,
  SOUTH_AMERICA_EXPORT,
  EU_INTERNAL,
  SOUTH_AFRICA_IMPORT,
];

export const MARKET_MAP: Record<string, MarketConfig> = Object.fromEntries(
  MARKET_CONFIGS.map((m) => [m.id, m]),
);

export function getMarketConfig(marketId: string): MarketConfig | undefined {
  return MARKET_MAP[marketId];
}
