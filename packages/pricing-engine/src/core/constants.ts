import {
  TradeActor,
  Counterparty,
  InventoryContext,
  type TradeActorType,
  type CounterpartyType,
  type InventoryContextType,
  type PricingModelIdType,
} from './enums';

// ---- Scenario Resolution Table ----

interface ScenarioMapping {
  whoAmI: TradeActorType;
  sellingTo: CounterpartyType;
  inventory: InventoryContextType;
  modelId: PricingModelIdType;
}

export const SCENARIO_TABLE: ScenarioMapping[] = [
  // Domestic winery
  {
    whoAmI: TradeActor.DomesticWinery,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.US_Winery,
    modelId: 'Domestic_Winery_ToDistributor',
  },
  {
    whoAmI: TradeActor.DomesticWinery,
    sellingTo: Counterparty.Retailer,
    inventory: InventoryContext.US_Winery,
    modelId: 'Domestic_Winery_ToRetailer',
  },

  // Euro winery (imported)
  {
    whoAmI: TradeActor.EuroWinery,
    sellingTo: Counterparty.Importer,
    inventory: InventoryContext.Euro_FOB_Winery,
    modelId: 'ImportedModelDI',
  },
  {
    whoAmI: TradeActor.EuroWinery,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.Euro_FOB_Winery,
    modelId: 'ImportedModelDI',
  },
  {
    whoAmI: TradeActor.EuroWinery,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.US_Importer_WH,
    modelId: 'ImportedModelSS',
  },
  {
    whoAmI: TradeActor.EuroWinery,
    sellingTo: Counterparty.Retailer,
    inventory: InventoryContext.Euro_FOB_Winery,
    modelId: 'Euro_DI_ToRetailer',
  },

  // Importer
  {
    whoAmI: TradeActor.Importer,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.Euro_FOB_Winery,
    modelId: 'ImportedModelDI',
  },
  {
    whoAmI: TradeActor.Importer,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.US_Importer_WH,
    modelId: 'ImportedModelSS',
  },
  {
    whoAmI: TradeActor.Importer,
    sellingTo: Counterparty.Retailer,
    inventory: InventoryContext.Euro_FOB_Winery,
    modelId: 'Euro_DI_ToRetailer',
  },

  // Supplier
  {
    whoAmI: TradeActor.Supplier,
    sellingTo: Counterparty.Distributor,
    inventory: InventoryContext.US_Supplier_WH,
    modelId: 'Domestic_Supplier_ToDistributor',
  },
  {
    whoAmI: TradeActor.Supplier,
    sellingTo: Counterparty.Retailer,
    inventory: InventoryContext.US_Supplier_WH,
    modelId: 'Domestic_Supplier_ToRetailer',
  },

  // Distributor
  {
    whoAmI: TradeActor.Distributor,
    sellingTo: Counterparty.Retailer,
    inventory: InventoryContext.US_Distributor_WH,
    modelId: 'Distributor_ToRetailer',
  },
];

// ---- Allowed downstream counterparties per role ----

export const ALLOWED_COUNTERPARTIES: Record<TradeActorType, CounterpartyType[]> = {
  [TradeActor.EuroWinery]: [Counterparty.Distributor, Counterparty.Importer, Counterparty.Retailer],
  [TradeActor.Importer]: [Counterparty.Distributor, Counterparty.Retailer],
  [TradeActor.DomesticWinery]: [Counterparty.Distributor, Counterparty.Retailer],
  [TradeActor.Supplier]: [Counterparty.Distributor, Counterparty.Retailer],
  [TradeActor.Distributor]: [Counterparty.Retailer],
  [TradeActor.Retailer]: [],
};

// ---- Allowed inventory contexts per role ----

export const ALLOWED_INVENTORY: Record<TradeActorType, InventoryContextType[]> = {
  [TradeActor.EuroWinery]: [InventoryContext.Euro_FOB_Winery, InventoryContext.US_Importer_WH],
  [TradeActor.Importer]: [InventoryContext.Euro_FOB_Winery, InventoryContext.US_Importer_WH],
  [TradeActor.DomesticWinery]: [InventoryContext.US_Winery],
  [TradeActor.Supplier]: [InventoryContext.US_Supplier_WH],
  [TradeActor.Distributor]: [InventoryContext.US_Distributor_WH],
  [TradeActor.Retailer]: [InventoryContext.US_Distributor_WH],
};

// ---- Human-readable labels ----

export const TRADE_ACTOR_LABELS: Record<TradeActorType, string> = {
  [TradeActor.EuroWinery]: 'European Winery',
  [TradeActor.DomesticWinery]: 'Domestic Winery',
  [TradeActor.Importer]: 'Importer',
  [TradeActor.Supplier]: 'Supplier',
  [TradeActor.Distributor]: 'Distributor',
  [TradeActor.Retailer]: 'Retailer',
};

export const COUNTERPARTY_LABELS: Record<CounterpartyType, string> = {
  [Counterparty.EuroWinery]: 'European Winery',
  [Counterparty.DomesticWinery]: 'Domestic Winery',
  [Counterparty.Importer]: 'Importer',
  [Counterparty.Supplier]: 'Supplier',
  [Counterparty.Distributor]: 'Distributor',
  [Counterparty.Retailer]: 'Retailer',
};

