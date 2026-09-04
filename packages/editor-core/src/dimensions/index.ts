/**
 * Dimension geometry and formatting for `@gridder/editor-core` (issue #53,
 * spec §8). Real-world scale itself (`PhysicalScale`) lives in `model.ts`
 * as part of the document; this module holds the pure derivation — a
 * vertex set's bounding-box size in cells, and formatting that size for
 * display with or without a scale. Changing the document's scale goes
 * through `SetPhysicalScaleCommand` — this module has no Command of its own.
 */
export {
  cellSizeOfPolygon,
  cellSizeOfVertices,
  formatDimension,
  type CellSize,
} from './compute.js';
