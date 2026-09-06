import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { groupSelection, ungroupSelection } from './groupCommands';
import { editorSession } from './useEditorSession';

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
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
  useSelectionStore.getState().clear();
};

describe('groupSelection', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_groupSelection_twoShapesSelected_createsGroup_andSelectsIt', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);

    groupSelection();

    const document = editorSession.getDocument();
    const groups = Object.values(document.groups);
    expect(groups).toHaveLength(1);
    expect(groups[0].shapeIds.sort()).toEqual(['a', 'b']);
    expect(useSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b']);
  });

  it('test_groupSelection_isUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);

    groupSelection();
    editorSession.undo();

    expect(Object.keys(editorSession.getDocument().groups)).toEqual([]);
  });

  it('test_groupSelection_fewerThanTwoShapes_isNoOp', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    const before = editorSession.getDocument();

    groupSelection();

    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_groupSelection_noSelection_isNoOp', () => {
    const before = editorSession.getDocument();
    groupSelection();
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_groupSelection_selectionOverlapsExistingGroup_dissolvesAndReplaces', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    groupSelection();
    const firstGroupId = Object.keys(editorSession.getDocument().groups)[0];

    useSelectionStore.getState().setSelection(['b', 'c']);
    groupSelection();

    const document = editorSession.getDocument();
    expect(document.groups[firstGroupId]).toBeUndefined();
    const groups = Object.values(document.groups);
    expect(groups).toHaveLength(1);
    expect(groups[0].shapeIds.sort()).toEqual(['b', 'c']);
  });
});

describe('ungroupSelection', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_ungroupSelection_memberSelected_removesGroup_selectsFormerMembers', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    groupSelection();

    ungroupSelection();

    expect(Object.keys(editorSession.getDocument().groups)).toEqual([]);
    expect(useSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b']);
  });

  it('test_ungroupSelection_isUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    groupSelection();
    const grouped = editorSession.getDocument();

    ungroupSelection();
    editorSession.undo();

    expect(editorSession.getDocument()).toEqual(grouped);
  });

  it('test_ungroupSelection_ungroupedShapeSelected_isNoOp', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');
    const before = editorSession.getDocument();

    ungroupSelection();

    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_ungroupSelection_noSelection_isNoOp', () => {
    const before = editorSession.getDocument();
    ungroupSelection();
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_ungroupSelection_whileInGroupMode_usesActiveGroup', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().setSelection(['a', 'b']);
    groupSelection();
    const groupId = Object.keys(editorSession.getDocument().groups)[0];
    useSelectionStore.getState().enterGroup(groupId, ['a']);

    ungroupSelection();

    expect(Object.keys(editorSession.getDocument().groups)).toEqual([]);
    expect(useSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b']);
  });
});
