import {
  SetDrawingBoundsCommand,
  boundingBoxOfShapes,
  type DrawingBounds,
  type EditorShape,
  type GridPoint,
} from '@gridder/editor-core';
import { editorSession } from './useEditorSession';

/**
 * Mutations for the drawing range (issue #46, spec §4). Both operations are
 * exactly one {@link SetDrawingBoundsCommand} — Undo/Redo needs nothing beyond
 * what that Command already provides (see the `ask` resolution on this issue):
 * there is no separate "auto-follow" Command, because `auto` mode is a pure
 * read-time derivation ({@link resolveDrawingBounds}) rather than a value
 * copied into the document on every shape edit.
 */

/** Minimum drawing-range span in grid cells, matching the resize handles' minimum. */
const MIN_BOUNDS_SIZE_CELLS = 1;

/**
 * Confirm a manually dragged rectangle. Switches the document to
 * `mode: 'manual'` with the given rectangle as one Command. The caller
 * (the drag handle) is responsible for grid-snapping and for enforcing the
 * minimum span while previewing; this just guards against a degenerate
 * commit.
 */
export const setManualDrawingBounds = (min: GridPoint, max: GridPoint): void => {
  const width = max.x - min.x;
  const height = max.y - min.y;
  if (width < MIN_BOUNDS_SIZE_CELLS || height < MIN_BOUNDS_SIZE_CELLS) {
    return;
  }
  const next: DrawingBounds = { mode: 'manual', min, max };
  editorSession.dispatch(new SetDrawingBoundsCommand(next));
};

/**
 * "内容に合わせる" (spec §4): switch back to `auto` mode. The stored
 * rectangle is refreshed to the current shapes' bounding box too (falling
 * back to the existing rectangle when there are no shapes) purely so a
 * document saved right after this action, or a later manual edit, starts
 * from a sane value — the live `auto` range itself is always derived fresh
 * by {@link resolveDrawingBounds}, never read from this stored value.
 */
export const fitDrawingBoundsToContent = (): void => {
  const document = editorSession.getDocument();
  const shapes = document.zOrder
    .map((id) => document.shapes[id])
    .filter((shape): shape is EditorShape => shape !== undefined);
  const box = boundingBoxOfShapes(shapes) ?? {
    min: document.drawingBounds.min,
    max: document.drawingBounds.max,
  };
  const next: DrawingBounds = { mode: 'auto', min: box.min, max: box.max };
  editorSession.dispatch(new SetDrawingBoundsCommand(next));
};
