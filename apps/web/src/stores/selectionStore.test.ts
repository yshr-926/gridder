import { beforeEach, describe, expect, it } from 'vitest';
import { useSelectionStore } from './selectionStore';

const reset = () => useSelectionStore.setState({ selectedIds: [], primaryId: null });

describe('useSelectionStore', () => {
  beforeEach(reset);

  it('test_selectOnly_replacesSelection_andSetsPrimary', () => {
    useSelectionStore.getState().selectOnly('a');
    useSelectionStore.getState().selectOnly('b');
    const state = useSelectionStore.getState();
    expect(state.selectedIds).toEqual(['b']);
    expect(state.primaryId).toBe('b');
  });

  it('test_toggle_addsWhenAbsent_removesWhenPresent', () => {
    const { toggle } = useSelectionStore.getState();
    toggle('a');
    toggle('b');
    expect(useSelectionStore.getState().selectedIds).toEqual(['a', 'b']);
    expect(useSelectionStore.getState().primaryId).toBe('b');

    toggle('b');
    expect(useSelectionStore.getState().selectedIds).toEqual(['a']);
    // Removing the primary falls back to the last remaining member.
    expect(useSelectionStore.getState().primaryId).toBe('a');
  });

  it('test_toggle_toEmpty_clearsPrimary', () => {
    const { toggle } = useSelectionStore.getState();
    toggle('a');
    toggle('a');
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
});
