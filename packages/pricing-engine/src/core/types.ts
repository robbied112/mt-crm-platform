import type {
  TradeActorType,
  CounterpartyType,
  InventoryContextType,
  PricingModelIdType,
  CurrencyType,
  RecapActorType,
} from './enums';

// ---- Inputs ----

export interface PricingInputs {
  // Context selection
  whoAmI: TradeActorType;
  sellingTo: CounterpartyType;
  inventory: InventoryContextType;

  // Product
  exCellarBottle: number;
  casePack: number;

  // FX (for euro models)
  exchangeRate: number;
  exchangeBuffer: number;

  // Logistics
  diFreightPerCase: number;
  tariffPercent: number;
  statesideLogisticsPerCase: number;

  // Margins (all margin on selling price)
  importerMarginPercent: number;
  distributorMarginPercent: number;
  retailerMarginPercent: number;
}

// ---- Normalized Output ----

export interface BottleMetrics {
  baseBottleCost: number; // in source currency
  baseBottleUSD: number;
  wholesaleBottle: number;
  srpBottle: number;
}

export interface CaseMetrics {
  baseCaseSource: number; // in source currency
  baseCaseUSD: number;
  importerFOBCase: number | null; // null if no importer layer
  importerLaidInCase: number | null;
  tariffCase: number | null;
  diFreightCase: number | null;
  landedCase: number;
  wholesaleCase: number;
  srpCase: number;
}

export interface MarginMetrics {
  importerGrossProfitPerCase: number | null;
  importerMarginPercent: number | null;
  distributorGrossProfitPerCase: number | null;
  distributorMarginPercent: number | null;
  retailerGrossProfitPerCase: number;
  retailerMarginPercent: number;
}

export interface RecapLine {
  label: string;
  perCase: number;
  perBottle: number;
}

export interface RecapSummary {
  actor: RecapActorType;
  lines: RecapLine[];
}

export interface PricingWarning {
  field: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface PricingAssumptions {
  currency: CurrencyType;
  effectiveExchangeRate: number;
  marginMode: 'on_selling_price';
}

export interface PricingResult {
  modelId: PricingModelIdType | 'UnknownModel';
  modelLabel: string;
  inputs: PricingInputs;

  bottle: BottleMetrics;
  case: CaseMetrics;
  margins: MarginMetrics;

  assumptions: PricingAssumptions;
  warnings: PricingWarning[];
}

// ---- Scenario ----

export interface Scenario {
  id: string;
  label: string;
  inputs: PricingInputs;
  result: PricingResult | null;
  presetId: string | null;
}

// ---- Comparison ----

export interface ComparisonDelta {
  field: string;
  label: string;
  baseline: number;
  comparison: number;
  delta: number;
  percentChange: number | null;
}

export interface ComparisonResult {
  baseline: PricingResult;
  comparison: PricingResult;
  deltas: ComparisonDelta[];
  changedInputs: string[];
}

// ---- Presets ----

export interface Preset {
  id: string;
  name: string;
  description: string;
  lockedFields: (keyof PricingInputs)[];
  values: Partial<PricingInputs>;
}
