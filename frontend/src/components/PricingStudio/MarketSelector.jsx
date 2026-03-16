import React from 'react';

export default function MarketSelector({ markets, activeMarketId, activeMarket, onSelectMarket }) {
  return (
    <div className="pricing-card">
      <div className="pricing-market-grid">
        {markets.map((market) => (
          <button
            key={market.id}
            className={`pricing-market-card${market.id === activeMarketId ? ' pricing-market-card--active' : ''}`}
            onClick={() => onSelectMarket(market.id)}
          >
            <span className="pricing-market-card__flag">{market.flag}</span>
            <span className="pricing-market-card__name">{market.name}</span>
          </button>
        ))}
      </div>
      {activeMarket && activeMarket.description && (
        <div className="pricing-market-desc">{activeMarket.description}</div>
      )}
    </div>
  );
}
