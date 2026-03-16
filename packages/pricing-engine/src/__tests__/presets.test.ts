import { describe, test, expect } from 'vitest';
import { DEFAULT_PRESETS } from '../presets/defaultPresets';

describe('DEFAULT_PRESETS', () => {
  test('is non-empty', () => {
    expect(DEFAULT_PRESETS.length).toBeGreaterThan(0);
  });

  test('each preset has required fields and non-empty lockedFields', () => {
    DEFAULT_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.lockedFields.length).toBeGreaterThan(0);
      expect(p.values).toBeDefined();
    });
  });
});
