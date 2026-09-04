import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';
import { useRotateShortcut } from './useRotateShortcut';

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const dispatchKey = (init: KeyboardEventInit, target: EventTarget = window) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
};

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
  });
};

describe('useRotateShortcut', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_r_rotatesSelectionClockwise', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useRotateShortcut());

    act(() => {
      dispatchKey({ key: 'r' });
    });

    expect(editorSession.getDocument().shapes['a']?.polygon.outerRing).toEqual([
      { x: 2, y: 0 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);
  });

  it('test_shiftR_rotatesSelectionCounterClockwise', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useRotateShortcut());

    act(() => {
      dispatchKey({ key: 'R', shiftKey: true });
    });

    expect(editorSession.getDocument().shapes['a']?.polygon.outerRing).toEqual([
      { x: 0, y: 4 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 4 },
    ]);
  });

  it('test_r_withCtrlModifier_isIgnored', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useRotateShortcut());
    const before = editorSession.getDocument();

    act(() => {
      dispatchKey({ key: 'r', ctrlKey: true });
    });

    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_r_whileInputFocused_isIgnored', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useRotateShortcut());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const before = editorSession.getDocument();

    act(() => {
      dispatchKey({ key: 'r' }, input);
    });

    expect(editorSession.getDocument()).toBe(before);
    document.body.removeChild(input);
  });
});
