import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCleanExitFlag, markCleanExit, wasCleanExit } from './cleanExitFlag';

/** Minimal in-memory `localStorage` stand-in (matching `autoSave.test.ts`'s pattern), since jsdom's own `localStorage` lacks `clear()` in this setup. */
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

describe('cleanExitFlag', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('test_wasCleanExit_noFlagSet_isFalse', () => {
    expect(wasCleanExit()).toBe(false);
  });

  it('test_markCleanExit_thenWasCleanExit_isTrue', () => {
    markCleanExit();
    expect(wasCleanExit()).toBe(true);
  });

  it('test_clearCleanExitFlag_afterMarkCleanExit_wasCleanExitIsFalseAgain', () => {
    markCleanExit();
    clearCleanExitFlag();
    expect(wasCleanExit()).toBe(false);
  });

  it('test_usesItsOwnStorageKey_distinctFromTheRetiredAutoSaveKeys', () => {
    markCleanExit();
    // The retired features/export/autoSave.ts keys must never be touched.
    expect(localStorage.getItem('gridder_autosave')).toBeNull();
    expect(localStorage.getItem('gridder_autosave_time')).toBeNull();
  });
});
