import { create } from 'zustand';
import type { GridPoint } from '@gridder/editor-core';

/**
 * Transient Konva-only preview for an in-progress shape drag (issue #43, spec
 * §14). While a move gesture is active, {@link useEditorInteraction} writes the
 * live integer grid delta here and the renderer Adapter (`ShapesLayer`,
 * `SelectionOverlay`) offsets the moving shapes' Konva nodes directly — the
 * document and React state are untouched until pointer-up commits one
 * Command. Cleared back to `null` the instant the gesture ends, successfully
 * or not.
 */
interface MovePreviewState {
  /** `null` when no move gesture is in progress. */
  readonly preview: {
    readonly shapeIds: readonly string[];
    readonly delta: GridPoint;
  } | null;

  setPreview: (shapeIds: readonly string[], delta: GridPoint) => void;
  clearPreview: () => void;
}

export const useMovePreviewStore = create<MovePreviewState>((set) => ({
  preview: null,

  setPreview: (shapeIds, delta) => set({ preview: { shapeIds, delta } }),
  clearPreview: () => set({ preview: null }),
}));
