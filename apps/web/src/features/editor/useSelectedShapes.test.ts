import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';
import { useSelectedShapes } from './useSelectedShapes';

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
  // Wrapped in act: a previous test's renderHook subscription may still be
  // mounted when this runs in afterEach.
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
  });
};

describe('useSelectedShapes', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_useSelectedShapes_noSelection_returnsEmpty', () => {
    const { result } = renderHook(() => useSelectedShapes());
    expect(result.current.shapes).toEqual([]);
    expect(result.current.primaryShape).toBeNull();
  });

  it('test_useSelectedShapes_singleSelection_resolvesShapeAndPrimary', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');

    const { result } = renderHook(() => useSelectedShapes());

    expect(result.current.shapes.map((s) => s.id)).toEqual(['a']);
    expect(result.current.primaryShape?.id).toBe('a');
  });

  it('test_useSelectedShapes_dropsStaleSelectedIds', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().setSelection(['a', 'deleted']);

    const { result } = renderHook(() => useSelectedShapes());

    expect(result.current.shapes.map((s) => s.id)).toEqual(['a']);
  });

  it('test_useSelectedShapes_noPhysicalScale_returnsUndefined', () => {
    const { result } = renderHook(() => useSelectedShapes());
    expect(result.current.physicalScale).toBeUndefined();
  });
});
