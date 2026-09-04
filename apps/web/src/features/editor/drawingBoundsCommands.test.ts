import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { fitDrawingBoundsToContent, setManualDrawingBounds } from './drawingBoundsCommands';
import { editorSession } from './useEditorSession';

const rectShape = (id: string, minX: number, minY: number, maxX: number, maxY: number): EditorShape => ({
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
  while (editorSession.canUndo) {
    editorSession.undo();
  }
};

describe('setManualDrawingBounds', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_setManualDrawingBounds_setsModeManual_withGivenRectangle', () => {
    setManualDrawingBounds({ x: 1, y: 1 }, { x: 10, y: 8 });
    const bounds = editorSession.getDocument().drawingBounds;
    expect(bounds).toEqual({ mode: 'manual', min: { x: 1, y: 1 }, max: { x: 10, y: 8 } });
  });

  it('test_setManualDrawingBounds_isUndoable', () => {
    const before = editorSession.getDocument().drawingBounds;
    setManualDrawingBounds({ x: 1, y: 1 }, { x: 10, y: 8 });
    editorSession.undo();
    expect(editorSession.getDocument().drawingBounds).toEqual(before);
  });

  it('test_setManualDrawingBounds_degenerateRectangle_isNoOp', () => {
    const before = editorSession.getDocument();
    setManualDrawingBounds({ x: 5, y: 5 }, { x: 5, y: 8 }); // zero width
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_setManualDrawingBounds_invertedRectangle_isNoOp', () => {
    const before = editorSession.getDocument();
    setManualDrawingBounds({ x: 10, y: 10 }, { x: 2, y: 2 }); // max < min
    expect(editorSession.getDocument()).toBe(before);
  });
});

describe('fitDrawingBoundsToContent', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_fitDrawingBoundsToContent_switchesToAutoMode', () => {
    setManualDrawingBounds({ x: 0, y: 0 }, { x: 5, y: 5 });
    fitDrawingBoundsToContent();
    expect(editorSession.getDocument().drawingBounds.mode).toBe('auto');
  });

  it('test_fitDrawingBoundsToContent_withShapes_storesTheirBoundingBox', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 2, 3, 6, 9)));
    setManualDrawingBounds({ x: 0, y: 0 }, { x: 100, y: 100 });

    fitDrawingBoundsToContent();

    const bounds = editorSession.getDocument().drawingBounds;
    expect(bounds).toEqual({ mode: 'auto', min: { x: 2, y: 3 }, max: { x: 6, y: 9 } });
  });

  it('test_fitDrawingBoundsToContent_isUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 2, 3, 6, 9)));
    setManualDrawingBounds({ x: 0, y: 0 }, { x: 100, y: 100 });
    const beforeFit = editorSession.getDocument().drawingBounds;

    fitDrawingBoundsToContent();
    editorSession.undo();

    expect(editorSession.getDocument().drawingBounds).toEqual(beforeFit);
  });

  it('test_fitDrawingBoundsToContent_noShapes_keepsExistingRectangle', () => {
    setManualDrawingBounds({ x: 0, y: 0 }, { x: 7, y: 7 });
    fitDrawingBoundsToContent();
    const bounds = editorSession.getDocument().drawingBounds;
    expect(bounds).toEqual({ mode: 'auto', min: { x: 0, y: 0 }, max: { x: 7, y: 7 } });
  });
});
