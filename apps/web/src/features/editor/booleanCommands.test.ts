import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { resolveClickSelection } from './groupSelection';
import { useToastStore } from '@/hooks/useToast';
import { combineSelection, subtractSelection } from './booleanCommands';
import { editorSession } from './useEditorSession';

const rect = (id: string, minX: number, minY: number, maxX: number, maxY: number): EditorShape => ({
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
  useSelectionStore.getState().clear();
  useToastStore.setState({ toasts: [] });
};

describe('combineSelection', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_combineSelection_twoAdjacentRects_becomeOneShape_selectedAsFrontmost_oneUndoStep', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    editorSession.dispatch(new CreateShapeCommand(rect('b', 3, 0, 4, 1)));
    useSelectionStore.getState().setSelection(['a', 'b']);
    const undoDepthBefore = editorSession.undoDepth;

    combineSelection();

    const document = editorSession.getDocument();
    expect(document.zOrder).toEqual(['b']);
    expect(document.shapes['b'].polygon.outerRing).toHaveLength(6);
    expect(useSelectionStore.getState().selectedIds).toEqual(['b']);
    expect(editorSession.undoDepth).toBe(undoDepthBefore + 1);

    editorSession.undo();
    expect(editorSession.getDocument().zOrder).toEqual(['a', 'b']);
    expect(editorSession.getDocument().shapes['a']).toEqual(rect('a', 0, 0, 3, 3));
  });

  it('test_combineSelection_separatedRects_showsToast_dispatchesNothing', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    editorSession.dispatch(new CreateShapeCommand(rect('b', 5, 0, 8, 3)));
    useSelectionStore.getState().setSelection(['a', 'b']);
    const undoDepthBefore = editorSession.undoDepth;

    combineSelection();

    expect(editorSession.undoDepth).toBe(undoDepthBefore);
    expect(editorSession.getDocument().zOrder).toEqual(['a', 'b']);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].type).toBe('error');
    expect([...useSelectionStore.getState().selectedIds]).toEqual(['a', 'b']);
  });

  it('test_combineSelection_singleSelection_isNoOp', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    useSelectionStore.getState().selectOnly('a');
    const undoDepthBefore = editorSession.undoDepth;

    combineSelection();

    expect(editorSession.undoDepth).toBe(undoDepthBefore);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('test_combineSelection_clickOnOneGroupMember_combinesTheWholeGroup', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 2, 2)));
    editorSession.dispatch(new CreateShapeCommand(rect('b', 2, 0, 4, 2)));
    editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
    // A click on one member selects the whole group.
    useSelectionStore
      .getState()
      .setSelection(resolveClickSelection(editorSession.getDocument(), null, 'a').shapeIds);

    combineSelection();

    expect(editorSession.getDocument().zOrder).toEqual(['b']);
    expect(editorSession.getDocument().groups).toEqual({});
  });
});

describe('subtractSelection', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_subtractSelection_cutterInsideSubject_leavesAHole_selectsTheSubject_oneUndoStep', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('subject', 0, 0, 4, 4)));
    editorSession.dispatch(new CreateShapeCommand(rect('cutter', 1, 1, 2, 2)));
    useSelectionStore.getState().setSelection(['subject', 'cutter']);
    const undoDepthBefore = editorSession.undoDepth;

    subtractSelection();

    const document = editorSession.getDocument();
    expect(document.zOrder).toEqual(['subject']);
    expect(document.shapes['subject'].polygon.innerRings).toHaveLength(1);
    expect(useSelectionStore.getState().selectedIds).toEqual(['subject']);
    expect(editorSession.undoDepth).toBe(undoDepthBefore + 1);

    editorSession.undo();
    expect(editorSession.getDocument().zOrder).toEqual(['subject', 'cutter']);
    expect(editorSession.getDocument().shapes['subject'].polygon.innerRings).toHaveLength(0);
  });

  it('test_subtractSelection_cutterSplitsSubject_selectsBothPieces', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('subject', 0, 0, 5, 2)));
    editorSession.dispatch(new CreateShapeCommand(rect('cutter', 2, 0, 3, 2)));
    useSelectionStore.getState().setSelection(['subject', 'cutter']);

    subtractSelection();

    const document = editorSession.getDocument();
    expect(document.zOrder).toHaveLength(2);
    expect(document.shapes['cutter']).toBeUndefined();
    expect([...useSelectionStore.getState().selectedIds].sort()).toEqual(
      [...document.zOrder].sort()
    );
  });

  it('test_subtractSelection_subjectFullyCovered_clearsTheSelection', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('subject', 1, 1, 2, 2)));
    editorSession.dispatch(new CreateShapeCommand(rect('cutter', 0, 0, 4, 4)));
    useSelectionStore.getState().setSelection(['subject', 'cutter']);

    subtractSelection();

    expect(editorSession.getDocument().zOrder).toEqual([]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('test_subtractSelection_singleSelection_isNoOp', () => {
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    useSelectionStore.getState().selectOnly('a');
    const undoDepthBefore = editorSession.undoDepth;

    subtractSelection();

    expect(editorSession.undoDepth).toBe(undoDepthBefore);
    expect(editorSession.getDocument().zOrder).toEqual(['a']);
  });
});
