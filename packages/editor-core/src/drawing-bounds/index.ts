/**
 * Drawing-range geometry for `@gridder/editor-core` (issue #46, spec §4).
 *
 * `DrawingBounds` itself lives in `model.ts` (it's part of the document); this
 * module holds the pure derivation logic: computing a shape set's bounding box
 * and resolving "what range is currently in effect" for `auto` vs `manual`
 * mode. State transitions (switching mode, or setting a manual rectangle) go
 * through the existing `SetDrawingBoundsCommand` — this module has no Command
 * of its own.
 */
export {
  boundingBoxOfShapes,
  resolveDrawingBounds,
  type ResolvedDrawingBounds,
} from './compute.js';
