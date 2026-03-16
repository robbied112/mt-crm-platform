import type { PricingResult, RecapSummary, RecapLine } from '../core/types';
import type { RecapActorType } from '../core/enums';
import { RecapActor } from '../core/enums';

function line(label: string, perCase: number, casePack: number): RecapLine {
  return { label, perCase, perBottle: casePack > 0 ? perCase / casePack : 0 };
}

function buildSupplierRecap(result: PricingResult): RecapSummary {
  const cp = result.inputs.casePack || 12;
  const lines: RecapLine[] = [
    line('Revenue per Case', result.case.baseCaseUSD, cp),
  ];

  return { actor: RecapActor.Supplier, lines };
}

function buildImporterRecap(result: PricingResult): RecapSummary {
  const cp = result.inputs.casePack || 12;
  const lines: RecapLine[] = [];

  if (result.case.importerLaidInCase !== null) {
    lines.push(line('Laid-In Cost', result.case.importerLaidInCase, cp));
  }
  if (result.case.importerFOBCase !== null) {
    lines.push(line('FOB Sell Price', result.case.importerFOBCase, cp));
  }
  if (result.margins.importerGrossProfitPerCase !== null) {
    lines.push(line('Gross Profit', result.margins.importerGrossProfitPerCase, cp));
  }

  return { actor: RecapActor.Importer, lines };
}

function buildDistributorRecap(result: PricingResult): RecapSummary {
  const cp = result.inputs.casePack || 12;
  const lines: RecapLine[] = [
    line('Buy Price (Landed)', result.case.landedCase, cp),
    line('Sell Price (Wholesale)', result.case.wholesaleCase, cp),
  ];

  if (result.margins.distributorGrossProfitPerCase !== null) {
    lines.push(line('Gross Profit', result.margins.distributorGrossProfitPerCase, cp));
  }

  return { actor: RecapActor.Distributor, lines };
}

function buildRetailerRecap(result: PricingResult): RecapSummary {
  const cp = result.inputs.casePack || 12;
  const lines: RecapLine[] = [
    line('Buy Price (Wholesale)', result.case.wholesaleCase, cp),
    line('SRP', result.case.srpCase, cp),
    line('Gross Profit', result.margins.retailerGrossProfitPerCase, cp),
  ];

  return { actor: RecapActor.Retailer, lines };
}

const RECAP_BUILDERS: Record<RecapActorType, (result: PricingResult) => RecapSummary> = {
  [RecapActor.Supplier]: buildSupplierRecap,
  [RecapActor.Importer]: buildImporterRecap,
  [RecapActor.Distributor]: buildDistributorRecap,
  [RecapActor.Retailer]: buildRetailerRecap,
};

export function buildRecap(result: PricingResult, actor: RecapActorType): RecapSummary {
  return RECAP_BUILDERS[actor](result);
}

export function buildAllRecaps(result: PricingResult): RecapSummary[] {
  return Object.values(RecapActor).map((actor) => buildRecap(result, actor));
}
