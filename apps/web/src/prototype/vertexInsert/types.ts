/**
 * PROTOTYPE (issue #63) — shared contract between the host page and the
 * four interaction variants. Throwaway; delete with this folder.
 */
import type { GridPoint, GridPolygon, GridRing } from '@gridder/editor-core';
import type { PolygonEdgeRef } from '@/features/editor';
import type { ReactNode } from 'react';

export interface VariantOptionSpec {
  readonly key: string;
  readonly label: string;
  readonly defaultValue: boolean;
}

export type VariantOptions = Readonly<Record<string, boolean>>;

/** Everything a variant needs to answer "what is under the pointer?". */
export interface HitContext {
  /** Committed polygon (never the in-flight preview). */
  readonly polygon: GridPolygon;
  /** Pointer position in grid units (fractional). */
  readonly point: GridPoint;
  /** Screen-pixel based hit radius, already converted to grid units. */
  readonly hitRadius: number;
  /** Converts screen pixels to grid units at the current zoom. */
  readonly pxToGrid: (px: number) => number;
  readonly isRect: boolean;
  readonly options: VariantOptions;
  readonly altKey: boolean;
}

export interface GesturePreview {
  readonly polygon: GridPolygon;
  /** Optional dashed rectangle (variant C's push-out region). */
  readonly ghostRect?: GridRing | null;
  readonly ghostKind?: 'add' | 'cut';
  readonly message?: string;
}

export interface GestureResult {
  /** `null` = revert to the committed polygon. */
  readonly polygon: GridPolygon | null;
  readonly message: string;
}

export interface OverlayContext {
  /** Polygon to draw affordances on (preview while a gesture runs). */
  readonly polygon: GridPolygon;
  readonly gridSize: number;
  readonly scale: number;
  readonly isRect: boolean;
  readonly options: VariantOptions;
  readonly showResizeHandles: boolean;
  readonly showVertexMarkers: boolean;
}

export interface OverlayProps<Hit, Gesture> {
  readonly ctx: OverlayContext;
  readonly hover: Hit | null;
  readonly gesture: Gesture | null;
  readonly preview: GesturePreview | null;
}

export interface Variant<Hit, Gesture> {
  readonly key: string;
  readonly name: string;
  readonly summary: string;
  readonly tryThis: readonly string[];
  readonly options: readonly VariantOptionSpec[];
  /** Runs before the base (#44 / #50 / move) hit-test; return `null` to fall through. */
  readonly hitTest: (ctx: HitContext) => Hit | null;
  readonly cursorFor: (hit: Hit) => string;
  readonly startGesture: (ctx: HitContext, hit: Hit) => Gesture | null;
  readonly moveGesture: (gesture: Gesture, ctx: HitContext) => GesturePreview;
  readonly endGesture: (gesture: Gesture, ctx: HitContext) => GestureResult;
  /** Double-click landing on a polygon edge (after the base hit-test found that edge). */
  readonly doubleClickEdge?: (ctx: HitContext, edge: PolygonEdgeRef) => GestureResult | null;
  /** When true, the base #50 edge-drag is not offered (the variant owns edges). */
  readonly ownsEdgeDrag: boolean;
  /** When true, the variant's hit is display-only: cursor and gesture come from the base hit-test. */
  readonly passive?: boolean;
  readonly Overlay: (props: OverlayProps<Hit, Gesture>) => ReactNode;
}

export type AnyVariant = Variant<unknown, unknown>;

export const defineVariant = <Hit, Gesture>(variant: Variant<Hit, Gesture>): AnyVariant =>
  variant as unknown as AnyVariant;
