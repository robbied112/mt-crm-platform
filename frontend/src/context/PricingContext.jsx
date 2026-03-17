/**
 * PricingContext — manages calculator state, portfolio data, and FX rates.
 * Pure reducer logic lives in pricingReducer.js (testable without Firebase).
 */
import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getMarketConfig } from 'pricing-engine/markets/configs';
import { calculateMarketPricing } from 'pricing-engine/markets/genericCalculator';
import { fetchLiveRates } from 'pricing-engine/fx/fetchRates';
import { pricingReducer, buildInitialState } from './pricingReducer';

const PricingContext = createContext(null);

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error('usePricing must be used within PricingProvider');
  return ctx;
}

const FALLBACK_MARKET_ID = 'us-import';

export default function PricingProvider({ children }) {
  const { tenantId } = useAuth();
  const [state, dispatch] = useReducer(pricingReducer, null, buildInitialState);

  // ── Derived values (memoized) ──

  const activeMarket = useMemo(
    () => getMarketConfig(state.activeMarketId) || getMarketConfig(FALLBACK_MARKET_ID),
    [state.activeMarketId],
  );

  const result = useMemo(
    () => calculateMarketPricing(activeMarket, state.inputs),
    [activeMarket, state.inputs],
  );

  const scenarioBResult = useMemo(() => {
    if (!state.scenarioBEnabled) return null;
    return calculateMarketPricing(activeMarket, state.scenarioBInputs);
  }, [activeMarket, state.scenarioBInputs, state.scenarioBEnabled]);

  // ── Fetch FX rates on mount ──

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'RATES_FETCH_START' });
    fetchLiveRates(false)
      .then((rates) => {
        if (!cancelled && rates) {
          dispatch({ type: 'RATES_FETCH_SUCCESS', rates });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'RATES_FETCH_FAIL' });
      });
    return () => { cancelled = true; };
  }, []);

  // ── Actions ──

  const setMarket = useCallback((marketId) => {
    dispatch({ type: 'CALC_SET_MARKET', marketId, liveRates: state.liveRates });
  }, [state.liveRates]);

  const setInput = useCallback((field, value) => {
    dispatch({ type: 'CALC_SET_INPUT', field, value });
  }, []);

  const setMargin = useCallback((layerId, value) => {
    dispatch({ type: 'CALC_SET_MARGIN', layerId, value });
  }, []);

  const setTax = useCallback((taxId, value) => {
    dispatch({ type: 'CALC_SET_TAX', taxId, value });
  }, []);

  const setLogistics = useCallback((logId, value) => {
    dispatch({ type: 'CALC_SET_LOGISTICS', logId, value });
  }, []);

  const toggleLayer = useCallback((layerId) => {
    dispatch({ type: 'CALC_TOGGLE_LAYER', layerId });
  }, []);

  const setPathway = useCallback((pathwayId) => {
    dispatch({ type: 'CALC_SET_PATHWAY', pathwayId });
  }, []);

  const setCostInputMode = useCallback((mode) => {
    dispatch({ type: 'CALC_SET_COST_INPUT_MODE', mode });
  }, []);

  const setActiveRecapLayer = useCallback((layerId) => {
    dispatch({ type: 'CALC_SET_RECAP_LAYER', layerId });
  }, []);

  const toggleScenarioB = useCallback(() => {
    dispatch({ type: 'CALC_TOGGLE_SCENARIO_B' });
  }, []);

  const setScenarioBLabel = useCallback((label) => {
    dispatch({ type: 'CALC_SET_SCENARIO_B_LABEL', label });
  }, []);

  const setScenarioBInput = useCallback((field, value) => {
    dispatch({ type: 'CALC_SET_SCENARIO_B_INPUT', field, value });
  }, []);

  const setScenarioBMargin = useCallback((layerId, value) => {
    dispatch({ type: 'CALC_SET_SCENARIO_B_MARGIN', layerId, value });
  }, []);

  const setScenarioBTax = useCallback((taxId, value) => {
    dispatch({ type: 'CALC_SET_SCENARIO_B_TAX', taxId, value });
  }, []);

  const setScenarioBLogistics = useCallback((logId, value) => {
    dispatch({ type: 'CALC_SET_SCENARIO_B_LOGISTICS', logId, value });
  }, []);

  const resetToDefaults = useCallback(() => {
    dispatch({ type: 'CALC_RESET_TO_DEFAULTS' });
  }, []);

  const refreshRates = useCallback(async () => {
    dispatch({ type: 'RATES_FETCH_START' });
    try {
      const rates = await fetchLiveRates(true);
      if (rates) {
        dispatch({ type: 'RATES_FETCH_SUCCESS', rates });
      }
    } catch {
      dispatch({ type: 'RATES_FETCH_FAIL' });
    }
  }, []);

  const loadWine = useCallback((wine) => {
    dispatch({ type: 'CALC_LOAD_WINE', wine });
  }, []);

  const newWine = useCallback(() => {
    dispatch({ type: 'CALC_NEW_WINE' });
  }, []);

  // ── Context value ──

  const value = useMemo(() => ({
    ...state,
    activeMarket,
    result,
    scenarioBResult,
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
    loadWine,
    newWine,
    dispatch,
  }), [
    state, activeMarket, result, scenarioBResult,
    setMarket, setInput, setMargin, setTax, setLogistics,
    toggleLayer, setPathway, setCostInputMode, setActiveRecapLayer,
    toggleScenarioB, setScenarioBLabel, setScenarioBInput,
    setScenarioBMargin, setScenarioBTax, setScenarioBLogistics,
    resetToDefaults, refreshRates, loadWine, newWine,
  ]);

  return (
    <PricingContext.Provider value={value}>
      {children}
    </PricingContext.Provider>
  );
}
