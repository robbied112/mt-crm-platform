/**
 * Pure reducer and initial state builder for PricingContext.
 * Separated from PricingContext.jsx so it can be unit-tested
 * without triggering Firebase/Auth imports.
 *
 * State shape:
 * ┌──────────────────────────────────────────┐
 * │ PERSISTED (Firestore ↔ State)            │
 * │   portfolio: PortfolioWine[]             │
 * │   portfolioLoading: boolean              │
 * ├──────────────────────────────────────────┤
 * │ CACHED (fetched, not persisted per-user) │
 * │   liveRates: { rates, fetchedAt }        │
 * │   ratesFetching: boolean                 │
 * ├──────────────────────────────────────────┤
 * │ EPHEMERAL (UI-only, lost on refresh)     │
 * │   activeMarketId, inputs, costInputMode  │
 * │   marketInputMemory, scenarioB*          │
 * │   activeRecapLayer, activeWineId         │
 * └──────────────────────────────────────────┘
 */
import { MARKET_CONFIGS, getMarketConfig } from 'pricing-engine/markets/configs';
import { makeDefaultMarketInputs } from 'pricing-engine/markets/genericCalculator';
import { getRateForMarket } from 'pricing-engine/fx/fetchRates';

const defaultMarket = MARKET_CONFIGS[0];

export function buildInitialState() {
  return {
    portfolio: [],
    portfolioLoading: false,
    portfolioError: null,

    liveRates: null,
    ratesFetching: false,

    activeMarketId: defaultMarket.id,
    inputs: makeDefaultMarketInputs(defaultMarket),
    costInputMode: 'bottle',
    marketInputMemory: {},
    scenarioBEnabled: false,
    scenarioBLabel: 'Scenario B',
    scenarioBInputs: makeDefaultMarketInputs(defaultMarket),
    activeRecapLayer: defaultMarket.chain[0]?.id || '',
    activeWineId: null,
  };
}

