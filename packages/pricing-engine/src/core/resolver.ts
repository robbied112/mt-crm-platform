import type { TradeActorType, CounterpartyType, InventoryContextType, PricingModelIdType } from './enums';
import { InventoryContext } from './enums';
import { SCENARIO_TABLE } from './constants';

/**
 * Normalize human-readable inventory labels to enum values.
 */
function normalizeInventory(value: string): string {
  const trimmed = value.trim();
  switch (trimmed) {
    case 'Euro FOB (Winery)': return InventoryContext.Euro_FOB_Winery;
    case 'Euro Warehouse': return InventoryContext.Euro_Warehouse;
    case 'US Warehouse - Imported': return InventoryContext.US_Importer_WH;
    case 'US Warehouse': return InventoryContext.US_Distributor_WH;
    case 'US Winery': return InventoryContext.US_Winery;
    default: return trimmed;
  }
}

/**
 * Resolve which pricing model to use from the 3-question context.
 */
export function resolvePricingModelId(
  whoAmI: TradeActorType,
  sellingTo: CounterpartyType,
  inventory: InventoryContextType | string,
): PricingModelIdType | null {
  const who = typeof whoAmI === 'string' ? whoAmI.trim() : whoAmI;
  const counter = typeof sellingTo === 'string' ? sellingTo.trim() : sellingTo;
  const inv = typeof inventory === 'string' ? normalizeInventory(inventory) : inventory;

  const match = SCENARIO_TABLE.find(
    (s) => s.whoAmI === who && s.sellingTo === counter && s.inventory === inv,
  );

  return match ? match.modelId : null;
}
