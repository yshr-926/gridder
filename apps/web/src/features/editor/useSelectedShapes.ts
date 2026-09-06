import { useMemo } from 'react';
import type { EditorShape, PhysicalScale } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useEditorDocument } from './useEditorSession';
import { groupContaining } from './groupSelection';

/**
 * Read-only view of the current selection for the contextual inspector
 * (issue #45).
 *
 * The inspector never owns document or selection state: it joins the live
 * {@link useEditorDocument} snapshot with the selected IDs from
 * {@link useSelectionStore} and hands back the resolved {@link EditorShape}s.
 * Selected IDs with no matching shape (a stale marquee result, a just-deleted
 * shape) are dropped. Every mutation the inspector performs still goes through
 * an editor-core Command via {@link editorSession}.
 */
export interface SelectedShapesView {
  /** Resolved shapes for every selected ID, in selection order. */
  readonly shapes: readonly EditorShape[];
  /** The primary shape (last clicked / added), or `null`. */
  readonly primaryShape: EditorShape | null;
  /** Real-world scale of the sketch, or `undefined` for cell counts. */
  readonly physicalScale: PhysicalScale | undefined;
  /**
   * Whether the selection is exactly one whole group's members (issue #52,
   * spec §7 / ui-principles §7: the inspector shows only common operations
   * for "複数選択またはグループ" — this distinguishes the two for copy). `false`
   * while inside group mode, since only one member is meant to be selected
   * individually then.
   */
  readonly isGroupSelection: boolean;
}

export const useSelectedShapes = (): SelectedShapesView => {
  const document = useEditorDocument();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const primaryId = useSelectionStore((state) => state.primaryId);
  const activeGroupId = useSelectionStore((state) => state.activeGroupId);

  return useMemo(() => {
    const shapes = selectedIds
      .map((id) => document.shapes[id])
      .filter((shape): shape is EditorShape => shape !== undefined);
    const primaryShape =
      (primaryId !== null ? document.shapes[primaryId] : undefined) ?? null;

    const isGroupSelection =
      activeGroupId === null &&
      selectedIds.length >= 2 &&
      (() => {
        const group = groupContaining(document, selectedIds[0]);
        if (group === null) {
          return false;
        }
        const selectedSet = new Set(selectedIds);
        return (
          group.shapeIds.length === selectedIds.length &&
          group.shapeIds.every((id) => selectedSet.has(id))
        );
      })();

    return {
      shapes,
      primaryShape,
      physicalScale: document.physicalScale,
      isGroupSelection,
    };
  }, [document, selectedIds, primaryId, activeGroupId]);
};
