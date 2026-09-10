import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { setManualDrawingBounds } from './drawingBoundsCommands';
import { editorSession } from './useEditorSession';
import { useDrawingBounds } from './useDrawingBounds';

const rectShape = (
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
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
  });
};

describe('useDrawingBounds', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_useDrawingBounds_autoMode_noShapes_returnsNull', () => {
    const { result } = renderHook(() => useDrawingBounds());
    expect(result.current).toBeNull();
  });

  it('test_useDrawingBounds_autoMode_withShapes_returnsBoundingBox', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 1, 1, 4, 5)));
    const { result } = renderHook(() => useDrawingBounds());
    expect(result.current).toEqual({ min: { x: 1, y: 1 }, max: { x: 4, y: 5 } });
  });

  it('test_useDrawingBounds_manualMode_returnsStoredRectangle', () => {
    setManualDrawingBounds({ x: -2, y: -2 }, { x: 12, y: 12 });
    const { result } = renderHook(() => useDrawingBounds());
    expect(result.current).toEqual({ min: { x: -2, y: -2 }, max: { x: 12, y: 12 } });
  });

  it('test_useDrawingBounds_reRendersWhenDocumentChanges', () => {
    const { result, rerender } = renderHook(() => useDrawingBounds());
    expect(result.current).toBeNull();

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 3, 3)));
    });
    rerender();

    expect(result.current).toEqual({ min: { x: 0, y: 0 }, max: { x: 3, y: 3 } });
  });
});
