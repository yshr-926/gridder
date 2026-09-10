import { create } from 'zustand';

/**
 * Transient Konva-only preview for an in-progress opacity drag (issue #45,
 * AGENTS.md "Keep drag updates out of React document state; commit one Command
 * when the gesture ends"). While the inspector's opacity slider is being
 * dragged, `ShapeAppearance` writes the live value here and `ShapesLayer`
 * renders the affected shapes at that opacity — the document is untouched
 * until the gesture ends and commits one Command, so a 70→60→50 drag is a
 * single Undo step rather than three. Cleared back to `null` the instant the
 * gesture ends.
 */
interface OpacityPreviewState {
  /** `null` when no opacity gesture is in progress. */
  readonly preview: {
    readonly shapeIds: readonly string[];
    /** Live opacity in 0..1, replacing each listed shape's own value. */
    readonly opacity: number;
  } | null;

  setPreview: (shapeIds: readonly string[], opacity: number) => void;
  clearPreview: () => void;
}

export const useOpacityPreviewStore = create<OpacityPreviewState>((set) => ({
  preview: null,

  setPreview: (shapeIds, opacity) => set({ preview: { shapeIds, opacity } }),
  clearPreview: () => set({ preview: null }),
}));
