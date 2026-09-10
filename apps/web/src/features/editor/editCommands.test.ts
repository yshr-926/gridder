import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { resolveClickSelection, resolveShiftClickSelection } from './groupSelection';
import { clearClipboardForTests, readClipboard } from './clipboard';
import {
  bringForward,
  bringToFront,
  copySelection,
  deleteSelection,
  duplicateSelection,
  pasteClipboard,
  sendBackward,
  sendToBack,
} from './editCommands';
import { editorSession } from './useEditorSession';

const rectShape = (id: string, name?: string): EditorShape => ({
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
  ...(name !== undefined ? { name } : {}),
});

const reset = () => {
  while (editorSession.canUndo) {
    editorSession.undo();
  }
  useSelectionStore.getState().clear();
  clearClipboardForTests();
};

describe('editCommands', () => {
  beforeEach(reset);
  afterEach(reset);

  describe('copySelection / pasteClipboard', () => {
    it('test_copySelection_noSelection_leavesClipboardEmpty', () => {
      copySelection();
      expect(readClipboard()).toBeNull();
    });

    it('test_pasteClipboard_afterCopy_createsShapeWithNewId_offsetByOneCell', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a', '部屋')));
      useSelectionStore.getState().selectOnly('a');
      copySelection();

      pasteClipboard();

      const document = editorSession.getDocument();
      const pastedIds = document.zOrder.filter((id) => id !== 'a');
      expect(pastedIds).toHaveLength(1);
      const pasted = document.shapes[pastedIds[0]];
      expect(pasted.id).not.toBe('a');
      expect(pasted.name).toBe('部屋');
      expect(pasted.style).toEqual(document.shapes['a'].style);
      expect(pasted.polygon.outerRing[0]).toEqual({ x: 1, y: 1 });
    });

    it('test_pasteClipboard_selectsThePastedShapes', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      useSelectionStore.getState().selectOnly('a');
      copySelection();

      pasteClipboard();

      const selected = useSelectionStore.getState().selectedIds;
      expect(selected).toHaveLength(1);
      expect(selected[0]).not.toBe('a');
    });

    it('test_pasteClipboard_repeatedPastes_shiftFurtherEachTime', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      useSelectionStore.getState().selectOnly('a');
      copySelection();

      pasteClipboard();
      const firstPastedId = useSelectionStore.getState().selectedIds[0];
      pasteClipboard();
      const secondPastedId = useSelectionStore.getState().selectedIds[0];

      const document = editorSession.getDocument();
      expect(document.shapes[firstPastedId].polygon.outerRing[0]).toEqual({ x: 1, y: 1 });
      expect(document.shapes[secondPastedId].polygon.outerRing[0]).toEqual({ x: 2, y: 2 });
    });

    it('test_pasteClipboard_multipleShapes_commitsOneUndoStep', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      useSelectionStore.getState().setSelection(['a', 'b']);
      copySelection();

      pasteClipboard();
      expect(editorSession.getDocument().zOrder).toHaveLength(4);

      editorSession.undo();
      expect(editorSession.getDocument().zOrder).toHaveLength(2);
    });

    it('test_pasteClipboard_emptyClipboard_isNoOp', () => {
      const before = editorSession.getDocument();
      pasteClipboard();
      expect(editorSession.getDocument()).toBe(before);
    });
  });

  describe('duplicateSelection', () => {
    it('test_duplicateSelection_createsOffsetCopyWithNewId_andSelectsIt', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a', '寝室')));
      useSelectionStore.getState().selectOnly('a');

      duplicateSelection();

      const document = editorSession.getDocument();
      const newId = useSelectionStore.getState().selectedIds[0];
      expect(newId).not.toBe('a');
      expect(document.shapes[newId].name).toBe('寝室');
      expect(document.shapes[newId].polygon.outerRing[0]).toEqual({ x: 1, y: 1 });
    });

    it('test_duplicateSelection_isUndoable', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      useSelectionStore.getState().selectOnly('a');

      duplicateSelection();
      expect(editorSession.getDocument().zOrder).toHaveLength(2);

      editorSession.undo();
      expect(editorSession.getDocument().zOrder).toEqual(['a']);
    });

    it('test_duplicateSelection_noSelection_isNoOp', () => {
      const before = editorSession.getDocument();
      duplicateSelection();
      expect(editorSession.getDocument()).toBe(before);
    });
  });

  describe('deleteSelection', () => {
    it('test_deleteSelection_removesEverySelectedShape_andClearsSelection', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      useSelectionStore.getState().setSelection(['a', 'b']);

      deleteSelection();

      expect(editorSession.getDocument().zOrder).toEqual([]);
      expect(useSelectionStore.getState().selectedIds).toEqual([]);
    });

    it('test_deleteSelection_isUndoableAsOneStep', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      useSelectionStore.getState().setSelection(['a', 'b']);

      deleteSelection();
      editorSession.undo();

      expect([...editorSession.getDocument().zOrder].sort()).toEqual(['a', 'b']);
    });
  });

  describe('z-order operations', () => {
    const setupThree = () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
      // zOrder: [a, b, c] (c frontmost)
    };

    it('test_bringForward_movesShapeOneStepTowardFront', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('a');
      bringForward();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'a', 'c']);
    });

    it('test_sendBackward_movesShapeOneStepTowardBack', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('c');
      sendBackward();
      expect(editorSession.getDocument().zOrder).toEqual(['a', 'c', 'b']);
    });

    it('test_bringToFront_movesShapeToFrontmost', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('a');
      bringToFront();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'c', 'a']);
    });

    it('test_sendToBack_movesShapeToBackmost', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('c');
      sendToBack();
      expect(editorSession.getDocument().zOrder).toEqual(['c', 'a', 'b']);
    });

    it('test_bringToFront_multiSelection_preservesRelativeOrder_inOneUndoStep', () => {
      setupThree();
      useSelectionStore.getState().setSelection(['a', 'b']);
      bringToFront();
      expect(editorSession.getDocument().zOrder).toEqual(['c', 'a', 'b']);

      editorSession.undo();
      expect(editorSession.getDocument().zOrder).toEqual(['a', 'b', 'c']);
    });

    it('test_sendToBack_multiSelection_preservesRelativeOrder', () => {
      setupThree();
      useSelectionStore.getState().setSelection(['b', 'c']);
      sendToBack();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'c', 'a']);
    });

    it('test_sendBackward_multiSelection_nonAdjacent_preservesRelativeOrder', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('d')));
      // zOrder: [a, b, c, d]
      useSelectionStore.getState().setSelection(['b', 'd']);
      sendBackward();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'a', 'd', 'c']);
    });

    it('test_bringForward_multiSelection_contiguous_movesPastTheNextShape', () => {
      // The reported defect: [a, b, c] with a and b selected left the order
      // untouched, because b's move undid a's.
      setupThree();
      useSelectionStore.getState().setSelection(['a', 'b']);
      bringForward();
      expect(editorSession.getDocument().zOrder).toEqual(['c', 'a', 'b']);
    });

    it('test_sendBackward_multiSelection_contiguous_movesPastThePreviousShape', () => {
      setupThree();
      useSelectionStore.getState().setSelection(['b', 'c']);
      sendBackward();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'c', 'a']);
    });

    it('test_bringForward_multiSelection_atFront_isANoOp', () => {
      setupThree();
      useSelectionStore.getState().setSelection(['b', 'c']);
      bringForward();
      expect(editorSession.getDocument().zOrder).toEqual(['a', 'b', 'c']);
    });

    it('test_bringForward_multiSelection_nonAdjacent_eachRunMovesOnItsOwn', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('d')));
      // zOrder: [a, b, c, d]
      useSelectionStore.getState().setSelection(['a', 'c']);
      bringForward();
      expect(editorSession.getDocument().zOrder).toEqual(['b', 'a', 'd', 'c']);
    });

    it('test_bringForward_multiSelection_isOneUndoStep', () => {
      setupThree();
      useSelectionStore.getState().setSelection(['a', 'b']);
      const depthBefore = editorSession.undoDepth;
      bringForward();
      expect(editorSession.undoDepth).toBe(depthBefore + 1);

      editorSession.undo();
      expect(editorSession.getDocument().zOrder).toEqual(['a', 'b', 'c']);
    });

    it('test_zOrder_isUndoable', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('a');
      bringToFront();
      editorSession.undo();
      expect(editorSession.getDocument().zOrder).toEqual(['a', 'b', 'c']);
    });

    it('test_bringForward_alreadyAtFront_isNoOp', () => {
      setupThree();
      useSelectionStore.getState().selectOnly('c');
      const before = editorSession.getDocument();
      bringForward();
      // Reorder to the same slot still dispatches, but zOrder is unchanged.
      expect(editorSession.getDocument().zOrder).toEqual(before.zOrder);
    });
  });

  describe('group operations (issue #52)', () => {
    const setupGroup = () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
    };

    it('test_duplicateSelection_oneGroupMemberSelected_duplicatesWholeGroup', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']); // a click already expands to the group

      duplicateSelection();

      expect(editorSession.getDocument().zOrder).toHaveLength(5);
      expect(useSelectionStore.getState().selectedIds).toHaveLength(2);
    });

    it('test_deleteSelection_wholeGroupSelected_deletesEveryMember_oneUndoStep', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']);

      deleteSelection();

      const document = editorSession.getDocument();
      expect(document.shapes['a']).toBeUndefined();
      expect(document.shapes['b']).toBeUndefined();
      expect(document.shapes['c']).toBeDefined();

      editorSession.undo();
      const restored = editorSession.getDocument();
      expect(restored.shapes['a']).toBeDefined();
      expect(restored.shapes['b']).toBeDefined();
      expect(restored.groups['group-1']?.shapeIds).toEqual(['a', 'b']);
    });

    it('test_deleteSelection_clickOnOneGroupMember_deletesTheWholeGroup', () => {
      setupGroup();
      // Clicking one member selects the whole group; the delete then acts on
      // exactly what is selected.
      useSelectionStore
        .getState()
        .setSelection(resolveClickSelection(editorSession.getDocument(), null, 'a').shapeIds);

      deleteSelection();

      const document = editorSession.getDocument();
      expect(document.shapes['a']).toBeUndefined();
      expect(document.shapes['b']).toBeUndefined();
    });

    it('test_deleteSelection_memberOfEnteredGroup_deletesOnlyThatMember', () => {
      setupGroup();
      useSelectionStore.getState().enterGroup('group-1', ['a']);

      deleteSelection();

      const document = editorSession.getDocument();
      expect(document.shapes['a']).toBeUndefined();
      expect(document.shapes['b']).toBeDefined();
    });

    /** A three-member group, so a single deletion still leaves a valid group. */
    const setupGroupOfThree = () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
      editorSession.dispatch(new CreateShapeCommand(rectShape('c')));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b', 'c']));
    };

    it('test_deleteSelection_shiftDeselectedMember_isNotDeleted', () => {
      // Select the whole group, then Shift-click one member out of it: the
      // deselected shape must survive the delete (spec §7).
      setupGroupOfThree();
      const selection = useSelectionStore.getState();
      selection.setSelection(['a', 'b', 'c']);
      selection.setSelection(
        resolveShiftClickSelection(editorSession.getDocument(), ['a', 'b', 'c'], null, 'c')
      );

      deleteSelection();

      const document = editorSession.getDocument();
      expect(document.shapes['a']).toBeUndefined();
      expect(document.shapes['b']).toBeUndefined();
      expect(document.shapes['c']).toBeDefined();
    });

    it('test_deleteSelection_twoMemberGroup_shiftDeselectedMember_isNotDeleted', () => {
      // [A, B] selected as a group, then B Shift-clicked out: only A goes.
      // The selection is down to a single shape, which must not be mistaken
      // for "one member clicked, expand to the group".
      setupGroup();
      const selection = useSelectionStore.getState();
      selection.setSelection(['a', 'b']);
      selection.setSelection(
        resolveShiftClickSelection(editorSession.getDocument(), ['a', 'b'], null, 'b')
      );

      deleteSelection();

      const document = editorSession.getDocument();
      expect(document.shapes['a']).toBeUndefined();
      expect(document.shapes['b']).toBeDefined();
    });

    it('test_deleteSelection_oneMemberOfSurvivingGroup_undo_restoresGroupMembership', () => {
      setupGroupOfThree();
      useSelectionStore.getState().enterGroup('group-1', ['a']);

      deleteSelection();

      // The group survives the delete with its two remaining members.
      expect(editorSession.getDocument().groups['group-1']?.shapeIds).toEqual(['b', 'c']);

      editorSession.undo();

      const restored = editorSession.getDocument();
      expect(restored.shapes['a']).toBeDefined();
      expect(restored.groups['group-1']?.shapeIds).toEqual(['a', 'b', 'c']);
    });

    it('test_duplicateSelection_wholeGroup_groupsTheCopiesToo', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']);

      duplicateSelection();

      const document = editorSession.getDocument();
      const copyIds = useSelectionStore.getState().selectedIds;
      expect(copyIds).toHaveLength(2);
      const copyGroup = Object.values(document.groups).find((group) => group.id !== 'group-1');
      expect(copyGroup?.shapeIds).toEqual([...copyIds]);
    });

    it('test_duplicateSelection_group_isOneUndoStep', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']);
      const depthBefore = editorSession.undoDepth;

      duplicateSelection();
      expect(editorSession.undoDepth).toBe(depthBefore + 1);

      editorSession.undo();
      const document = editorSession.getDocument();
      expect(document.zOrder).toHaveLength(3);
      expect(Object.keys(document.groups)).toEqual(['group-1']);
    });

    it('test_pasteClipboard_copiedGroup_groupsThePastedShapes', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']);
      copySelection();

      pasteClipboard();

      const document = editorSession.getDocument();
      const pastedIds = useSelectionStore.getState().selectedIds;
      expect(pastedIds).toHaveLength(2);
      const pastedGroup = Object.values(document.groups).find((group) => group.id !== 'group-1');
      expect(pastedGroup?.shapeIds).toEqual([...pastedIds]);
    });

    it('test_pasteClipboard_ungroupedShapes_createsNoGroup', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      useSelectionStore.getState().selectOnly('a');
      copySelection();

      pasteClipboard();

      expect(Object.keys(editorSession.getDocument().groups)).toEqual([]);
    });

    it('test_duplicateSelection_twiceInARow_eachCopyGetsItsOwnGroup', () => {
      setupGroup();
      useSelectionStore.getState().setSelection(['a', 'b']);

      duplicateSelection();
      duplicateSelection();

      const groups = Object.values(editorSession.getDocument().groups);
      expect(groups).toHaveLength(3);
      const memberIds = groups.flatMap((group) => group.shapeIds);
      expect(new Set(memberIds).size).toBe(memberIds.length);
    });
  });
});
