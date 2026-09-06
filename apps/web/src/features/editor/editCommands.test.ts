import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
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

    it('test_deleteSelection_ungroupedMemberOnly_selectedIdsHeldJustOneShape_stillExpandsToGroup', () => {
      setupGroup();
      // Even if selectedIds somehow held just one member (not expanded), the
      // group must still be deleted as a whole.
      useSelectionStore.setState({ selectedIds: ['a'], primaryId: 'a', activeGroupId: null });

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
  });
});