export const INVENTORY_LABELS: Record<InventoryContextType, string> = {
  [InventoryContext.Euro_FOB_Winery]: 'Euro FOB (Winery)',
  [InventoryContext.Euro_Warehouse]: 'Euro Warehouse',
  [InventoryContext.US_Importer_WH]: 'US Warehouse (Imported)',
  [InventoryContext.US_Distributor_WH]: 'US Warehouse (Distributor)',
  [InventoryContext.US_Winery]: 'US Winery',
  [InventoryContext.US_Supplier_WH]: 'US Warehouse (Supplier)',
};

export const MODEL_LABELS: Record<string, string> = {
  ImportedModelDI: 'Classic Import (DI)',
  ImportedModelSS: 'Imported Stateside (US Warehouse)',
  Domestic_Winery_ToDistributor: 'Domestic Winery to Distributor',
  Domestic_Winery_ToRetailer: 'Domestic Winery Self-Distribution',
  Domestic_Supplier_ToDistributor: 'Supplier to Distributor',
  Domestic_Supplier_ToRetailer: 'Supplier Direct to Retail',
  Euro_DI_ToRetailer: 'Euro Direct to Retailer',
  Distributor_ToRetailer: 'Distributor to Retailer',
  UnknownModel: 'Unknown Model',
};

// ---- Role-based field visibility ----

export interface FieldVisibility {
  exCellarBottle: boolean;
  exchangeRate: boolean;
  exchangeBuffer: boolean;
  tariffPercent: boolean;
  diFreightPerCase: boolean;
  statesideLogisticsPerCase: boolean;
  importerMarginPercent: boolean;
  distributorMarginPercent: boolean;
  retailerMarginPercent: boolean;
}

export const FIELD_VISIBILITY: Record<TradeActorType, FieldVisibility> = {
  [TradeActor.EuroWinery]: {
    exCellarBottle: true,
    exchangeRate: true,
    exchangeBuffer: true,
    tariffPercent: true,
    diFreightPerCase: true,
    statesideLogisticsPerCase: false,
    importerMarginPercent: true,
    distributorMarginPercent: true,
    retailerMarginPercent: true,
  },
  [TradeActor.Importer]: {
    exCellarBottle: true,
    exchangeRate: true,
    exchangeBuffer: true,
    tariffPercent: true,
    diFreightPerCase: true,
    statesideLogisticsPerCase: true,
    importerMarginPercent: true,
    distributorMarginPercent: true,
    retailerMarginPercent: true,
  },
  [TradeActor.DomesticWinery]: {
    exCellarBottle: true,
    exchangeRate: false,
    exchangeBuffer: false,
    tariffPercent: false,
    diFreightPerCase: false,
    statesideLogisticsPerCase: true,
    importerMarginPercent: false,
    distributorMarginPercent: true,
    retailerMarginPercent: true,
  },
  [TradeActor.Supplier]: {
    exCellarBottle: true,
    exchangeRate: false,
    exchangeBuffer: false,
    tariffPercent: false,
    diFreightPerCase: false,
    statesideLogisticsPerCase: true,
    importerMarginPercent: false,
    distributorMarginPercent: true,
    retailerMarginPercent: true,
  },
  [TradeActor.Distributor]: {
    exCellarBottle: true,
    exchangeRate: false,
    exchangeBuffer: false,
    tariffPercent: false,
    diFreightPerCase: false,
    statesideLogisticsPerCase: true,
    importerMarginPercent: false,
    distributorMarginPercent: true,
    retailerMarginPercent: true,
  },
  [TradeActor.Retailer]: {
    exCellarBottle: false,
    exchangeRate: false,
    exchangeBuffer: false,
    tariffPercent: false,
    diFreightPerCase: false,
    statesideLogisticsPerCase: true,
    importerMarginPercent: false,
    distributorMarginPercent: false,
    retailerMarginPercent: true,
  },
};

// ---- Default inputs ----

export const DEFAULT_INPUTS: Record<TradeActorType, Partial<import('./types').PricingInputs>> = {
  [TradeActor.EuroWinery]: {
    exchangeRate: 1.08,
    exchangeBuffer: 2,
    tariffPercent: 15,
    diFreightPerCase: 13,
    importerMarginPercent: 30,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  },
  [TradeActor.Importer]: {
    exchangeRate: 1.08,
    exchangeBuffer: 2,
    tariffPercent: 15,
    diFreightPerCase: 13,
    statesideLogisticsPerCase: 10,
    importerMarginPercent: 30,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  },
  [TradeActor.DomesticWinery]: {
    statesideLogisticsPerCase: 10,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  },
  [TradeActor.Supplier]: {
    statesideLogisticsPerCase: 10,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  },
  [TradeActor.Distributor]: {
    statesideLogisticsPerCase: 10,
    distributorMarginPercent: 30,
    retailerMarginPercent: 33,
  },
  [TradeActor.Retailer]: {
    retailerMarginPercent: 33,
  },
};
