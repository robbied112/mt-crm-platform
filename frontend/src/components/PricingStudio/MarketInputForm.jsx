import React from 'react';
import { getRateForMarket, formatRateAge } from 'pricing-engine/fx/fetchRates';

function NumInput({ label, value, onChange, step, prefix, suffix, hint, disabled, max }) {
  return (
    <div className="pricing-input">
      <label className="pricing-input__label">{label}</label>
      <div className={`pricing-input__field ${disabled ? 'pricing-input__field--disabled' : ''}`}>
        {prefix && <span className="pricing-input__prefix">{prefix}</span>}
        <input
          type="number"
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const num = e.target.value === '' ? 0 : Number(e.target.value);
            if (!Number.isNaN(num)) onChange(num);
          }}
          step={step || '0.01'}
          disabled={disabled}
          max={max}
        />
        {suffix && <span className="pricing-input__suffix">{suffix}</span>}
      </div>
      {hint && <span className="pricing-input__hint">{hint}</span>}
    </div>
  );
}

export default function MarketInputForm({
  market,
  inputs,
  costInputMode,
  liveRates,
  ratesFetching,
  onSetInput,
  onSetMargin,
  onSetTax,
  onSetLogistics,
  onToggleLayer,
  onSetPathway,
  onSetCostInputMode,
  onFetchRates,
  onResetToDefaults,
}) {
  const casePack = inputs.casePack || 1;
  const isCase = costInputMode === 'case';

  const costDisplay = isCase ? inputs.costPerBottle * casePack : inputs.costPerBottle;
  const handleCostChange = (val) => {
    onSetInput('costPerBottle', isCase ? val / casePack : val);
  };

  const editableTaxes = (market.taxes || []).filter(
    (t) => t.editable && (!t.activeWhen || t.activeWhen === inputs.pathway)
  );

  const editableLogistics = (market.logistics || []).filter(
    (l) => l.editable && (!l.activeWhen || l.activeWhen === inputs.pathway)
  );

  const needsConversion = market.currency && market.currency.needsConversion;
  const hasPathways = market.pathways && market.pathways.length > 1;

  const liveRate = liveRates ? getRateForMarket(market, liveRates.rates) : null;
  const effectiveRate = inputs.exchangeRate * (1 + (inputs.exchangeBuffer || 0) / 100);

  const activePathway = hasPathways
    ? market.pathways.find((p) => p.id === inputs.pathway)
    : null;

  return (
    <div className="pricing-card">
      {/* Section 1: Product */}
      <div className="pricing-section">
        <div className="pricing-section__header">
          <h3 className="pricing-section__title">Product</h3>
          <div className="pricing-toggle">
            <button
              className={`pricing-toggle__btn${!isCase ? ' pricing-toggle__btn--active' : ''}`}
              onClick={() => onSetCostInputMode('bottle')}
            >
              Bottle
            </button>
            <button
              className={`pricing-toggle__btn${isCase ? ' pricing-toggle__btn--active' : ''}`}
              onClick={() => onSetCostInputMode('case')}
            >
              Case
            </button>
          </div>
        </div>
        <div className="pricing-input-grid">
          <NumInput
            label={isCase ? 'Cost per case' : 'Cost per bottle'}
            value={costDisplay}
            onChange={handleCostChange}
            prefix={market.currency ? market.currency.symbol : undefined}
          />
          <NumInput
            label="Case pack"
            value={inputs.casePack}
            onChange={(val) => onSetInput('casePack', val)}
            step="1"
          />
        </div>
        {market.requiresBottleSize && (
          <div className="pricing-input-grid">
            <NumInput
              label="Bottle size (ml)"
              value={inputs.bottleSizeMl || 0}
              onChange={(val) => onSetInput('bottleSizeMl', val)}
              step="1"
              suffix="ml"
            />
          </div>
        )}
        {market.requiresAbv && (
          <div className="pricing-input-grid">
            <NumInput
              label="ABV"
              value={inputs.abv || 0}
              onChange={(val) => onSetInput('abv', val)}
              suffix="%"
            />
          </div>
        )}
      </div>

      {/* Section 2: Currency & FX */}
      {needsConversion && (
        <div className="pricing-section">
          <div className="pricing-section__header">
            <h3 className="pricing-section__title">Currency &amp; FX</h3>
            <div className="pricing-fx-indicator">
              <span className="pricing-fx-indicator__dot" />
              <span className="pricing-fx-indicator__label">
                Live &middot; {liveRates ? formatRateAge(liveRates.fetchedAt) : '—'}
              </span>
              <button
                className="pricing-fx-indicator__refresh"
                onClick={onFetchRates}
                disabled={ratesFetching}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
          </div>
          <div className="pricing-input-grid">
            <NumInput
              label="Exchange rate"
              value={inputs.exchangeRate}
              onChange={(val) => onSetInput('exchangeRate', val)}
              step="0.0001"
            />
            <NumInput
              label="FX buffer"
              value={inputs.exchangeBuffer || 0}
              onChange={(val) => onSetInput('exchangeBuffer', val)}
              suffix="%"
            />
          </div>
          {liveRate && liveRate !== inputs.exchangeRate && (
            <button
              className="pricing-link"
              onClick={() => onSetInput('exchangeRate', liveRate)}
            >
              Apply live rate ({liveRate.toFixed(4)})
            </button>
          )}
          <div className="pricing-badge">
            Effective rate: {effectiveRate.toFixed(4)}
          </div>
        </div>
      )}

      {/* Section 3: Import Pathway */}
      {hasPathways && (
        <div className="pricing-section">
          <div className="pricing-section__header">
            <h3 className="pricing-section__title">Import Pathway</h3>
          </div>
          <div className="pricing-toggle">
            {market.pathways.map((pw) => (
              <button
                key={pw.id}
                className={`pricing-toggle__btn${inputs.pathway === pw.id ? ' pricing-toggle__btn--active' : ''}`}
                onClick={() => onSetPathway(pw.id)}
              >
                {pw.label}
              </button>
            ))}
          </div>
          {activePathway && activePathway.description && (
            <p className="pricing-pathway-desc">{activePathway.description}</p>
          )}
        </div>
      )}

      {/* Section 4: Taxes & Duties */}
      {editableTaxes.length > 0 && (
        <div className="pricing-section">
          <div className="pricing-section__header">
            <h3 className="pricing-section__title">Taxes &amp; Duties</h3>
          </div>
          <div className="pricing-input-grid">
            {editableTaxes.map((tax) => (
              <NumInput
                key={tax.id}
                label={tax.inputLabel}
                value={inputs.taxes?.[tax.id] ?? tax.defaultValue ?? 0}
                onChange={(val) => onSetTax(tax.id, val)}
                suffix={tax.type === 'percent' ? '%' : undefined}
                prefix={tax.type === 'currency' ? (market.currency?.symbol || '') : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Logistics */}
      {editableLogistics.length > 0 && (
        <div className="pricing-section">
          <div className="pricing-section__header">
            <h3 className="pricing-section__title">Logistics</h3>
          </div>
          <div className="pricing-input-grid">
            {editableLogistics.map((log) => (
              <NumInput
                key={log.id}
                label={log.label}
                value={inputs.logistics?.[log.id] ?? log.defaultValue ?? 0}
                onChange={(val) => onSetLogistics(log.id, val)}
                suffix={log.type === 'percent' ? '%' : undefined}
                prefix={log.type === 'currency' ? (market.currency?.symbol || '') : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Margin Structure */}
      {market.chain && market.chain.length > 0 && (
        <div className="pricing-section">
          <div className="pricing-section__header">
            <h3 className="pricing-section__title">Margin Structure</h3>
          </div>
          {market.chain.map((layer) => {
            const isActive = !layer.skippable || inputs.activeLayers?.includes(layer.id);
            return (
              <div
                key={layer.id}
                className={`pricing-layer${!isActive ? ' pricing-layer--disabled' : ''}`}
              >
                {layer.skippable ? (
                  <label className="pricing-layer__toggle">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleLayer(layer.id)}
                    />
                    <span>{layer.label}</span>
                  </label>
                ) : (
                  <span className="pricing-layer__name">{layer.label}</span>
                )}
                <NumInput
                  label="Margin"
                  value={inputs.margins?.[layer.id] ?? layer.defaultMargin ?? 0}
                  onChange={(val) => onSetMargin(layer.id, val)}
                  suffix="%"
                  max={99.9}
                  disabled={!isActive}
                  hint="Margin on selling price"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Reset */}
      <button className="pricing-reset-btn" onClick={onResetToDefaults}>
        Reset to defaults
      </button>
    </div>
  );
}
