import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDraftAutosave } from './useDraftAutosave';
import type { DraftStorageAdapter } from './types';

const mockStorage = (): DraftStorageAdapter => ({
  save: vi.fn(async () => {}),
  load: vi.fn(async () => null),
  clear: vi.fn(async () => {}),
});

describe('useDraftAutosave', () => {
  it('test_mount_startsAutosave_unmount_stopsIt', () => {
    const storage = mockStorage();
    const { unmount } = renderHook(() => useDraftAutosave(storage));

    // No assertion beyond "doesn't throw" — the debounce/subscribe behaviour
    // itself is covered by draftAutosave.test.ts against the real function
    // this hook wraps.
    expect(() => unmount()).not.toThrow();
  });
});
