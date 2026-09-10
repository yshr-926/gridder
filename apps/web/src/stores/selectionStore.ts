import { create } from 'zustand';

/**
 * Selection state for the polygon document editor (issue #42).
 *
 * This is deliberately separate from {@link useCanvasStore}'s `selection`, which
 * tracks the retired cell-based `GridObject` model. Here the selection is just a
 * set of `EditorShape` IDs plus a primary — transient UI state per the target
 * architecture, never part of the document or its history.
 */
interface SelectionState {
  /** Every selected shape ID. */
  readonly selectedIds: readonly string[];
  /** The most recently added / clicked shape, or `null` when nothing is selected. */
  readonly primaryId: string | null;
  /**
   * The group currently "entered" for individual selection (issue #52, spec
   * §7's "ダブルクリックで構成図形を個別選択できる"), or `null` when no group is
   * entered. While set, a click that resolves to a member of this group
   * selects that member alone instead of the whole group; a click anywhere
   * else exits group mode. The mode-transition rules live in
   * `features/editor`'s selection-resolution logic, not here — this store
   * only holds the flag and the plain setters below.
   */
  readonly activeGroupId: string | null;

  /** Replace the selection with exactly this shape. Exits group mode. */
  selectOnly: (shapeId: string) => void;
  /**
   * Replace the selection with exactly these shapes (order preserved). Exits
   * group mode. Shift+click goes through here too: what it adds or removes is
   * decided by `resolveShiftClickSelection`, which knows the group rules this
   * store deliberately does not.
   */
  setSelection: (shapeIds: readonly string[]) => void;
  /** Clear the selection. Exits group mode. */
  clear: () => void;
  /**
   * Enter group mode for `groupId` and select exactly `shapeIds` within it
   * (issue #52: double-clicking a group enters it with the clicked member
   * selected individually).
   */
  enterGroup: (groupId: string, shapeIds: readonly string[]) => void;
  /** Exit group mode without changing the current selection. */
  exitGroup: () => void;
}

const withPrimary = (
  selectedIds: readonly string[],
  preferred: string | null
): { selectedIds: readonly string[]; primaryId: string | null } => {
  if (preferred !== null && selectedIds.includes(preferred)) {
    return { selectedIds, primaryId: preferred };
  }
  return {
    selectedIds,
    primaryId: selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null,
  };
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: [],
  primaryId: null,
  activeGroupId: null,

  selectOnly: (shapeId) => set({ selectedIds: [shapeId], primaryId: shapeId, activeGroupId: null }),

  setSelection: (shapeIds) =>
    set(() => ({
      ...withPrimary([...shapeIds], shapeIds[shapeIds.length - 1] ?? null),
      activeGroupId: null,
    })),

  clear: () => set({ selectedIds: [], primaryId: null, activeGroupId: null }),

  enterGroup: (groupId, shapeIds) =>
    set(() => ({
      ...withPrimary([...shapeIds], shapeIds[shapeIds.length - 1] ?? null),
      activeGroupId: groupId,
    })),

  exitGroup: () => set({ activeGroupId: null }),
}));

// Exposed for tooling and the issue #42 Playwright workflow. Restricted to dev
// builds and the Playwright build (VITE_E2E=true) so it is never present in a
// production bundle. Guarded for non-browser contexts.
const isSelectionDebugExposed = import.meta.env.DEV || import.meta.env.VITE_E2E === 'true';

if (isSelectionDebugExposed && typeof window !== 'undefined') {
  (
    window as unknown as { __GRIDDER_SELECTION_STORE__: typeof useSelectionStore }
  ).__GRIDDER_SELECTION_STORE__ = useSelectionStore;
}