export function pricingReducer(state, action) {
  switch (action.type) {
    // ── Calculator actions ──

    case 'CALC_SET_MARKET': {
      const { marketId, liveRates } = action;
      const newMarket = getMarketConfig(marketId) || defaultMarket;

      const updatedMemory = {
        ...state.marketInputMemory,
        [state.activeMarketId]: state.inputs,
      };

      let newInputs = updatedMemory[marketId]
        ? { ...updatedMemory[marketId] }
        : makeDefaultMarketInputs(newMarket);

      const rates = liveRates || state.liveRates;
      if (rates?.rates) {
        const rate = getRateForMarket(newMarket, rates.rates);
        if (rate != null) {
          newInputs = { ...newInputs, exchangeRate: rate };
        }
      }

      return {
        ...state,
        activeMarketId: marketId,
        inputs: newInputs,
        marketInputMemory: updatedMemory,
        activeRecapLayer: newMarket.chain[0]?.id || '',
        scenarioBEnabled: false,
        scenarioBInputs: makeDefaultMarketInputs(newMarket),
        activeWineId: null,
      };
    }

    case 'CALC_SET_INPUT':
      return {
        ...state,
        inputs: { ...state.inputs, [action.field]: action.value },
      };

    case 'CALC_SET_MARGIN':
      return {
        ...state,
        inputs: {
          ...state.inputs,
          margins: { ...state.inputs.margins, [action.layerId]: action.value },
        },
      };

    case 'CALC_SET_TAX':
      return {
        ...state,
        inputs: {
          ...state.inputs,
          taxes: { ...state.inputs.taxes, [action.taxId]: action.value },
        },
      };

    case 'CALC_SET_LOGISTICS':
      return {
        ...state,
        inputs: {
          ...state.inputs,
          logistics: { ...state.inputs.logistics, [action.logId]: action.value },
        },
      };

    case 'CALC_TOGGLE_LAYER': {
      const layers = state.inputs.activeLayers || [];
      const isActive = layers.includes(action.layerId);
      return {
        ...state,
        inputs: {
          ...state.inputs,
          activeLayers: isActive
            ? layers.filter((id) => id !== action.layerId)
            : [...layers, action.layerId],
        },
      };
    }

    case 'CALC_SET_PATHWAY':
      return {
        ...state,
        inputs: { ...state.inputs, pathway: action.pathwayId },
      };

    case 'CALC_SET_COST_INPUT_MODE':
      return { ...state, costInputMode: action.mode };

    case 'CALC_SET_RECAP_LAYER':
      return { ...state, activeRecapLayer: action.layerId };

    case 'CALC_TOGGLE_SCENARIO_B': {
      if (!state.scenarioBEnabled) {
        return {
          ...state,
          scenarioBEnabled: true,
          scenarioBInputs: JSON.parse(JSON.stringify(state.inputs)),
        };
      }
      return { ...state, scenarioBEnabled: false };
    }

    case 'CALC_SET_SCENARIO_B_LABEL':
      return { ...state, scenarioBLabel: action.label };

    case 'CALC_SET_SCENARIO_B_INPUT':
      return {
        ...state,
        scenarioBInputs: { ...state.scenarioBInputs, [action.field]: action.value },
      };

    case 'CALC_SET_SCENARIO_B_MARGIN':
      return {
        ...state,
        scenarioBInputs: {
          ...state.scenarioBInputs,
          margins: { ...state.scenarioBInputs.margins, [action.layerId]: action.value },
        },
      };

    case 'CALC_SET_SCENARIO_B_TAX':
      return {
        ...state,
        scenarioBInputs: {
          ...state.scenarioBInputs,
          taxes: { ...state.scenarioBInputs.taxes, [action.taxId]: action.value },
        },
      };

    case 'CALC_SET_SCENARIO_B_LOGISTICS':
      return {
        ...state,
        scenarioBInputs: {
          ...state.scenarioBInputs,
          logistics: { ...state.scenarioBInputs.logistics, [action.logId]: action.value },
        },
      };

    case 'CALC_RESET_TO_DEFAULTS': {
      const market = getMarketConfig(state.activeMarketId) || defaultMarket;
      const updatedMemory = { ...state.marketInputMemory };
      delete updatedMemory[state.activeMarketId];
      return {
        ...state,
        inputs: makeDefaultMarketInputs(market),
        marketInputMemory: updatedMemory,
      };
    }

    case 'CALC_LOAD_WINE': {
      const { wine } = action;
      const marketId = wine.marketId || state.activeMarketId;
      const market = getMarketConfig(marketId) || defaultMarket;
      const savedInputs = wine.markets?.[marketId];
      return {
        ...state,
        activeMarketId: marketId,
        inputs: savedInputs || makeDefaultMarketInputs(market),
        activeRecapLayer: market.chain[0]?.id || '',
        activeWineId: wine.id,
        scenarioBEnabled: false,
      };
    }

    case 'CALC_NEW_WINE':
      return { ...state, activeWineId: null };

    // ── Portfolio actions ──

    case 'PORTFOLIO_LOADING':
      return { ...state, portfolioLoading: true, portfolioError: null };

    case 'PORTFOLIO_LOADED':
      return { ...state, portfolio: action.wines, portfolioLoading: false };

    case 'PORTFOLIO_ERROR':
      return { ...state, portfolioError: action.error, portfolioLoading: false };

    case 'PORTFOLIO_SAVE': {
      const existing = state.portfolio.findIndex((w) => w.id === action.wine.id);
      const updated = existing >= 0
        ? state.portfolio.map((w) => w.id === action.wine.id ? action.wine : w)
        : [...state.portfolio, action.wine];
      return { ...state, portfolio: updated, activeWineId: action.wine.id };
    }

    case 'PORTFOLIO_SAVE_FAILED':
      return { ...state, portfolio: action.previousPortfolio };

    case 'PORTFOLIO_DELETE':
      return {
        ...state,
        portfolio: state.portfolio.filter((w) => w.id !== action.wineId),
        activeWineId: state.activeWineId === action.wineId ? null : state.activeWineId,
      };

    // ── Rates actions ──

    case 'RATES_FETCH_START':
      return { ...state, ratesFetching: true };

    case 'RATES_FETCH_SUCCESS': {
      const newState = { ...state, liveRates: action.rates, ratesFetching: false };
      const market = getMarketConfig(state.activeMarketId) || defaultMarket;
      const rate = getRateForMarket(market, action.rates.rates);
      if (rate != null) {
        newState.inputs = { ...state.inputs, exchangeRate: rate };
      }
      return newState;
    }

    case 'RATES_FETCH_FAIL':
      return { ...state, ratesFetching: false };

    default:
      return state;
  }
}
