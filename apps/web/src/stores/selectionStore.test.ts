import { beforeEach, describe, expect, it } from 'vitest';
import { useSelectionStore } from './selectionStore';

const reset = () =>
  useSelectionStore.setState({ selectedIds: [], primaryId: null, activeGroupId: null });

describe('useSelectionStore', () => {
  beforeEach(reset);

  it('test_selectOnly_replacesSelection_andSetsPrimary', () => {
    useSelectionStore.getState().selectOnly('a');
    useSelectionStore.getState().selectOnly('b');
    const state = useSelectionStore.getState();
    expect(state.selectedIds).toEqual(['b']);
    expect(state.primaryId).toBe('b');
  });

  it('test_setSelection_droppingThePrimary_fallsBackToTheLastRemainingShape', () => {
    // What a Shift+click removal ends up doing: the shape it took out was the
    // primary, so the primary moves to what is left.
    const { setSelection } = useSelectionStore.getState();
    setSelection(['a', 'b']);
    expect(useSelectionStore.getState().primaryId).toBe('b');

    setSelection(['a']);
    expect(useSelectionStore.getState().selectedIds).toEqual(['a']);
    expect(useSelectionStore.getState().primaryId).toBe('a');
  });

  it('test_setSelection_toEmpty_clearsPrimary', () => {
    const { setSelection } = useSelectionStore.getState();
    setSelection(['a']);
    setSelection([]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
    expect(useSelectionStore.getState().primaryId).toBeNull();
  });

  it('test_setSelection_replacesWithManyShapes_primaryIsLast', () => {
    useSelectionStore.getState().setSelection(['x', 'y', 'z']);
    const state = useSelectionStore.getState();
    expect(state.selectedIds).toEqual(['x', 'y', 'z']);
    expect(state.primaryId).toBe('z');
  });

  it('test_setSelection_empty_clearsEverything', () => {
    useSelectionStore.getState().selectOnly('a');
    useSelectionStore.getState().setSelection([]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
    expect(useSelectionStore.getState().primaryId).toBeNull();
  });

  it('test_clear_emptiesSelection', () => {
    useSelectionStore.getState().setSelection(['a', 'b']);
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
    expect(useSelectionStore.getState().primaryId).toBeNull();
  });

  describe('group mode (issue #52)', () => {
    it('test_enterGroup_setsActiveGroupId_andSelectsGivenShapes', () => {
      useSelectionStore.getState().enterGroup('group-1', ['a', 'b']);
      const state = useSelectionStore.getState();
      expect(state.activeGroupId).toBe('group-1');
      expect(state.selectedIds).toEqual(['a', 'b']);
      expect(state.primaryId).toBe('b');
    });

    it('test_exitGroup_clearsActiveGroupId_keepsSelection', () => {
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      useSelectionStore.getState().exitGroup();
      const state = useSelectionStore.getState();
      expect(state.activeGroupId).toBeNull();
      expect(state.selectedIds).toEqual(['a']);
    });

    it('test_selectOnly_exitsGroupMode', () => {
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      useSelectionStore.getState().selectOnly('c');
      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });

    it('test_setSelection_exitsGroupMode', () => {
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      useSelectionStore.getState().setSelection(['x', 'y']);
      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });

    it('test_clear_exitsGroupMode', () => {
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      useSelectionStore.getState().clear();
      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });
  });
});
