import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { clearClipboardForTests } from './clipboard';
import { editorSession } from './useEditorSession';
import { useEditShortcuts } from './useEditShortcuts';

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

const dispatchKey = (init: KeyboardEventInit, target: EventTarget = window) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
};

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
    clearClipboardForTests();
  });
};

describe('useEditShortcuts', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_delete_removesSelectedShapes', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'Delete' });
    });

    expect(editorSession.getDocument().zOrder).toEqual([]);
  });

  it('test_backspace_removesSelectedShapes', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'Backspace' });
    });

    expect(editorSession.getDocument().zOrder).toEqual([]);
  });

  it('test_ctrlD_duplicatesSelection', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'd', ctrlKey: true });
    });

    expect(editorSession.getDocument().zOrder).toHaveLength(2);
  });

  it('test_ctrlCThenCtrlV_pastesACopy', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'c', ctrlKey: true });
    });
    act(() => {
      dispatchKey({ key: 'v', ctrlKey: true });
    });

    expect(editorSession.getDocument().zOrder).toHaveLength(2);
  });

  it('test_ctrlBracketRight_bringsForward', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: ']', ctrlKey: true });
    });

    expect(editorSession.getDocument().zOrder).toEqual(['b', 'a']);
  });

  it('test_ctrlShiftBracketLeft_sendsToBack', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().selectOnly('b');
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: '[', ctrlKey: true, shiftKey: true });
    });

    expect(editorSession.getDocument().zOrder).toEqual(['b', 'a']);
  });

  it('test_deleteKey_whileInputFocused_isIgnored', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      dispatchKey({ key: 'Delete' }, input);
    });

    expect(editorSession.getDocument().zOrder).toEqual(['a']);
    document.body.removeChild(input);
  });

  it('test_ctrlD_whileTextareaFocused_isIgnored', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    renderHook(() => useEditShortcuts());

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      dispatchKey({ key: 'd', ctrlKey: true }, textarea);
    });

    expect(editorSession.getDocument().zOrder).toEqual(['a']);
    document.body.removeChild(textarea);
  });

  it('test_ctrlG_groupsSelection', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'g', ctrlKey: true });
    });

    expect(Object.keys(editorSession.getDocument().groups)).toHaveLength(1);
  });

  it('test_ctrlShiftG_ungroupsSelection', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    renderHook(() => useEditShortcuts());

    act(() => {
      dispatchKey({ key: 'g', ctrlKey: true });
    });
    act(() => {
      dispatchKey({ key: 'G', ctrlKey: true, shiftKey: true });
    });

    expect(Object.keys(editorSession.getDocument().groups)).toHaveLength(0);
  });

  it('test_ctrlG_whileInputFocused_isIgnored', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    renderHook(() => useEditShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      dispatchKey({ key: 'g', ctrlKey: true }, input);
    });

    expect(Object.keys(editorSession.getDocument().groups)).toHaveLength(0);
    document.body.removeChild(input);
  });
});
