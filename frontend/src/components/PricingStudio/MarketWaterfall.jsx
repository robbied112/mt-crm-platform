import React from 'react';

const CATEGORY_LABELS = {
  cost: 'Cost Basis',
  tax: 'Taxes & Duties',
  logistics: 'Logistics',
  margin: 'Margin Layer',
  subtotal: 'Subtotal',
  final: 'Final',
};

function fmt(value, symbol) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MarketWaterfall({ result, activeMarket }) {
  if (!result) {
    return (
      <div className="pricing-card">
        <p className="pricing-empty">Choose a market to see pricing.</p>
      </div>
    );
  }

  const sym = activeMarket.currency.symbol;
  let lastCategory = null;

  return (
    <div className="pricing-card pricing-card--accent">
      <div className="pricing-card__header">
        <span className="pricing-card__kicker">
          {activeMarket.flag} {activeMarket.name}
        </span>
        <h2 className="pricing-card__title">Pricing Snapshot</h2>
      </div>

      <div className="pricing-waterfall">
        {result.waterfall.map((step, i) => {
          const showDivider = step.category && step.category !== lastCategory;
          if (step.category) lastCategory = step.category;

          return (
            <React.Fragment key={i}>
              {showDivider && (
                <div className="pricing-waterfall__divider">
                  <span className="pricing-waterfall__divider-label">
                    {CATEGORY_LABELS[step.category] || step.category}
                  </span>
                  <span className="pricing-waterfall__divider-line" />
                </div>
              )}
              <div
                className={`pricing-waterfall__row${step.highlight ? ' pricing-waterfall__row--highlight' : ''}`}
              >
                <div className="pricing-waterfall__left">
                  <span className="pricing-waterfall__label">{step.label}</span>
                  {step.helper && (
                    <span className="pricing-waterfall__helper">{step.helper}</span>
                  )}
                </div>
                <div className="pricing-waterfall__right">
                  <span className="pricing-waterfall__per-case">
                    {fmt(step.perCase, sym)}
                  </span>
                  <span className="pricing-waterfall__per-bottle">
                    {fmt(step.perBottle, sym)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="pricing-waterfall__summary">
        <span className="pricing-waterfall__summary-label">Consumer Price</span>
        <span className="pricing-waterfall__srp-bottle">
          {fmt(result.summary.srpBottle, sym)}
        </span>
        <span className="pricing-waterfall__srp-case">
          {fmt(result.summary.srpCase, sym)} /case
        </span>
      </div>

      {result.warnings.length > 0 && (
        <div className="pricing-waterfall__warnings">
          {result.warnings.map((w, i) => (
            <div key={i} className={`pricing-warning pricing-warning--${w.level || 'warn'}`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
