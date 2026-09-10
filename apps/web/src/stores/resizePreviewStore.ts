import { create } from 'zustand';
import type { GridRect } from '@/features/editor';

/**
 * Transient Konva-only preview for an in-progress rectangle resize
 * (issue #44, spec §14). While a resize gesture is active,
 * `useEditorInteraction` writes the live flip-normalised bounds here and the
 * renderer Adapter (`ShapesLayer`, `SelectionOverlay`) redraws the resized
 * shape's Konva node directly from these bounds — the document and React
 * state are untouched until pointer-up commits one
 * `ReplaceShapeVerticesCommand`. Cleared back to `null` the instant the
 * gesture ends, successfully or not. Kept separate from
 * `useMovePreviewStore` because a resize preview is a full replacement
 * rectangle, not an offset applied to the existing geometry.
 */
interface ResizePreviewState {
  /** `null` when no resize gesture is in progress. */
  readonly preview: {
    readonly shapeId: string;
    readonly bounds: GridRect;
  } | null;

  setPreview: (shapeId: string, bounds: GridRect) => void;
  clearPreview: () => void;
}

export const useResizePreviewStore = create<ResizePreviewState>((set) => ({
  preview: null,

  setPreview: (shapeId, bounds) => set({ preview: { shapeId, bounds } }),
  clearPreview: () => set({ preview: null }),
}));
