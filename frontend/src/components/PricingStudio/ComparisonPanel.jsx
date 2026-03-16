import React, { useState } from 'react';

function fmt(value, symbol) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function deltaClass(delta) {
  if (!Number.isFinite(delta) || delta === 0) return '';
  return delta > 0 ? 'pricing-comparison-delta--positive' : 'pricing-comparison-delta--negative';
}

function fmtDelta(delta, symbol) {
  if (!Number.isFinite(delta)) return '\u2014';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${symbol}${delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDeltaPct(baseline, scenarioB) {
  if (!Number.isFinite(baseline) || !Number.isFinite(scenarioB) || baseline === 0) return '';
  const pct = ((scenarioB - baseline) / Math.abs(baseline)) * 100;
  if (!Number.isFinite(pct)) return '';
  const sign = pct > 0 ? '+' : '';
  return `(${sign}${pct.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`;
}

export default function ComparisonPanel({
  market,
  result,
  scenarioBEnabled,
  scenarioBLabel,
  scenarioBInputs,
  scenarioBResult,
  onToggleScenarioB,
  onSetScenarioBLabel,
  onSetScenarioBInput,
  onSetScenarioBMargin,
  onSetScenarioBTax,
  onSetScenarioBLogistics,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sym = market.currency.symbol;

  const editableTaxes = (market.taxes || []).filter(
    (t) => t.editable && (!t.activeWhen || t.activeWhen === scenarioBInputs?.pathway)
  );

  const editableLogistics = (market.logistics || []).filter(
    (l) => l.editable && (!l.activeWhen || l.activeWhen === scenarioBInputs?.pathway)
  );

  const activeMargins = (market.chain || []).filter(
    (layer) => !layer.skippable || scenarioBInputs?.activeLayers?.includes(layer.id)
  );

  const deltaRows = [];
  if (result && scenarioBResult) {
    deltaRows.push({
      metric: 'Landed Case',
      baseline: result.summary.landedCase,
      scenarioB: scenarioBResult.summary.landedCase,
    });
    deltaRows.push({
      metric: 'Wholesale Case',
      baseline: result.summary.wholesaleCase,
      scenarioB: scenarioBResult.summary.wholesaleCase,
    });
    deltaRows.push({
      metric: 'SRP/Bottle',
      baseline: result.summary.srpBottle,
      scenarioB: scenarioBResult.summary.srpBottle,
    });
    deltaRows.push({
      metric: 'SRP/Case',
      baseline: result.summary.srpCase,
      scenarioB: scenarioBResult.summary.srpCase,
    });
  }

  return (
    <div className="pricing-card">
      <div
        className="pricing-card__header pricing-card__header--clickable"
        onClick={() => setCollapsed((c) => !c)}
      >
        <h2 className="pricing-card__title">Scenario Comparison</h2>
        <span className="pricing-card__collapse-toggle">
          {collapsed ? '+' : '\u2013'}
        </span>
      </div>

      {!collapsed && (
        <div className="pricing-comparison">
          <label className="pricing-comparison-toggle">
            <input
              type="checkbox"
              checked={scenarioBEnabled}
              onChange={onToggleScenarioB}
            />
            <span>Enable comparison scenario</span>
          </label>

          {scenarioBEnabled && (
            <>
              <div className="pricing-comparison__label-input">
                <label className="pricing-input__label">Scenario label</label>
                <input
                  type="text"
                  className="pricing-input__field"
                  value={scenarioBLabel}
                  onChange={(e) => onSetScenarioBLabel(e.target.value)}
                />
              </div>

              <div className="pricing-comparison__overrides">
                <div className="pricing-input-grid">
                  <NumInput
                    label="Cost/Bottle"
                    value={scenarioBInputs?.costPerBottle || 0}
                    onChange={(val) => onSetScenarioBInput('costPerBottle', val)}
                    prefix={sym}
                  />

                  {editableTaxes.map((tax) => (
                    <NumInput
                      key={tax.id}
                      label={tax.inputLabel}
                      value={scenarioBInputs?.taxes?.[tax.id] ?? tax.defaultValue ?? 0}
                      onChange={(val) => onSetScenarioBTax(tax.id, val)}
                      suffix={tax.type === 'percent' ? '%' : undefined}
                      prefix={tax.type === 'currency' ? sym : undefined}
                    />
                  ))}

                  {editableLogistics.map((log) => (
                    <NumInput
                      key={log.id}
                      label={log.label}
                      value={scenarioBInputs?.logistics?.[log.id] ?? log.defaultValue ?? 0}
                      onChange={(val) => onSetScenarioBLogistics(log.id, val)}
                      suffix={log.type === 'percent' ? '%' : undefined}
                      prefix={log.type === 'currency' ? sym : undefined}
                    />
                  ))}

                  {activeMargins.map((layer) => (
                    <NumInput
                      key={layer.id}
                      label={`${layer.label} margin`}
                      value={scenarioBInputs?.margins?.[layer.id] ?? layer.defaultMargin ?? 0}
                      onChange={(val) => onSetScenarioBMargin(layer.id, val)}
                      suffix="%"
                      max={99.9}
                    />
                  ))}
                </div>
              </div>

              {deltaRows.length > 0 && (
                <table className="pricing-comparison__table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Baseline (A)</th>
                      <th>{scenarioBLabel || 'Scenario B'}</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deltaRows.map((row) => {
                      const delta = Number.isFinite(row.baseline) && Number.isFinite(row.scenarioB)
                        ? row.scenarioB - row.baseline
                        : undefined;
                      return (
                        <tr key={row.metric}>
                          <td>{row.metric}</td>
                          <td>{fmt(row.baseline, sym)}</td>
                          <td>{fmt(row.scenarioB, sym)}</td>
                          <td className={deltaClass(delta)}>
                            {fmtDelta(delta, sym)}{' '}
                            <span className="pricing-comparison-delta__pct">
                              {fmtDeltaPct(row.baseline, row.scenarioB)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
