import { useMemo, useState } from 'react';
import { MARKET_CONFIGS } from 'pricing-engine/markets/configs';
import { calculateMarketPricing, makeDefaultMarketInputs } from 'pricing-engine/markets/genericCalculator';

function fmt(value, symbol) {
  if (!Number.isFinite(value)) return '\u2014';
  return symbol + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MultiMarketOverview({ inputs, activeMarketId, onSelectMarket }) {
  const [collapsed, setCollapsed] = useState(true);

  const costPerBottle = inputs?.costPerBottle ?? 0;

  const rows = useMemo(() => {
    if (!inputs) return [];

    return MARKET_CONFIGS.map((config) => {
      const defaultInputs = makeDefaultMarketInputs(config);
      const merged = {
        ...defaultInputs,
        costPerBottle: inputs.costPerBottle,
        casePack: inputs.casePack,
        bottleSizeMl: inputs.bottleSizeMl,
        abv: inputs.abv,
      };
      const result = calculateMarketPricing(config, merged);

      return {
        id: config.id,
        flag: config.flag,
        name: config.name,
        symbol: config.currency.symbol,
        srpBottle: result.summary.srpBottle,
        srpCase: result.summary.srpCase,
        landedCase: result.summary.landedCase,
        casePack: merged.casePack || 12,
      };
    }).sort((a, b) => a.srpBottle - b.srpBottle);
  }, [inputs]);

  return (
    <div className="pricing-card">
      <div
        className="pricing-card__header-row"
        onClick={() => setCollapsed((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div>
          <span className="pricing-card__kicker">Global Pricing</span>
          <h3 className="pricing-card__title">Multi-Market Overview</h3>
          <p className="pricing-card__desc">
            Same wine ({fmt(costPerBottle, '$')}/btl) priced across all markets using default assumptions
          </p>
        </div>
        <button
          className="pricing-card__collapse-btn"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '\u25B6' : '\u25BC'}
        </button>
      </div>

      {!collapsed && (
        <>
          <table className="pricing-overview-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>SRP/Bottle</th>
                <th>SRP/Case</th>
                <th>Landed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`pricing-overview-table__row${row.id === activeMarketId ? ' pricing-overview-table__row--active' : ''}`}
                  onClick={() => onSelectMarket(row.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="pricing-overview-table__flag">{row.flag}</span>{' '}
                    {row.name}
                  </td>
                  <td>{fmt(row.srpBottle, row.symbol)}</td>
                  <td>{fmt(row.srpCase, row.symbol)}</td>
                  <td>{fmt(row.landedCase / row.casePack, row.symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pricing-overview-footer">Click any row to switch to that market.</p>
        </>
      )}
    </div>
  );
}
