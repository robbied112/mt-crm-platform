import { useState, useMemo, useEffect } from 'react';
import { MARKET_CONFIGS, getMarketConfig } from 'pricing-engine/markets/configs';
import { calculateMarketPricing, makeDefaultMarketInputs } from 'pricing-engine/markets/genericCalculator';
import { fetchLiveRates, getRateForMarket } from 'pricing-engine/fx/fetchRates';
import MarketSelector from './MarketSelector';
import MarketInputForm from './MarketInputForm';
import MarketWaterfall from './MarketWaterfall';
import RecapPanel from './RecapPanel';
import ComparisonPanel from './ComparisonPanel';
import AnalysisPanel from './AnalysisPanel';
import MultiMarketOverview from './MultiMarketOverview';

export default function PricingStudio() {
  const [activeMarketId, setActiveMarketId] = useState('us-import');
  const [costInputMode, setCostInputMode] = useState('bottle');
  const [inputs, setInputs] = useState(() => makeDefaultMarketInputs(MARKET_CONFIGS[0]));
  const [marketInputMemory, setMarketInputMemory] = useState({});
  const [scenarioBEnabled, setScenarioBEnabled] = useState(false);
  const [scenarioBLabel, setScenarioBLabel] = useState('Scenario B');
  const [scenarioBInputs, setScenarioBInputs] = useState(() => makeDefaultMarketInputs(MARKET_CONFIGS[0]));
  const [activeRecapLayer, setActiveRecapLayer] = useState('');
  const [liveRates, setLiveRates] = useState(null);
  const [ratesFetching, setRatesFetching] = useState(false);

  // ---- Derived ----

  const activeMarket = useMemo(
    () => getMarketConfig(activeMarketId) || MARKET_CONFIGS[0],
    [activeMarketId],
  );

  const result = useMemo(
    () => calculateMarketPricing(activeMarket, inputs),
    [activeMarket, inputs],
  );

  const scenarioBResult = useMemo(() => {
    if (!scenarioBEnabled) return null;
    return calculateMarketPricing(activeMarket, scenarioBInputs);
  }, [activeMarket, scenarioBInputs, scenarioBEnabled]);

  // ---- Effects ----

  useEffect(() => {
    handleFetchRates();
  }, []); // fetch once on mount

  useEffect(() => {
    setActiveRecapLayer(activeMarket.chain[0]?.id || '');
  }, [activeMarket]);

  // ---- Handlers ----

  function handleSetMarket(marketId) {
    // Save current inputs to memory
    setMarketInputMemory((prev) => ({
      ...prev,
      [activeMarketId]: inputs,
    }));

    const newMarket = getMarketConfig(marketId) || MARKET_CONFIGS[0];

    // Load from memory or create fresh defaults
    let newInputs;
    if (marketInputMemory[marketId]) {
      newInputs = { ...marketInputMemory[marketId] };
    } else {
      newInputs = makeDefaultMarketInputs(newMarket);
    }

    // Auto-apply live FX rate if available
    if (liveRates && liveRates.rates) {
      const rate = getRateForMarket(newMarket, liveRates.rates);
      if (rate != null) {
        newInputs = { ...newInputs, exchangeRate: rate };
      }
    }

    setInputs(newInputs);
    setActiveMarketId(marketId);

    // Reset scenario B when switching markets
    setScenarioBEnabled(false);
    setScenarioBInputs(makeDefaultMarketInputs(newMarket));
  }

  function handleSetInput(field, value) {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }

  function handleSetMargin(layerId, value) {
    setInputs((prev) => ({
      ...prev,
      margins: { ...prev.margins, [layerId]: value },
    }));
  }

  function handleSetTax(taxId, value) {
    setInputs((prev) => ({
      ...prev,
      taxes: { ...prev.taxes, [taxId]: value },
    }));
  }

  function handleSetLogistics(logId, value) {
    setInputs((prev) => ({
      ...prev,
      logistics: { ...prev.logistics, [logId]: value },
    }));
  }

  function handleToggleLayer(layerId) {
    setInputs((prev) => {
      const layers = prev.activeLayers || [];
      const isActive = layers.includes(layerId);
      return {
        ...prev,
        activeLayers: isActive
          ? layers.filter((id) => id !== layerId)
          : [...layers, layerId],
      };
    });
  }

  function handleSetPathway(pathwayId) {
    setInputs((prev) => ({ ...prev, pathway: pathwayId }));
  }

  function handleToggleScenarioB() {
    if (!scenarioBEnabled) {
      // Deep-clone current inputs into scenario B
      setScenarioBInputs(JSON.parse(JSON.stringify(inputs)));
      setScenarioBEnabled(true);
    } else {
      setScenarioBEnabled(false);
    }
  }

  function handleResetToDefaults() {
    const defaults = makeDefaultMarketInputs(activeMarket);
    setInputs(defaults);

    // Clear memory for this market
    setMarketInputMemory((prev) => {
      const next = { ...prev };
      delete next[activeMarketId];
      return next;
    });
  }

  async function handleFetchRates(force = false) {
    setRatesFetching(true);
    try {
      const result = await fetchLiveRates(force);
      if (result) {
        setLiveRates(result);

        // Apply rate to current market if available
        const rate = getRateForMarket(activeMarket, result.rates);
        if (rate != null) {
          setInputs((prev) => ({ ...prev, exchangeRate: rate }));
        }
      }
    } finally {
      setRatesFetching(false);
    }
  }

  // ---- Render ----

  return (
    <div className="pricing-studio">
      <div className="pricing-studio__header">
        <h1 className="pricing-studio__title">Pricing Studio</h1>
        <p className="pricing-studio__subtitle">
          Wine pricing calculator across 8 global markets
        </p>
      </div>

      <div className="pricing-studio__grid">
        {/* Left sidebar: selector + inputs */}
        <div className="pricing-studio__sidebar">
          <MarketSelector
            markets={MARKET_CONFIGS}
            activeMarketId={activeMarketId}
            activeMarket={activeMarket}
            onSelectMarket={handleSetMarket}
          />
          <MarketInputForm
            market={activeMarket}
            inputs={inputs}
            costInputMode={costInputMode}
            liveRates={liveRates}
            ratesFetching={ratesFetching}
            onSetInput={handleSetInput}
            onSetMargin={handleSetMargin}
            onSetTax={handleSetTax}
            onSetLogistics={handleSetLogistics}
            onToggleLayer={handleToggleLayer}
            onSetPathway={handleSetPathway}
            onSetCostInputMode={setCostInputMode}
            onFetchRates={handleFetchRates}
            onResetToDefaults={handleResetToDefaults}
          />
        </div>

        {/* Right main: output panels */}
        <div className="pricing-studio__main">
          <MarketWaterfall
            result={result}
            activeMarket={activeMarket}
          />
          <RecapPanel
            result={result}
            activeRecapLayer={activeRecapLayer}
            onSetActiveRecapLayer={setActiveRecapLayer}
          />
          <ComparisonPanel
            market={activeMarket}
            result={result}
            scenarioBEnabled={scenarioBEnabled}
            scenarioBLabel={scenarioBLabel}
            scenarioBInputs={scenarioBInputs}
            scenarioBResult={scenarioBResult}
            onToggleScenarioB={handleToggleScenarioB}
            onSetScenarioBLabel={setScenarioBLabel}
            onSetScenarioBInput={(field, value) =>
              setScenarioBInputs((prev) => ({ ...prev, [field]: value }))
            }
            onSetScenarioBMargin={(layerId, value) => {
              setScenarioBInputs((prev) => ({
                ...prev,
                margins: { ...prev.margins, [layerId]: value },
              }));
            }}
            onSetScenarioBTax={(taxId, value) => {
              setScenarioBInputs((prev) => ({
                ...prev,
                taxes: { ...prev.taxes, [taxId]: value },
              }));
            }}
            onSetScenarioBLogistics={(logId, value) => {
              setScenarioBInputs((prev) => ({
                ...prev,
                logistics: { ...prev.logistics, [logId]: value },
              }));
            }}
          />
          <AnalysisPanel
            result={result}
            activeMarket={activeMarket}
            inputs={inputs}
          />
          <MultiMarketOverview
            inputs={inputs}
            activeMarketId={activeMarketId}
            onSelectMarket={handleSetMarket}
          />
        </div>
      </div>
    </div>
  );
}
