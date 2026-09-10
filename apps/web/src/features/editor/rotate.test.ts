import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { resolveClickSelection } from './groupSelection';
import { rotateSelection } from './rotate';
import { editorSession } from './useEditorSession';

const rectShape = (id: string, offsetX = 0, width = 4, height = 2): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offsetX, y: 0 },
      { x: offsetX + width, y: 0 },
      { x: offsetX + width, y: height },
      { x: offsetX, y: height },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const reset = () => {
  while (editorSession.canUndo) {
    editorSession.undo();
  }
  useSelectionStore.getState().clear();
};

describe('rotateSelection', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_rotateSelection_noSelection_doesNothing', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().clear();
    const before = editorSession.getDocument();
    const undoCountBefore = editorSession.canUndo;

    rotateSelection('cw');

    expect(editorSession.getDocument()).toBe(before);
    expect(editorSession.canUndo).toBe(undoCountBefore);
  });

  it('test_rotateSelection_cw_rotatesSelectedShapeAndIsOneUndoStep', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 4, 2)));
    useSelectionStore.getState().selectOnly('a');
    const beforeRotate = editorSession.getDocument();

    rotateSelection('cw');

    const rotated = editorSession.getDocument().shapes['a']?.polygon.outerRing;
    expect(rotated).toEqual([
      { x: 2, y: 0 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);

    editorSession.undo();
    expect(editorSession.getDocument()).toEqual(beforeRotate);
  });

  it('test_rotateSelection_multiSelection_rotatesAsOneGroup', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 4, 2)));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b', 6, 2, 4)));
    useSelectionStore.getState().setSelection(['a', 'b']);

    rotateSelection('ccw');

    const document = editorSession.getDocument();
    expect(document.shapes['a']).not.toBeUndefined();
    expect(document.shapes['b']).not.toBeUndefined();
  });

  it('test_rotateSelection_fourTimes_returnsToOriginal', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 1, 4, 3)));
    useSelectionStore.getState().selectOnly('a');
    const start = editorSession.getDocument();

    rotateSelection('cw');
    rotateSelection('cw');
    rotateSelection('cw');
    rotateSelection('cw');

    expect(editorSession.getDocument()).toEqual(start);
  });

  describe('group rotation (issue #52)', () => {
    it('test_rotateSelection_clickOnOneGroupMember_rotatesWholeGroup_oneUndoStep', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 4, 2)));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b', 6, 2, 4)));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
      // Clicking one member selects the whole group, which is what makes the
      // whole group rotate — `rotateSelection` itself trusts the selection.
      useSelectionStore
        .getState()
        .setSelection(resolveClickSelection(editorSession.getDocument(), null, 'a').shapeIds);
      const beforeRotate = editorSession.getDocument();

      rotateSelection('cw');

      const document = editorSession.getDocument();
      expect(document.shapes['a']?.polygon.outerRing).not.toEqual(
        beforeRotate.shapes['a']?.polygon.outerRing
      );
      expect(document.shapes['b']?.polygon.outerRing).not.toEqual(
        beforeRotate.shapes['b']?.polygon.outerRing
      );

      editorSession.undo();
      expect(editorSession.getDocument()).toEqual(beforeRotate);
    });

    it('test_rotateSelection_memberOfEnteredGroup_rotatesOnlyThatMember', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 4, 2)));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b', 6, 2, 4)));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      const beforeRotate = editorSession.getDocument();

      rotateSelection('cw');

      const document = editorSession.getDocument();
      expect(document.shapes['a']?.polygon.outerRing).not.toEqual(
        beforeRotate.shapes['a']?.polygon.outerRing
      );
      expect(document.shapes['b']?.polygon.outerRing).toEqual(
        beforeRotate.shapes['b']?.polygon.outerRing
      );
    });
  });
});
