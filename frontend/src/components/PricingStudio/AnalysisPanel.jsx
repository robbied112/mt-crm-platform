import { useMemo, useState } from 'react';
import {
  reverseCalculate,
  calculatePriceTiers,
  calculateFxSensitivity,
  computeValueChain,
} from 'pricing-engine/markets/reverseCalculator';
import { fmt } from './utils';

const SEGMENT_COLORS = {
  cost: 'var(--color-burgundy, #6B1E1E)',
  tax: 'var(--color-amber, #C07B01)',
  logistics: 'var(--color-indigo, #6366f1)',
};
const MARGIN_PALETTE = [
  'var(--color-green, #1F865A)',
  'var(--color-blue, #3b82f6)',
  'var(--color-purple, #a855f7)',
  'var(--color-pink, #ec4899)',
];

export default function AnalysisPanel({ result, activeMarket, inputs }) {
  const [activeTab, setActiveTab] = useState('target');
  const [targetSrp, setTargetSrp] = useState(14.99);

  // ---- Derived data ----

  const sym = activeMarket?.currency?.symbol ?? '$';
  const srcSym = activeMarket?.currency?.sourceSymbol ?? '$';

  const maxCost = useMemo(
    () => (activeMarket && inputs ? reverseCalculate(activeMarket, targetSrp, inputs) : null),
    [activeMarket, targetSrp, inputs],
  );

  const tiers = useMemo(
    () =>
      activeMarket && inputs && result
        ? calculatePriceTiers(activeMarket, inputs, result.summary.srpBottle)
        : [],
    [activeMarket, inputs, result],
  );

  const fxRows = useMemo(
    () =>
      activeMarket?.currency?.needsConversion && inputs
        ? calculateFxSensitivity(activeMarket, inputs)
        : [],
    [activeMarket, inputs],
  );

  const valueSlices = useMemo(
    () => (result ? computeValueChain(result) : []),
    [result],
  );

  if (!result) return null;

  const currentCost = inputs.costPerBottle ?? 0;
  const achievable = maxCost !== null && maxCost >= 0;
  const gap = maxCost !== null && maxCost >= 0 ? maxCost - currentCost : null;

  // ---- Tab renderers ----

  function renderTargetPrice() {
    return (
      <div className="pricing-analysis__section">
        <label className="pricing-analysis__label">
          Target shelf price per bottle ({sym})
          <input
            type="number"
            className="pricing-analysis__input"
            value={targetSrp}
            step="0.01"
            min="0"
            onChange={(e) => setTargetSrp(parseFloat(e.target.value) || 0)}
          />
        </label>

        {maxCost !== null && (
          <div className={`pricing-callout ${achievable ? 'pricing-callout--accent' : 'pricing-callout--danger'}`}>
            <strong>Max FOB Cost:</strong> {achievable ? fmt(maxCost, srcSym) : 'Not achievable'}{' '}
            {!achievable && <span>— target is below the cost floor for this market.</span>}
          </div>
        )}

        {gap !== null && (
          <div className={`pricing-callout ${gap >= 0 ? 'pricing-callout--success' : 'pricing-callout--danger'}`}>
            {gap < 0
              ? `You're ${fmt(Math.abs(gap), srcSym)} over`
              : `Target achievable, ${fmt(gap, srcSym)} headroom`}
          </div>
        )}

        {tiers.length > 0 && (
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Shelf Price</th>
                <th>Max Cost/Bottle</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => {
                const nearCurrent =
                  result.summary.srpBottle > 0 &&
                  Math.abs(t.tier - result.summary.srpBottle) / result.summary.srpBottle <= 0.15;
                let status;
                if (!t.achievable) {
                  status = 'Below floor';
                } else if (currentCost > t.maxCost) {
                  status = 'Above \u2191';
                } else {
                  status = 'Achievable';
                }
                return (
                  <tr
                    key={t.tier}
                    className={nearCurrent ? 'pricing-table__row--highlight' : ''}
                  >
                    <td>{fmt(t.tier, sym)}</td>
                    <td>{t.achievable ? fmt(t.maxCost, srcSym) : '\u2014'}</td>
                    <td>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function renderFxRisk() {
    if (!activeMarket?.currency?.needsConversion) {
      return (
        <div className="pricing-analysis__section">
          <div className="pricing-callout pricing-callout--accent">
            No currency conversion for this market
          </div>
        </div>
      );
    }

    const tenPctRow = fxRows.find((r) => r.deltaPercent === 10);
    const negTenRow = fxRows.find((r) => r.deltaPercent === -10);
    const swing =
      tenPctRow && negTenRow
        ? Math.abs(tenPctRow.srpBottle - negTenRow.srpBottle) / 2
        : null;

    return (
      <div className="pricing-analysis__section">
        <table className="pricing-table">
          <thead>
            <tr>
              <th>FX Move</th>
              <th>Rate</th>
              <th>SRP/btl</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {fxRows.map((row) => (
              <tr
                key={row.deltaPercent}
                className={row.isCurrent ? 'pricing-table__row--highlight' : ''}
              >
                <td>{row.isCurrent ? 'Current' : `${row.deltaPercent > 0 ? '+' : ''}${row.deltaPercent}%`}</td>
                <td>{row.exchangeRate.toFixed(4)}</td>
                <td>{fmt(row.srpBottle, sym)}</td>
                <td>
                  {row.isCurrent ? (
                    '\u2014'
                  ) : (
                    <span className={row.change > 0 ? 'pricing-fx-impact--negative' : 'pricing-fx-impact--positive'}>
                      {row.change > 0 ? '+' : ''}
                      {fmt(row.change, sym)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {swing !== null && (
          <div className="pricing-callout pricing-callout--accent">
            A \u00b110% move shifts shelf price by \u00b1{fmt(swing, sym)} per bottle
          </div>
        )}
      </div>
    );
  }

  function renderValueChain() {
    if (!valueSlices.length) return null;

    const casePack = result.inputs.casePack || 12;
    const srpBottle = result.summary.srpBottle;
    const srpCase = result.summary.srpCase;

    // Assign colors
    let marginIdx = 0;
    const colored = valueSlices.map((slice) => {
      let color;
      if (slice.category === 'cost') color = SEGMENT_COLORS.cost;
      else if (slice.category === 'overhead') color = SEGMENT_COLORS.tax;
      else {
        color = MARGIN_PALETTE[marginIdx % MARGIN_PALETTE.length];
        marginIdx++;
      }
      return { ...slice, displayColor: color };
    });

    // Find largest margin layer
    const marginSlices = colored.filter((s) => s.category === 'margin');
    const largestMargin = marginSlices.reduce(
      (max, s) => (s.percent > max.percent ? s : max),
      marginSlices[0] || null,
    );
    const producerSlice = colored.find((s) => s.category === 'cost');

    return (
      <div className="pricing-analysis__section">
        {/* Stacked bar */}
        <div className="pricing-value-bar">
          {colored.map((slice, i) => (
            <div
              key={i}
              className="pricing-value-bar__segment"
              style={{
                width: `${Math.max(slice.percent, 2)}%`,
                backgroundColor: slice.displayColor,
              }}
              title={`${slice.label}: ${slice.percent.toFixed(1)}%`}
            >
              {slice.percent > 12 && (
                <span className="pricing-value-bar__label">
                  {slice.percent.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="pricing-value-legend">
          {colored.map((slice, i) => (
            <span key={i} className="pricing-value-legend__item">
              <span
                className="pricing-value-legend__dot"
                style={{ backgroundColor: slice.displayColor }}
              />
              {slice.label}
            </span>
          ))}
        </div>

        {/* Decomposition table */}
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>/bottle</th>
              <th>/case</th>
              <th>% SRP</th>
            </tr>
          </thead>
          <tbody>
            {colored.map((slice, i) => (
              <tr key={i}>
                <td>{slice.label}</td>
                <td>{fmt(slice.perBottle, sym)}</td>
                <td>{fmt(slice.perCase, sym)}</td>
                <td>{slice.percent.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="pricing-table__row--total">
              <td><strong>Total (SRP)</strong></td>
              <td><strong>{fmt(srpBottle, sym)}</strong></td>
              <td><strong>{fmt(srpCase, sym)}</strong></td>
              <td><strong>100.0%</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Insight callout */}
        {largestMargin && producerSlice && (
          <div className="pricing-callout pricing-callout--accent">
            {largestMargin.label} captures the largest share: {largestMargin.percent.toFixed(1)}% of the shelf price.
            The producer receives {producerSlice.percent.toFixed(1)}%.
          </div>
        )}
      </div>
    );
  }

  // ---- Main render ----

  return (
    <div className="pricing-card">
      <div className="pricing-tabs">
        <button
          className={`pricing-tab${activeTab === 'target' ? ' pricing-tab--active' : ''}`}
          onClick={() => setActiveTab('target')}
        >
          Target Price
        </button>
        <button
          className={`pricing-tab${activeTab === 'fx' ? ' pricing-tab--active' : ''}`}
          onClick={() => setActiveTab('fx')}
        >
          FX Risk
        </button>
        <button
          className={`pricing-tab${activeTab === 'value' ? ' pricing-tab--active' : ''}`}
          onClick={() => setActiveTab('value')}
        >
          Value Chain
        </button>
      </div>

      {activeTab === 'target' && renderTargetPrice()}
      {activeTab === 'fx' && renderFxRisk()}
      {activeTab === 'value' && renderValueChain()}
    </div>
  );
}
