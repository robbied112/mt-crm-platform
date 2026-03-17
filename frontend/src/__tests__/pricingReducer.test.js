import { describe, it, expect } from 'vitest';
import { pricingReducer, buildInitialState } from '../context/pricingReducer';

function makeState(overrides = {}) {
  return { ...buildInitialState(), ...overrides };
}

describe('pricingReducer', () => {
  // ── Calculator actions ──

  describe('CALC_SET_MARKET', () => {
    it('switches market and saves current inputs to memory', () => {
      const state = makeState({ activeMarketId: 'us-import', inputs: { costPerBottle: 10 } });
      const next = pricingReducer(state, { type: 'CALC_SET_MARKET', marketId: 'uk-import' });

      expect(next.activeMarketId).toBe('uk-import');
      expect(next.marketInputMemory['us-import']).toEqual({ costPerBottle: 10 });
      expect(next.scenarioBEnabled).toBe(false);
      expect(next.activeWineId).toBeNull();
    });

    it('restores inputs from memory when switching back', () => {
      const savedInputs = { costPerBottle: 7, casePack: 6 };
      const state = makeState({
        activeMarketId: 'uk-import',
        inputs: { costPerBottle: 5 },
        marketInputMemory: { 'us-import': savedInputs },
      });
      const next = pricingReducer(state, { type: 'CALC_SET_MARKET', marketId: 'us-import' });

      expect(next.inputs.costPerBottle).toBe(7);
      expect(next.inputs.casePack).toBe(6);
    });

    it('applies live FX rate when switching to a conversion market', () => {
      const state = makeState({ activeMarketId: 'us-domestic' });
      const rates = { rates: { EUR: { USD: 1.12 } } };
      const next = pricingReducer(state, {
        type: 'CALC_SET_MARKET',
        marketId: 'us-import',
        liveRates: rates,
      });

      // Should have applied the live rate
      expect(next.inputs.exchangeRate).toBeDefined();
    });
  });

  describe('CALC_SET_INPUT', () => {
    it('updates a single input field', () => {
      const state = makeState();
      const next = pricingReducer(state, { type: 'CALC_SET_INPUT', field: 'costPerBottle', value: 8.5 });
      expect(next.inputs.costPerBottle).toBe(8.5);
    });

    it('does not mutate other fields', () => {
      const state = makeState({ inputs: { costPerBottle: 5, casePack: 12 } });
      const next = pricingReducer(state, { type: 'CALC_SET_INPUT', field: 'costPerBottle', value: 10 });
      expect(next.inputs.casePack).toBe(12);
    });
  });

  describe('CALC_SET_MARGIN', () => {
    it('updates margin for a specific layer', () => {
      const state = makeState({ inputs: { margins: { importer: 30 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_MARGIN', layerId: 'importer', value: 25 });
      expect(next.inputs.margins.importer).toBe(25);
    });
  });

  describe('CALC_SET_TAX', () => {
    it('updates tax for a specific id', () => {
      const state = makeState({ inputs: { taxes: { tariff: 15 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_TAX', taxId: 'tariff', value: 25 });
      expect(next.inputs.taxes.tariff).toBe(25);
    });
  });

  describe('CALC_SET_LOGISTICS', () => {
    it('updates logistics for a specific id', () => {
      const state = makeState({ inputs: { logistics: { freight: 13 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_LOGISTICS', logId: 'freight', value: 18 });
      expect(next.inputs.logistics.freight).toBe(18);
    });
  });

  describe('CALC_TOGGLE_LAYER', () => {
    it('adds a layer when not active', () => {
      const state = makeState({ inputs: { activeLayers: ['importer'] } });
      const next = pricingReducer(state, { type: 'CALC_TOGGLE_LAYER', layerId: 'distributor' });
      expect(next.inputs.activeLayers).toContain('distributor');
      expect(next.inputs.activeLayers).toContain('importer');
    });

    it('removes a layer when active', () => {
      const state = makeState({ inputs: { activeLayers: ['importer', 'distributor'] } });
      const next = pricingReducer(state, { type: 'CALC_TOGGLE_LAYER', layerId: 'distributor' });
      expect(next.inputs.activeLayers).not.toContain('distributor');
      expect(next.inputs.activeLayers).toContain('importer');
    });

    it('handles empty activeLayers', () => {
      const state = makeState({ inputs: { activeLayers: undefined } });
      const next = pricingReducer(state, { type: 'CALC_TOGGLE_LAYER', layerId: 'importer' });
      expect(next.inputs.activeLayers).toEqual(['importer']);
    });
  });

  describe('CALC_SET_PATHWAY', () => {
    it('sets the pathway', () => {
      const state = makeState();
      const next = pricingReducer(state, { type: 'CALC_SET_PATHWAY', pathwayId: 'ss' });
      expect(next.inputs.pathway).toBe('ss');
    });
  });

  describe('CALC_SET_COST_INPUT_MODE', () => {
    it('toggles between bottle and case', () => {
      const state = makeState({ costInputMode: 'bottle' });
      const next = pricingReducer(state, { type: 'CALC_SET_COST_INPUT_MODE', mode: 'case' });
      expect(next.costInputMode).toBe('case');
    });
  });

  describe('CALC_TOGGLE_SCENARIO_B', () => {
    it('enables scenario B with a deep clone of current inputs', () => {
      const state = makeState({
        scenarioBEnabled: false,
        inputs: { costPerBottle: 5, margins: { importer: 30 } },
      });
      const next = pricingReducer(state, { type: 'CALC_TOGGLE_SCENARIO_B' });
      expect(next.scenarioBEnabled).toBe(true);
      expect(next.scenarioBInputs.costPerBottle).toBe(5);
      expect(next.scenarioBInputs.margins.importer).toBe(30);
      // Should be a deep clone, not same reference
      expect(next.scenarioBInputs).not.toBe(state.inputs);
      expect(next.scenarioBInputs.margins).not.toBe(state.inputs.margins);
    });

    it('disables scenario B when already enabled', () => {
      const state = makeState({ scenarioBEnabled: true });
      const next = pricingReducer(state, { type: 'CALC_TOGGLE_SCENARIO_B' });
      expect(next.scenarioBEnabled).toBe(false);
    });
  });

  describe('CALC_RESET_TO_DEFAULTS', () => {
    it('resets inputs and clears market memory', () => {
      const state = makeState({
        activeMarketId: 'us-import',
        inputs: { costPerBottle: 99 },
        marketInputMemory: { 'us-import': { costPerBottle: 99 } },
      });
      const next = pricingReducer(state, { type: 'CALC_RESET_TO_DEFAULTS' });
      expect(next.inputs.costPerBottle).not.toBe(99);
      expect(next.marketInputMemory['us-import']).toBeUndefined();
    });
  });

  describe('CALC_LOAD_WINE', () => {
    it('loads wine inputs into calculator', () => {
      const wine = {
        id: 'wine-1',
        marketId: 'us-import',
        markets: { 'us-import': { costPerBottle: 7, casePack: 12 } },
      };
      const state = makeState();
      const next = pricingReducer(state, { type: 'CALC_LOAD_WINE', wine });
      expect(next.activeWineId).toBe('wine-1');
      expect(next.inputs.costPerBottle).toBe(7);
      expect(next.scenarioBEnabled).toBe(false);
    });

    it('uses current market if wine has no marketId', () => {
      const wine = { id: 'wine-2', markets: {} };
      const state = makeState({ activeMarketId: 'uk-import' });
      const next = pricingReducer(state, { type: 'CALC_LOAD_WINE', wine });
      expect(next.activeMarketId).toBe('uk-import');
      expect(next.activeWineId).toBe('wine-2');
    });
  });

  describe('CALC_NEW_WINE', () => {
    it('clears activeWineId', () => {
      const state = makeState({ activeWineId: 'wine-1' });
      const next = pricingReducer(state, { type: 'CALC_NEW_WINE' });
      expect(next.activeWineId).toBeNull();
    });
  });

  // ── Portfolio actions ──

  describe('PORTFOLIO_LOADING', () => {
    it('sets loading state', () => {
      const next = pricingReducer(makeState(), { type: 'PORTFOLIO_LOADING' });
      expect(next.portfolioLoading).toBe(true);
      expect(next.portfolioError).toBeNull();
    });
  });

  describe('PORTFOLIO_LOADED', () => {
    it('sets portfolio and clears loading', () => {
      const wines = [{ id: 'w1' }, { id: 'w2' }];
      const state = makeState({ portfolioLoading: true });
      const next = pricingReducer(state, { type: 'PORTFOLIO_LOADED', wines });
      expect(next.portfolio).toEqual(wines);
      expect(next.portfolioLoading).toBe(false);
    });
  });

  describe('PORTFOLIO_ERROR', () => {
    it('sets error and clears loading', () => {
      const state = makeState({ portfolioLoading: true });
      const next = pricingReducer(state, { type: 'PORTFOLIO_ERROR', error: 'fail' });
      expect(next.portfolioError).toBe('fail');
      expect(next.portfolioLoading).toBe(false);
    });
  });

  describe('PORTFOLIO_SAVE', () => {
    it('adds a new wine to portfolio', () => {
      const state = makeState({ portfolio: [{ id: 'w1' }] });
      const wine = { id: 'w2', name: 'New Wine' };
      const next = pricingReducer(state, { type: 'PORTFOLIO_SAVE', wine });
      expect(next.portfolio).toHaveLength(2);
      expect(next.portfolio[1]).toEqual(wine);
      expect(next.activeWineId).toBe('w2');
    });

    it('updates an existing wine in portfolio', () => {
      const state = makeState({ portfolio: [{ id: 'w1', name: 'Old' }] });
      const wine = { id: 'w1', name: 'Updated' };
      const next = pricingReducer(state, { type: 'PORTFOLIO_SAVE', wine });
      expect(next.portfolio).toHaveLength(1);
      expect(next.portfolio[0].name).toBe('Updated');
    });
  });

  describe('PORTFOLIO_SAVE_FAILED', () => {
    it('reverts to previous portfolio', () => {
      const prev = [{ id: 'w1', name: 'Original' }];
      const state = makeState({ portfolio: [{ id: 'w1', name: 'Optimistic' }] });
      const next = pricingReducer(state, { type: 'PORTFOLIO_SAVE_FAILED', previousPortfolio: prev });
      expect(next.portfolio[0].name).toBe('Original');
    });
  });

  describe('PORTFOLIO_DELETE', () => {
    it('removes wine from portfolio', () => {
      const state = makeState({ portfolio: [{ id: 'w1' }, { id: 'w2' }] });
      const next = pricingReducer(state, { type: 'PORTFOLIO_DELETE', wineId: 'w1' });
      expect(next.portfolio).toHaveLength(1);
      expect(next.portfolio[0].id).toBe('w2');
    });

    it('clears activeWineId if deleted wine was active', () => {
      const state = makeState({
        portfolio: [{ id: 'w1' }],
        activeWineId: 'w1',
      });
      const next = pricingReducer(state, { type: 'PORTFOLIO_DELETE', wineId: 'w1' });
      expect(next.activeWineId).toBeNull();
    });

    it('preserves activeWineId if different wine deleted', () => {
      const state = makeState({
        portfolio: [{ id: 'w1' }, { id: 'w2' }],
        activeWineId: 'w2',
      });
      const next = pricingReducer(state, { type: 'PORTFOLIO_DELETE', wineId: 'w1' });
      expect(next.activeWineId).toBe('w2');
    });
  });

  // ── Rates actions ──

  describe('RATES_FETCH_START', () => {
    it('sets fetching state', () => {
      const next = pricingReducer(makeState(), { type: 'RATES_FETCH_START' });
      expect(next.ratesFetching).toBe(true);
    });
  });

  describe('RATES_FETCH_SUCCESS', () => {
    it('stores rates and clears fetching', () => {
      const rates = { rates: { EUR: { USD: 1.12 } }, fetchedAt: Date.now() };
      const next = pricingReducer(makeState(), { type: 'RATES_FETCH_SUCCESS', rates });
      expect(next.liveRates).toBe(rates);
      expect(next.ratesFetching).toBe(false);
    });
  });

  describe('RATES_FETCH_FAIL', () => {
    it('clears fetching state', () => {
      const state = makeState({ ratesFetching: true });
      const next = pricingReducer(state, { type: 'RATES_FETCH_FAIL' });
      expect(next.ratesFetching).toBe(false);
    });
  });

  // ── Edge cases ──

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = makeState();
      const next = pricingReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(next).toBe(state);
    });
  });

  describe('scenario B input actions', () => {
    it('CALC_SET_SCENARIO_B_INPUT updates a field', () => {
      const state = makeState({ scenarioBInputs: { costPerBottle: 5 } });
      const next = pricingReducer(state, { type: 'CALC_SET_SCENARIO_B_INPUT', field: 'costPerBottle', value: 10 });
      expect(next.scenarioBInputs.costPerBottle).toBe(10);
    });

    it('CALC_SET_SCENARIO_B_MARGIN updates margin', () => {
      const state = makeState({ scenarioBInputs: { margins: { importer: 30 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_SCENARIO_B_MARGIN', layerId: 'importer', value: 20 });
      expect(next.scenarioBInputs.margins.importer).toBe(20);
    });

    it('CALC_SET_SCENARIO_B_TAX updates tax', () => {
      const state = makeState({ scenarioBInputs: { taxes: { tariff: 15 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_SCENARIO_B_TAX', taxId: 'tariff', value: 25 });
      expect(next.scenarioBInputs.taxes.tariff).toBe(25);
    });

    it('CALC_SET_SCENARIO_B_LOGISTICS updates logistics', () => {
      const state = makeState({ scenarioBInputs: { logistics: { freight: 13 } } });
      const next = pricingReducer(state, { type: 'CALC_SET_SCENARIO_B_LOGISTICS', logId: 'freight', value: 20 });
      expect(next.scenarioBInputs.logistics.freight).toBe(20);
    });

    it('CALC_SET_SCENARIO_B_LABEL updates label', () => {
      const state = makeState();
      const next = pricingReducer(state, { type: 'CALC_SET_SCENARIO_B_LABEL', label: 'High Tariff' });
      expect(next.scenarioBLabel).toBe('High Tariff');
    });
  });
});
