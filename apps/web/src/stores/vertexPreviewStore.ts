import { create } from 'zustand';
import type { GridPolygon } from '@gridder/editor-core';

/**
 * Transient Konva-only preview for an in-progress vertex or edge drag
 * (issue #50, spec §14). While the gesture is active, `useEditorInteraction`
 * writes the live proposed polygon here and the renderer Adapter
 * (`ShapesLayer`, `VertexEditOverlay`) redraws the shape's Konva node and the
 * vertex/edge markers directly from it — the document and React state are
 * untouched until pointer-up commits one `ReplaceShapeVerticesCommand` (or
 * the edit is rejected and nothing commits). Cleared back to `null` the
 * instant the gesture ends, successfully or not. Kept separate from
 * `useResizePreviewStore` because a vertex/edge edit previews a full
 * replacement polygon (with holes), not an axis-aligned box.
 */
interface VertexPreviewState {
  /** `null` when no vertex/edge gesture is in progress. */
  readonly preview: {
    readonly shapeId: string;
    readonly polygon: GridPolygon;
  } | null;

  setPreview: (shapeId: string, polygon: GridPolygon) => void;
  clearPreview: () => void;
}

export const useVertexPreviewStore = create<VertexPreviewState>((set) => ({
  preview: null,

  setPreview: (shapeId, polygon) => set({ preview: { shapeId, polygon } }),
  clearPreview: () => set({ preview: null }),
}));
