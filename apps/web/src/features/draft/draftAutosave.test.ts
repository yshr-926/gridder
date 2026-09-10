import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateShapeCommand, serializeDocument, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { startDraftAutosave } from './draftAutosave';
import type { DraftStorageAdapter } from './types';

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

const mockStorage = (): DraftStorageAdapter & { saveCalls: string[] } => {
  const saveCalls: string[] = [];
  return {
    saveCalls,
    save: vi.fn(async (content: string) => {
      saveCalls.push(content);
    }),
    load: vi.fn(async () => null),
    clear: vi.fn(async () => {}),
  };
};

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
  });
};

describe('startDraftAutosave', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    reset();
    vi.useRealTimers();
  });

  it('test_documentChange_savesAfterTheDebounceWindow', async () => {
    const storage = mockStorage();
    const stop = startDraftAutosave(storage, 2000);

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    expect(storage.save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
    });

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.saveCalls[0]).toBe(serializeDocument(editorSession.getDocument()));

    stop();
  });

  it('test_rapidChanges_withinTheDebounceWindow_onlySavesOnce', async () => {
    const storage = mockStorage();
    const stop = startDraftAutosave(storage, 2000);

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
    });

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.saveCalls[0]).toBe(serializeDocument(editorSession.getDocument()));

    stop();
  });

  it('test_stop_cancelsAPendingSave_andUnsubscribes', async () => {
    const storage = mockStorage();
    const stop = startDraftAutosave(storage, 2000);

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    stop();

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();
    });
    expect(storage.save).not.toHaveBeenCalled();

    // Further document changes after `stop` must not resurrect the save.
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();
    });
    expect(storage.save).not.toHaveBeenCalled();
  });
});
