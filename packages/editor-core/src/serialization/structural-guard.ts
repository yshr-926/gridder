import type { EditorDocument } from '../model.js';

/**
 * Checks that parsed JSON is *shaped* like an {@link EditorDocument} — every
 * field present with the right JS type — without checking any cross-document
 * invariant (that is {@link validateDocument}'s job, run afterward on the
 * value this returns). Kept deliberately permissive on content (a `fill` of
 * `"#000000"` passes here; `validateDocument` rejects it) so the two error
 * codes in {@link DocumentDeserializationError} stay meaningfully different:
 * "this is not a document at all" versus "this document is invalid".
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isGridPointShaped = (value: unknown): boolean =>
  isPlainObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isGridRingShaped = (value: unknown): boolean =>
  Array.isArray(value) && value.every(isGridPointShaped);

const isGridPolygonShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  isGridRingShaped(value.outerRing) &&
  Array.isArray(value.innerRings) &&
  value.innerRings.every(isGridRingShaped);

const isShapeStyleShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.fill === 'string' &&
  isFiniteNumber(value.opacity) &&
  typeof value.isBorderVisible === 'boolean';

const isEditorShapeShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  isGridPolygonShaped(value.polygon) &&
  isShapeStyleShaped(value.style) &&
  (value.name === undefined || typeof value.name === 'string');

const isShapeGroupShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  Array.isArray(value.shapeIds) &&
  value.shapeIds.every((id) => typeof id === 'string');

const isDrawingBoundsShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  (value.mode === 'auto' || value.mode === 'manual') &&
  isGridPointShaped(value.min) &&
  isGridPointShaped(value.max);

const isPhysicalScaleShaped = (value: unknown): boolean =>
  isPlainObject(value) &&
  isFiniteNumber(value.valuePerCell) &&
  (value.unit === 'mm' || value.unit === 'cm' || value.unit === 'm');

/**
 * Structural check only — does not verify `formatVersion`'s value; that is
 * {@link deserializeDocument}'s job, done before this guard runs.
 */
export const isEditorDocumentShaped = (value: unknown): value is EditorDocument => {
  if (!isPlainObject(value)) {
    return false;
  }
  if (typeof value.formatVersion !== 'number') {
    return false;
  }
  if (!isPlainObject(value.shapes) || !Object.values(value.shapes).every(isEditorShapeShaped)) {
    return false;
  }
  if (!Array.isArray(value.zOrder) || !value.zOrder.every((id) => typeof id === 'string')) {
    return false;
  }
  if (!isPlainObject(value.groups) || !Object.values(value.groups).every(isShapeGroupShaped)) {
    return false;
  }
  if (!isDrawingBoundsShaped(value.drawingBounds)) {
    return false;
  }
  if (value.physicalScale !== undefined && !isPhysicalScaleShaped(value.physicalScale)) {
    return false;
  }
  if (!isFiniteNumber(value.annotationFontSize)) {
    return false;
  }
  return true;
};
