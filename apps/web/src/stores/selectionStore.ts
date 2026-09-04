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

  /** Replace the selection with exactly this shape. */
  selectOnly: (shapeId: string) => void;
  /** Replace the selection with exactly these shapes (order preserved). */
  setSelection: (shapeIds: readonly string[]) => void;
  /** Add the shape if absent, remove it if present (Shift+click). */
  toggle: (shapeId: string) => void;
  /** Clear the selection. */
  clear: () => void;
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

  selectOnly: (shapeId) => set({ selectedIds: [shapeId], primaryId: shapeId }),

  setSelection: (shapeIds) =>
    set(() => withPrimary([...shapeIds], shapeIds[shapeIds.length - 1] ?? null)),

  toggle: (shapeId) =>
    set((state) => {
      const isSelected = state.selectedIds.includes(shapeId);
      const selectedIds = isSelected
        ? state.selectedIds.filter((id) => id !== shapeId)
        : [...state.selectedIds, shapeId];
      return withPrimary(selectedIds, isSelected ? null : shapeId);
    }),

  clear: () => set({ selectedIds: [], primaryId: null }),
}));

// Exposed for tooling and the issue #42 Playwright workflow. Restricted to dev
// builds and the Playwright build (VITE_E2E=true) so it is never present in a
// production bundle. Guarded for non-browser contexts.
const isSelectionDebugExposed =
  import.meta.env.DEV || import.meta.env.VITE_E2E === 'true';

if (isSelectionDebugExposed && typeof window !== 'undefined') {
  (window as unknown as { __GRIDDER_SELECTION_STORE__: typeof useSelectionStore }).__GRIDDER_SELECTION_STORE__ =
    useSelectionStore;
}
