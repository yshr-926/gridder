/**
 * The only document format this release understands. Version 2 (issue #66)
 * added the sketch-wide `annotationFontSize`; version 1 files are rejected
 * outright, since spec §9 provides no compatibility with older Gridder JSON.
 */
export const CURRENT_DOCUMENT_FORMAT_VERSION = 2 as const;

/**
 * Annotation font size (issue #66, spec §8): one sketch-wide value, in screen
 * pixels, shared by every shape name and dimension label. Kept in the document
 * — not the renderer theme — because the annotations are part of the sketch
 * (CONTEXT.md「注釈」) and a share image must reproduce them exactly.
 *
 * Range rationale:
 * - 8 px is the smallest size that stays legible on a 1x desktop display;
 *   below it, glyphs collapse to a few pixels of height and the legibility
 *   rule in the renderer (a shape shorter on screen than one line hides its
 *   name) would show labels nobody can read.
 * - 32 px is about 1.5 grid cells at the default cell size (20 px, zoom 1).
 *   Beyond that a name outgrows any shape narrower than two cells, so the
 *   setting would mostly hide names rather than enlarge them.
 * - 12 px is the pre-#66 fixed size, so a new sketch looks as it always did.
 * Whole pixels only: the stepper moves in 1 px steps and a fractional size
 * would only blur text.
 */
export const MIN_ANNOTATION_FONT_SIZE = 8;
export const MAX_ANNOTATION_FONT_SIZE = 32;
export const DEFAULT_ANNOTATION_FONT_SIZE = 12;

/** Whether `value` is an annotation font size the document accepts. */
export const isValidAnnotationFontSize = (value: number): boolean =>
  Number.isInteger(value) &&
  value >= MIN_ANNOTATION_FONT_SIZE &&
  value <= MAX_ANNOTATION_FONT_SIZE;

/** Fill colors available to a shape. Arbitrary colors are not document data. */
export const SHAPE_FILL_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#84cc16',
  '#0ea5e9',
] as const;

export type DocumentFormatVersion = typeof CURRENT_DOCUMENT_FORMAT_VERSION;
export type ShapeFillColor = (typeof SHAPE_FILL_PALETTE)[number];
export type ShapeId = string;
export type GroupId = string;

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Ordered polygon vertices. Closure is implicit: an edge connects the
 * last vertex to the first, so a rectangle is stored as exactly four vertices.
 * Explicitly repeating the first vertex at the end is invalid.
 */
export type GridRing = readonly GridPoint[];

export interface GridPolygon {
  readonly outerRing: GridRing;
  readonly innerRings: readonly GridRing[];
}

export interface ShapeStyle {
  readonly fill: ShapeFillColor;
  /** A value from 0 (transparent) through 1 (opaque). */
  readonly opacity: number;
  /** Stroke color and width are renderer theme concerns, not document data. */
  readonly isBorderVisible: boolean;
}

export interface EditorShape {
  readonly id: ShapeId;
  readonly polygon: GridPolygon;
  readonly style: ShapeStyle;
  readonly name?: string;
}

/** A flat group containing shape IDs only; a group can never contain a group. */
export interface ShapeGroup {
  readonly id: GroupId;
  readonly shapeIds: readonly ShapeId[];
}

export type DrawingBoundsMode = 'auto' | 'manual';

export interface DrawingBounds {
  readonly mode: DrawingBoundsMode;
  readonly min: GridPoint;
  readonly max: GridPoint;
}

export type PhysicalUnit = 'mm' | 'cm' | 'm';

export interface PhysicalScale {
  /** Real-world length represented by one grid cell. */
  readonly valuePerCell: number;
  readonly unit: PhysicalUnit;
}

export interface EditorDocument {
  readonly formatVersion: DocumentFormatVersion;
  readonly shapes: Readonly<Record<ShapeId, EditorShape>>;
  /** Shape IDs ordered from back to front. */
  readonly zOrder: readonly ShapeId[];
  readonly groups: Readonly<Record<GroupId, ShapeGroup>>;
  /** Exactly one export region belongs to every sketch. */
  readonly drawingBounds: DrawingBounds;
  /** When absent, dimensions are expressed as cell counts. */
  readonly physicalScale?: PhysicalScale;
  /**
   * Screen-pixel font size for shape names and dimension labels, shared by
   * the whole sketch (spec §8). Always present: unlike `physicalScale` there
   * is no meaningful "unset" state, so every document carries an explicit
   * value within [{@link MIN_ANNOTATION_FONT_SIZE}, {@link MAX_ANNOTATION_FONT_SIZE}].
   */
  readonly annotationFontSize: number;
}
