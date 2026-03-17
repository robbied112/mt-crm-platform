/**
 * Shared utilities for Pricing Studio components.
 */

export function fmt(value, symbol) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(value) {
  if (!Number.isFinite(value)) return '\u2014';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function NumInput({ label, value, onChange, step, prefix, suffix, hint, disabled, max }) {
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
