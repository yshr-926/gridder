import { create } from 'zustand';
import type { GridPolygon } from '@gridder/editor-core';

/**
 * Transient Konva-only preview for an in-progress cell-edit gesture
 * (issue #49, spec §14). While `editingShape` is active,
 * `useEditorInteraction` writes the live working polygons here after every
 * completed and in-progress cell-drag stroke, and the renderer Adapters
 * (`ShapesLayer`, `ShapeEditLayer`) redraw the edited shape's Konva node
 * from them — possibly as more than one node when a `difference` stroke has
 * disconnected the shape — and dim every other shape. The document and
 * React state stay untouched until `Enter` commits one Command (or the
 * gesture is discarded with `Esc`). Cleared back to `null` the instant the
 * gesture ends, successfully or not.
 */
interface ShapeEditPreviewState {
  /** `null` when no shape is being cell-edited. */
  readonly preview: {
    readonly shapeId: string;
    readonly workingPolygons: readonly GridPolygon[];
  } | null;

  setPreview: (shapeId: string, workingPolygons: readonly GridPolygon[]) => void;
  clearPreview: () => void;
}

export const useShapeEditPreviewStore = create<ShapeEditPreviewState>((set) => ({
  preview: null,

  setPreview: (shapeId, workingPolygons) => set({ preview: { shapeId, workingPolygons } }),
  clearPreview: () => set({ preview: null }),
}));
