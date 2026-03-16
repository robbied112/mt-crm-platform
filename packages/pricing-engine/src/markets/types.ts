/**
 * Market configuration system.
 *
 * Each market defines its own distribution chain, tax/duty layers,
 * logistics costs, and currency setup. A generic calculator processes
 * any MarketConfig to produce a standard PricingResult.
 */

// ---- Currency ----

export interface CurrencyConfig {
  source: string;       // Producer's currency code (EUR, USD, CLP, NZD, AUD, GBP)
  target: string;       // Selling market currency code
  symbol: string;       // Target currency symbol for display ($, £, A$, NZ$)
  sourceSymbol: string; // Source currency symbol
  needsConversion: boolean;
}

// ---- Distribution Chain ----

export type MarginMode = 'on_selling' | 'markup';

export interface ChainLayer {
  id: string;
  role: string;           // Internal role key
  label: string;          // "Importer", "Wholesaler", "LCB", etc.
  marginLabel: string;    // "Importer margin", "Agent commission"
  marginMode: MarginMode;
  defaultMargin: number;
  skippable?: boolean;    // Can user remove this layer (e.g., distributor in DTC)
}

// ---- Tax / Duty Layers ----

export type TaxType =
  | 'percent_of_value'    // e.g., tariff 15% of FOB
  | 'per_bottle'          // e.g., fixed per-bottle levy
  | 'per_liter'           // e.g., NZ excise per liter
  | 'per_liter_alcohol'   // e.g., UK wine duty £30.62/L of pure alcohol (rate × litres × ABV)
  | 'per_case';           // flat per case

/**
 * When in the chain the tax applies:
 * - 'on_base_cost'  → before any margins (e.g., SS tariff on cost)
 * - 'after:{layerId}' → after a specific layer's margin (e.g., DI tariff after importer)
 * - 'on_landed'     → on the total landed cost
 * - 'on_wholesale'  → on the wholesale price (e.g., Australian WET)
 * - 'on_final'      → on the final consumer price, inclusive (e.g., VAT/GST)
 */
export type TaxTiming =
  | 'on_base_cost'
  | `before:${string}`   // Before a layer's margin (part of that layer's cost basis / LIC)
  | `after:${string}`
  | 'on_landed'
  | 'on_wholesale'
  | 'on_final';

export interface TaxDef {
  id: string;
  label: string;          // "UK Wine Duty", "VAT", "WET", "GST"
  inputLabel: string;     // Label for the input field
  type: TaxType;
  defaultValue: number;
  timing: TaxTiming;
  editable: boolean;      // Can user modify the rate?
  // For display
  formatAs: 'percent' | 'currency_per_unit';
  // For per-liter taxes, we need bottle size
  requiresBottleSize?: boolean;
  // For per-liter taxes based on ABV
  requiresAbv?: boolean;
  // Whether this is inclusive in the final price (VAT/GST)
  inclusive?: boolean;
  /** What value to calculate the tax on (default: 'running_cost').
   *  'layer_buy_price' = the buy price at the start of the layer (e.g., FOB for importer) */
  baseOn?: 'running_cost' | 'layer_buy_price';
  /** Only active when this pathway is selected (undefined = always active) */
  activeWhen?: string;
  /** Per-pathway overrides for timing and baseOn */
  pathwayOverrides?: Record<string, { timing?: TaxTiming; baseOn?: 'running_cost' | 'layer_buy_price' }>;
}

// ---- Logistics ----

export interface LogisticsDef {
  id: string;
  label: string;
  type: 'per_case' | 'percent';
  defaultValue: number;
  afterLayer: string;     // Applied after this chain layer
  editable: boolean;
  /** If true, this cost is added before the layer's margin (part of LIC / cost basis) */
  beforeMargin?: boolean;
  /** Only active when this pathway is selected (undefined = always active) */
  activeWhen?: string;
}

// ---- Pathways ----

export interface PathwayDef {
  id: string;
  label: string;
  description: string;
  default?: boolean;
}

// ---- Market Config ----

export interface MarketConfig {
  id: string;
  name: string;
  flag: string;           // Emoji flag
  region: 'Americas' | 'Europe' | 'Asia-Pacific' | 'South America' | 'Africa';
  description: string;

  currency: CurrencyConfig;

  /** Ordered distribution chain layers */
  chain: ChainLayer[];

  /** Tax/duty schedule */
  taxes: TaxDef[];

  /** Logistics cost points */
  logistics: LogisticsDef[];

  /** Whether ABV input is needed (for excise calculations) */
  requiresAbv: boolean;

  /** Whether bottle size input is needed */
  requiresBottleSize: boolean;

  /** Default input values for this market */
  defaults: MarketDefaults;

  /** Optional pathway variants (e.g., DI vs SS for US Import) */
  pathways?: PathwayDef[];
}

export interface MarketDefaults {
  costPerBottle: number;
  casePack: number;
  bottleSizeMl: number;
  abv: number;
  exchangeRate: number;
  exchangeBuffer: number;
}

// ---- Market Pricing Inputs ----

export interface MarketPricingInputs {
  marketId: string;

  // Product
  costPerBottle: number;    // In source currency
  casePack: number;
  bottleSizeMl: number;     // For per-liter tax calculations
  abv: number;              // For excise calculations

  // Currency
  exchangeRate: number;
  exchangeBuffer: number;

  // Dynamic: margins keyed by chain layer ID
  margins: Record<string, number>;

  // Dynamic: tax values keyed by tax ID
  taxes: Record<string, number>;

  // Dynamic: logistics values keyed by logistics ID
  logistics: Record<string, number>;

  // Which chain layers are active (for skippable layers)
  activeLayers: string[];

  // Selected pathway (e.g., 'di' or 'ss' for US Import)
  pathway?: string;
}

// ---- Market Pricing Result ----

export interface WaterfallStep {
  id: string;
  label: string;
  category: 'cost' | 'tax' | 'logistics' | 'margin' | 'subtotal' | 'final';
  perCase: number;
  perBottle: number;
  helper?: string;         // Explanatory text
  highlight?: boolean;
}

export interface MarketPricingResult {
  marketId: string;
  marketName: string;
  inputs: MarketPricingInputs;

  // The full waterfall breakdown
  waterfall: WaterfallStep[];

  // Key summary figures
  summary: {
    baseCostCase: number;
    baseCostCaseTarget: number;   // After FX conversion
    landedCase: number;
    wholesaleCase: number;
    srpCase: number;
    srpBottle: number;
  };

  // Per-layer P&L for recaps
  layerRecaps: LayerRecap[];

  // Warnings
  warnings: MarketWarning[];

  // Assumptions
  assumptions: {
    currency: string;
    effectiveRate: number;
    marginMode: string;
  };
}

export interface LayerRecap {
  layerId: string;
  label: string;
  buyPrice: number;
  sellPrice: number;
  grossProfit: number;
  marginPercent: number;
}

export interface MarketWarning {
  field: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}
