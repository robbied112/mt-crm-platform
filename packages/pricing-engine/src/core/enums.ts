// Who is using the pricing tool
export const TradeActor = {
  EuroWinery: 'EuroWinery',
  DomesticWinery: 'DomesticWinery',
  Importer: 'Importer',
  Supplier: 'Supplier',
  Distributor: 'Distributor',
  Retailer: 'Retailer',
} as const;

export type TradeActorType = (typeof TradeActor)[keyof typeof TradeActor];

// Downstream counterparty
export const Counterparty = {
  EuroWinery: 'EuroWinery',
  DomesticWinery: 'DomesticWinery',
  Importer: 'Importer',
  Supplier: 'Supplier',
  Distributor: 'Distributor',
  Retailer: 'Retailer',
} as const;

export type CounterpartyType = (typeof Counterparty)[keyof typeof Counterparty];

// Physical inventory location
export const InventoryContext = {
  Euro_FOB_Winery: 'Euro_FOB_Winery',
  Euro_Warehouse: 'Euro_Warehouse',
  US_Importer_WH: 'US_Importer_WH',
  US_Distributor_WH: 'US_Distributor_WH',
  US_Winery: 'US_Winery',
  US_Supplier_WH: 'US_Supplier_WH',
} as const;

export type InventoryContextType = (typeof InventoryContext)[keyof typeof InventoryContext];

// Role for recap perspective
export const RecapActor = {
  Supplier: 'Supplier',
  Importer: 'Importer',
  Distributor: 'Distributor',
  Retailer: 'Retailer',
} as const;

export type RecapActorType = (typeof RecapActor)[keyof typeof RecapActor];

// Pricing model identifiers
export const PricingModelId = {
  ImportedModelDI: 'ImportedModelDI',
  ImportedModelSS: 'ImportedModelSS',
  Domestic_Winery_ToDistributor: 'Domestic_Winery_ToDistributor',
  Domestic_Winery_ToRetailer: 'Domestic_Winery_ToRetailer',
  Domestic_Supplier_ToDistributor: 'Domestic_Supplier_ToDistributor',
  Domestic_Supplier_ToRetailer: 'Domestic_Supplier_ToRetailer',
  Euro_DI_ToRetailer: 'Euro_DI_ToRetailer',
  Distributor_ToRetailer: 'Distributor_ToRetailer',
} as const;

export type PricingModelIdType = (typeof PricingModelId)[keyof typeof PricingModelId];

// Currency types
export const Currency = {
  EUR: 'EUR',
  USD: 'USD',
} as const;

export type CurrencyType = (typeof Currency)[keyof typeof Currency];
