import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from './useEditorSession';
import {
  renameShape,
  setShapesBorderVisible,
  setShapesFill,
  setShapesOpacity,
} from './inspectorCommands';

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
  while (editorSession.canUndo) {
    editorSession.undo();
  }
};

describe('inspectorCommands', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_renameShape_setsName_andIsUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    renameShape('a', '寝室');
    expect(editorSession.getDocument().shapes['a'].name).toBe('寝室');
    editorSession.undo();
    expect(editorSession.getDocument().shapes['a'].name).toBeUndefined();
  });

  it('test_renameShape_blankName_clearsName', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    renameShape('a', '寝室');
    renameShape('a', '   ');
    expect(editorSession.getDocument().shapes['a'].name).toBeUndefined();
  });

  it('test_setShapesFill_multipleShapes_commitsOneUndoStep', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));

    const before = editorSession.getDocument();
    setShapesFill([before.shapes['a'], before.shapes['b']], '#22c55e');

    const after = editorSession.getDocument();
    expect(after.shapes['a'].style.fill).toBe('#22c55e');
    expect(after.shapes['b'].style.fill).toBe('#22c55e');

    editorSession.undo();
    const reverted = editorSession.getDocument();
    expect(reverted.shapes['a'].style.fill).toBe('#3b82f6');
    expect(reverted.shapes['b'].style.fill).toBe('#3b82f6');
  });

  it('test_setShapesOpacity_clampsToZeroOne', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    const shape = editorSession.getDocument().shapes['a'];
    setShapesOpacity([shape], 1.5);
    expect(editorSession.getDocument().shapes['a'].style.opacity).toBe(1);
  });

  it('test_setShapesBorderVisible_togglesFlag_andIsUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    const shape = editorSession.getDocument().shapes['a'];
    setShapesBorderVisible([shape], false);
    expect(editorSession.getDocument().shapes['a'].style.isBorderVisible).toBe(false);
    editorSession.undo();
    expect(editorSession.getDocument().shapes['a'].style.isBorderVisible).toBe(true);
  });

  it('test_setShapesFill_noActualChange_dispatchesNothing', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    const shape = editorSession.getDocument().shapes['a'];
    const canUndoBefore = editorSession.canUndo;
    setShapesFill([shape], shape.style.fill);
    expect(editorSession.canUndo).toBe(canUndoBefore);
  });
});
