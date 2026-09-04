import type { EditorDocument, EditorShape, GridPoint, GridPolygon } from '../model.js';

/**
 * The bounding box (grid units) of one polygon's outer ring. `null` for a
 * degenerate ring (fewer than one vertex — the document model forbids this in
 * practice, but this function stays total rather than throwing).
 */
const polygonBoundingBox = (
  polygon: GridPolygon,
): { readonly min: GridPoint; readonly max: GridPoint } | null => {
  if (polygon.outerRing.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of polygon.outerRing) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
};

/**
 * The smallest axis-aligned box (grid units) containing every shape's outer
 * ring, or `null` when there are no shapes (spec §4: with zero shapes there is
 * nothing to fit a drawing range to). Pure and independent of any Command or
 * document history — this is the geometry {@link resolveDrawingBounds} uses for
 * `auto` mode, and what a "fit to content" action asks for explicitly.
 */
export const boundingBoxOfShapes = (
  shapes: readonly EditorShape[],
): { readonly min: GridPoint; readonly max: GridPoint } | null => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const shape of shapes) {
    const box = polygonBoundingBox(shape.polygon);
    if (box === null) {
      continue;
    }
    found = true;
    minX = Math.min(minX, box.min.x);
    minY = Math.min(minY, box.min.y);
    maxX = Math.max(maxX, box.max.x);
    maxY = Math.max(maxY, box.max.y);
  }

  return found ? { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } : null;
};

/** The current drawing range as a plain rectangle (grid units), or `null` when there is none to show. */
export interface ResolvedDrawingBounds {
  readonly min: GridPoint;
  readonly max: GridPoint;
}

/**
 * The single source of truth for "what is the drawing range right now"
 * (issue #46, spec §4). `document.drawingBounds` itself is **not** read
 * directly by callers that need the live range — go through this function
 * instead:
 *
 * - `mode: 'manual'` — the document's stored rectangle is authoritative.
 * - `mode: 'auto'` — the live bounding box of every shape, recomputed from
 *   the current document on every call. `document.drawingBounds.min` / `max`
 *   are not read in this mode; they are left holding whatever was last
 *   confirmed by a manual edit (or the document's initial value) so that
 *   switching back to `manual` later has a sane starting rectangle, but they
 *   do not describe the currently visible range.
 * - `mode: 'auto'` with zero shapes — `null` (nothing to show; spec §4 only
 *   auto-sets a range "図形が存在するとき").
 *
 * Keeping this derivation out of the document itself is what lets `auto` mode
 * track shape edits without adding a history entry per edit: every
 * shape-mutating Command already existed before this Issue and needs no
 * change, and only an explicit manual adjustment or "fit to content" ever
 * calls `SetDrawingBoundsCommand`.
 */
export const resolveDrawingBounds = (document: EditorDocument): ResolvedDrawingBounds | null => {
  if (document.drawingBounds.mode === 'manual') {
    return { min: document.drawingBounds.min, max: document.drawingBounds.max };
  }
  const shapes = document.zOrder.map((id) => document.shapes[id]).filter(
    (shape): shape is EditorShape => shape !== undefined,
  );
  return boundingBoxOfShapes(shapes);
};
