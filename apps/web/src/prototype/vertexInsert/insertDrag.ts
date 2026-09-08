/**
 * PROTOTYPE (issue #63) — the "insert a vertex on this edge, then drag it"
 * gesture shared by variant A (mid-edge handle) and variant D (hover ghost).
 */
import type { GridPoint, GridPolygon } from '@gridder/editor-core';
import type { PolygonEdgeRef } from '@/features/editor';
import {
  isRedundantVertex,
  ringByRef,
  snapPoint,
  validatePolygon,
  withVertexInserted,
  withVertexReplaced,
} from './geometry';
import type { GesturePreview, GestureResult, HitContext } from './types';

export interface InsertDragGesture {
  readonly edge: PolygonEdgeRef;
  readonly insertedIndex: number;
  /** Polygon with the new vertex already inserted at its starting point. */
  readonly base: GridPolygon;
  readonly origin: GridPoint;
}

export const startInsertDrag = (
  ctx: HitContext,
  edge: PolygonEdgeRef,
  at: GridPoint
): InsertDragGesture => ({
  edge,
  insertedIndex: edge.edgeIndex + 1,
  base: withVertexInserted(ctx.polygon, edge, at),
  origin: at,
});

export const moveInsertDrag = (gesture: InsertDragGesture, ctx: HitContext): GesturePreview => ({
  polygon: withVertexReplaced(
    gesture.base,
    gesture.edge.ring,
    gesture.insertedIndex,
    snapPoint(ctx.point)
  ),
});

export const endInsertDrag = (
  gesture: InsertDragGesture,
  ctx: HitContext,
  keepRedundant = false
): GestureResult => {
  const polygon = moveInsertDrag(gesture, ctx).polygon;
  const ring = ringByRef(polygon, gesture.edge.ring);
  if (isRedundantVertex(ring, gesture.insertedIndex)) {
    if (!keepRedundant) {
      return { polygon: null, message: '新しい頂点が辺上のままなので挿入しない（変更なし）' };
    }
    const validation = validatePolygon(polygon);
    if (!validation.ok) {
      return { polygon: null, message: `拒否: ${validation.reason ?? ''}` };
    }
    return {
      polygon,
      message: `クリックで (${gesture.origin.x},${gesture.origin.y}) に頂点を挿入（辺上のまま。#50 の辺移動で半分だけ動かせる）`,
    };
  }
  const validation = validatePolygon(polygon);
  if (!validation.ok) {
    return { polygon: null, message: `拒否: ${validation.reason ?? ''}` };
  }
  const p = ring[gesture.insertedIndex] ?? gesture.origin;
  return {
    polygon,
    message: `頂点を (${gesture.origin.x},${gesture.origin.y}) に挿入し (${p.x},${p.y}) へ移動`,
  };
};
