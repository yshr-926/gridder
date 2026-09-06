import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { resetDirtyTrackingForTests } from './dirtyTracking';
import { useBeforeUnload } from './useBeforeUnload';

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

const dispatchBeforeUnload = (): BeforeUnloadEvent => {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
};

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    resetDirtyTrackingForTests();
  });
};

describe('useBeforeUnload', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_documentNotDirty_beforeUnload_isNotPrevented', () => {
    renderHook(() => useBeforeUnload());

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it('test_documentDirty_beforeUnload_isPrevented_andSetsReturnValue', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    renderHook(() => useBeforeUnload());

    // jsdom's `Event.returnValue` is a boolean getter/setter (real browsers
    // use it as the legacy string-based prompt trigger), so this asserts the
    // handler *assigned* it rather than reading back a `''` that jsdom
    // wouldn't preserve.
    const returnValueSetter = vi.fn();
    Object.defineProperty(Event.prototype, 'returnValue', {
      configurable: true,
      get: () => false,
      set: returnValueSetter,
    });

    try {
      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(true);
      expect(returnValueSetter).toHaveBeenCalledWith('');
    } finally {
      delete (Event.prototype as { returnValue?: unknown }).returnValue;
    }
  });

  it('test_becomingDirtyAfterMount_startsPreventingBeforeUnload', () => {
    renderHook(() => useBeforeUnload());
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });

  it('test_unmount_removesTheListener_evenWhileDirty', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    const { unmount } = renderHook(() => useBeforeUnload());
    unmount();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });
});
