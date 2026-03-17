import { usePricing } from '../../context/PricingContext';
import { MARKET_CONFIGS } from 'pricing-engine/markets/configs';
import MarketSelector from './MarketSelector';
import MarketInputForm from './MarketInputForm';
import MarketWaterfall from './MarketWaterfall';
import RecapPanel from './RecapPanel';
import ComparisonPanel from './ComparisonPanel';
import AnalysisPanel from './AnalysisPanel';
import MultiMarketOverview from './MultiMarketOverview';

export default function PricingStudio() {
  const {
    activeMarketId,
    activeMarket,
    inputs,
    costInputMode,
    liveRates,
    ratesFetching,
    result,
    scenarioBEnabled,
    scenarioBLabel,
    scenarioBInputs,
    scenarioBResult,
    activeRecapLayer,
    setMarket,
    setInput,
    setMargin,
    setTax,
    setLogistics,
    toggleLayer,
    setPathway,
    setCostInputMode,
    setActiveRecapLayer,
    toggleScenarioB,
    setScenarioBLabel,
    setScenarioBInput,
    setScenarioBMargin,
    setScenarioBTax,
    setScenarioBLogistics,
    resetToDefaults,
    refreshRates,
  } = usePricing();

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
            onSelectMarket={setMarket}
          />
          <MarketInputForm
            market={activeMarket}
            inputs={inputs}
            costInputMode={costInputMode}
            liveRates={liveRates}
            ratesFetching={ratesFetching}
            onSetInput={setInput}
            onSetMargin={setMargin}
            onSetTax={setTax}
            onSetLogistics={setLogistics}
            onToggleLayer={toggleLayer}
            onSetPathway={setPathway}
            onSetCostInputMode={setCostInputMode}
            onFetchRates={refreshRates}
            onResetToDefaults={resetToDefaults}
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
            onToggleScenarioB={toggleScenarioB}
            onSetScenarioBLabel={setScenarioBLabel}
            onSetScenarioBInput={setScenarioBInput}
            onSetScenarioBMargin={setScenarioBMargin}
            onSetScenarioBTax={setScenarioBTax}
            onSetScenarioBLogistics={setScenarioBLogistics}
          />
          <AnalysisPanel
            result={result}
            activeMarket={activeMarket}
            inputs={inputs}
          />
          <MultiMarketOverview
            inputs={inputs}
            activeMarketId={activeMarketId}
            onSelectMarket={setMarket}
          />
        </div>
      </div>
    </div>
  );
}
