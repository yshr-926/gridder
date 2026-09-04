/** The only document format understood by this first editor-core release. */
export const CURRENT_DOCUMENT_FORMAT_VERSION = 1 as const;

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
}
