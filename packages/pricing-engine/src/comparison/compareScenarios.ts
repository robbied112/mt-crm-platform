import type { PricingResult, ComparisonResult, ComparisonDelta, PricingInputs } from '../core/types';

interface MetricDef {
  field: string;
  label: string;
  getValue: (r: PricingResult) => number;
}

const COMPARISON_METRICS: MetricDef[] = [
  { field: 'landedCase', label: 'Landed Case', getValue: (r) => r.case.landedCase },
  { field: 'wholesaleCase', label: 'Wholesale Case', getValue: (r) => r.case.wholesaleCase },
  { field: 'wholesaleBottle', label: 'Wholesale Bottle', getValue: (r) => r.bottle.wholesaleBottle },
  { field: 'srpBottle', label: 'SRP per Bottle', getValue: (r) => r.bottle.srpBottle },
  { field: 'srpCase', label: 'SRP per Case', getValue: (r) => r.case.srpCase },
  { field: 'distributorGP', label: 'Distributor GP / Case', getValue: (r) => r.margins.distributorGrossProfitPerCase ?? 0 },
  { field: 'retailerGP', label: 'Retailer GP / Case', getValue: (r) => r.margins.retailerGrossProfitPerCase },
];

export function compareScenarios(
  baseline: PricingResult,
  comparison: PricingResult,
): ComparisonResult {
  const deltas: ComparisonDelta[] = COMPARISON_METRICS.map((metric) => {
    const a = metric.getValue(baseline);
    const b = metric.getValue(comparison);
    const delta = b - a;
    const percentChange = a !== 0 ? (delta / a) * 100 : null;

    return {
      field: metric.field,
      label: metric.label,
      baseline: a,
      comparison: b,
      delta,
      percentChange,
    };
  });

  // Find which inputs changed
  const changedInputs: string[] = [];
  const inputKeys = Object.keys(baseline.inputs) as (keyof PricingInputs)[];
  for (const key of inputKeys) {
    if (baseline.inputs[key] !== comparison.inputs[key]) {
      changedInputs.push(key);
    }
  }

  return { baseline, comparison, deltas, changedInputs };
}
