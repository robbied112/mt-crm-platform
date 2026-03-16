import React from 'react';

const CURRENCY_SYMBOLS = {
  GBP: '\u00a3',
  AUD: 'A$',
  NZD: 'NZ$',
  EUR: '\u20ac',
};

function fmt(value, symbol) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export default function RecapPanel({ result, activeRecapLayer, onSetActiveRecapLayer }) {
  if (!result || !result.layerRecaps || result.layerRecaps.length === 0) {
    return null;
  }

  const currencyCode = result.assumptions?.currency || '';
  const sym = CURRENCY_SYMBOLS[currencyCode] || '$';
  const casePack = result.inputs?.casePack || 12;

  const active =
    result.layerRecaps.find((r) => r.layerId === activeRecapLayer) ||
    result.layerRecaps[0];

  const effectiveMargin = active.sellPrice > 0
    ? ((active.sellPrice - active.buyPrice) / active.sellPrice) * 100
    : 0;

  return (
    <div className="pricing-card">
      <div className="pricing-card__header">
        <span className="pricing-card__kicker">Per Layer</span>
        <h2 className="pricing-card__title">Stakeholder P&amp;L</h2>
      </div>

      <div className="pricing-tabs">
        {result.layerRecaps.map((recap) => (
          <button
            key={recap.layerId}
            className={`pricing-tabs__tab${recap.layerId === active.layerId ? ' pricing-tabs__tab--active' : ''}`}
            onClick={() => onSetActiveRecapLayer(recap.layerId)}
          >
            {recap.label}
          </button>
        ))}
      </div>

      <div className="pricing-recap">
        <div className="pricing-recap__row">
          <span className="pricing-recap__label">Buy Price</span>
          <span className="pricing-recap__case">{fmt(active.buyPrice, sym)}</span>
          <span className="pricing-recap__bottle">
            {fmt(active.buyPrice / casePack, sym)}
          </span>
        </div>
        <div className="pricing-recap__row">
          <span className="pricing-recap__label">Sell Price</span>
          <span className="pricing-recap__case">{fmt(active.sellPrice, sym)}</span>
          <span className="pricing-recap__bottle">
            {fmt(active.sellPrice / casePack, sym)}
          </span>
        </div>
        <div className="pricing-recap__row">
          <span className="pricing-recap__label">Gross Profit</span>
          <span className="pricing-recap__case">
            {fmt(active.grossProfit, sym)}
          </span>
          <span className="pricing-recap__bottle">
            {fmt(active.grossProfit / casePack, sym)}
          </span>
        </div>
        <div className="pricing-recap__margin">
          <span className="pricing-recap__label">Effective Margin</span>
          <span className="pricing-recap__value">{fmtPct(effectiveMargin)}</span>
        </div>
      </div>
    </div>
  );
}
