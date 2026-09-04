import { useMemo } from 'react';
import type { EditorShape, PhysicalScale } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useEditorDocument } from './useEditorSession';

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
}

export const useSelectedShapes = (): SelectedShapesView => {
  const document = useEditorDocument();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const primaryId = useSelectionStore((state) => state.primaryId);

  return useMemo(() => {
    const shapes = selectedIds
      .map((id) => document.shapes[id])
      .filter((shape): shape is EditorShape => shape !== undefined);
    const primaryShape =
      (primaryId !== null ? document.shapes[primaryId] : undefined) ?? null;
    return { shapes, primaryShape, physicalScale: document.physicalScale };
  }, [document, selectedIds, primaryId]);
};
