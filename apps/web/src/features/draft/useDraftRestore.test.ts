import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeDocument, type EditorShape } from '@gridder/editor-core';
import { createEmptyDocument, editorSession } from '@/features/editor';
import { isDirty } from '@/features/file';
import { resetDirtyTrackingForTests } from '@/features/file/dirtyTracking';
import { clearCleanExitFlag, markCleanExit } from './cleanExitFlag';
import { useDraftRestore } from './useDraftRestore';
import type { DraftStorageAdapter } from './types';

/**
 * `useDraftRestore` is exercised against a hand-built `DraftStorageAdapter`
 * mock rather than the real IndexedDB Adapter — `indexedDbDraftAdapter.test.ts`
 * already covers that Adapter directly. `selectDraftStorage` is mocked so the
 * hook always gets this mock regardless of which Adapter the test environment
 * would otherwise pick.
 */

let currentAdapter: DraftStorageAdapter;

vi.mock('./selectDraftStorage', () => ({
  selectDraftStorage: () => currentAdapter,
}));

const mockStorage = (initialDraft: string | null): DraftStorageAdapter & {
  readonly clearCalls: number;
} => {
  let draft = initialDraft;
  let clearCalls = 0;
  return {
    get clearCalls() {
      return clearCalls;
    },
    save: vi.fn(async (content: string) => {
      draft = content;
    }),
    load: vi.fn(async () => draft),
    clear: vi.fn(async () => {
      draft = null;
      clearCalls += 1;
    }),
  };
};

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

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    editorSession.reset(createEmptyDocument());
    resetDirtyTrackingForTests();
  });
};

describe('useDraftRestore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
    reset();
  });
  afterEach(() => {
    reset();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('test_cleanExit_withADraft_doesNotPrompt', async () => {
    markCleanExit();
    currentAdapter = mockStorage(serializeDocument(createEmptyDocument()));

    const { result } = renderHook(() => useDraftRestore());

    // Give any pending microtasks a chance to run.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isPromptOpen).toBe(false);
  });

  it('test_notCleanExit_withNoDraft_doesNotPrompt', async () => {
    clearCleanExitFlag();
    currentAdapter = mockStorage(null);

    const { result } = renderHook(() => useDraftRestore());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isPromptOpen).toBe(false);
  });

  it('test_notCleanExit_withADraft_prompts', async () => {
    clearCleanExitFlag();
    const draftDocument = createEmptyDocument();
    currentAdapter = mockStorage(serializeDocument(draftDocument));

    const { result } = renderHook(() => useDraftRestore());

    await waitFor(() => expect(result.current.isPromptOpen).toBe(true));
  });

  it('test_mount_alwaysClearsTheCleanExitFlag_forTheNextLaunch', async () => {
    markCleanExit();
    currentAdapter = mockStorage(null);

    renderHook(() => useDraftRestore());

    // The flag must already read "not clean" for whatever happens next this
    // session, per cleanExitFlag.ts's own contract.
    const { wasCleanExit } = await import('./cleanExitFlag');
    expect(wasCleanExit()).toBe(false);
  });

  it('test_restore_loadsTheDraftIntoTheDocument_andClearsTheDraft', async () => {
    clearCleanExitFlag();
    const shape = rectShape('a');
    const draftDocument = { ...createEmptyDocument(), shapes: { a: shape }, zOrder: ['a'] };
    const adapter = mockStorage(serializeDocument(draftDocument));
    currentAdapter = adapter;

    const { result } = renderHook(() => useDraftRestore());
    await waitFor(() => expect(result.current.isPromptOpen).toBe(true));

    act(() => {
      result.current.restore();
    });
    expect(result.current.isPromptOpen).toBe(false);

    await waitFor(() => expect(editorSession.getDocument().shapes['a']).toBeDefined());
    expect(adapter.clearCalls).toBeGreaterThan(0);
  });

  it('test_restore_marksTheDocumentDirty', async () => {
    clearCleanExitFlag();
    const draftDocument = createEmptyDocument();
    currentAdapter = mockStorage(serializeDocument(draftDocument));

    const { result } = renderHook(() => useDraftRestore());
    await waitFor(() => expect(result.current.isPromptOpen).toBe(true));

    act(() => {
      result.current.restore();
    });

    await waitFor(() => expect(isDirty()).toBe(true));
  });

  it('test_discard_clearsTheDraft_withoutChangingTheDocument', async () => {
    clearCleanExitFlag();
    const draftDocument = { ...createEmptyDocument(), shapes: { a: rectShape('a') }, zOrder: ['a'] };
    const adapter = mockStorage(serializeDocument(draftDocument));
    currentAdapter = adapter;
    const before = editorSession.getDocument();

    const { result } = renderHook(() => useDraftRestore());
    await waitFor(() => expect(result.current.isPromptOpen).toBe(true));

    act(() => {
      result.current.discard();
    });

    expect(result.current.isPromptOpen).toBe(false);
    expect(editorSession.getDocument()).toBe(before);
    await waitFor(() => expect(adapter.clearCalls).toBeGreaterThan(0));
  });

  it('test_restore_invalidDraft_clearsItInstead_withoutThrowing', async () => {
    clearCleanExitFlag();
    const adapter = mockStorage('{not valid json');
    currentAdapter = adapter;
    const before = editorSession.getDocument();

    const { result } = renderHook(() => useDraftRestore());
    await waitFor(() => expect(result.current.isPromptOpen).toBe(true));

    act(() => {
      result.current.restore();
    });

    await waitFor(() => expect(adapter.clearCalls).toBeGreaterThan(0));
    expect(editorSession.getDocument()).toBe(before);
  });
});
