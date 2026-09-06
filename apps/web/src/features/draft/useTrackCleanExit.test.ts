import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wasCleanExit } from './cleanExitFlag';
import { useTrackCleanExit } from './useTrackCleanExit';

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

describe('useTrackCleanExit', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('test_pagehide_marksCleanExit', () => {
    renderHook(() => useTrackCleanExit());

    window.dispatchEvent(new Event('pagehide'));

    expect(wasCleanExit()).toBe(true);
  });

  it('test_unmount_stopsTrackingPagehide', () => {
    const { unmount } = renderHook(() => useTrackCleanExit());
    unmount();

    window.dispatchEvent(new Event('pagehide'));

    expect(wasCleanExit()).toBe(false);
  });
});
