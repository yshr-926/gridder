/* eslint-disable react-refresh/only-export-components -- prototype: the variant object carries its own overlay component */
/**
 * PROTOTYPE (issue #63) — 案 B: 辺のダブルクリックで挿入。
 * 辺をダブルクリックすると、その位置（に最も近いグリッド点）に頂点が挿入される。
 * 挿入後は #50 の頂点ドラッグで動かす（操作は 2 段階）。
 */
import { Circle, Group } from 'react-konva';
import type { GridPoint } from '@gridder/editor-core';
import { edgeAtPoint, vertexAtPoint, type PolygonEdgeRef } from '@/features/editor';
import {
  edgeEndpoints,
  nearestInteriorGridPoint,
  validatePolygon,
  withVertexInserted,
} from '../geometry';
import { ACCENT } from '../theme';
import { defineVariant, type OverlayProps } from '../types';

interface EdgePreviewHit {
  readonly edge: PolygonEdgeRef;
  readonly point: GridPoint;
}

const SHOW_PREVIEW_DOT = 'previewDot';

const Overlay = ({ ctx, hover, gesture }: OverlayProps<EdgePreviewHit, never>) => {
  if (gesture !== null || hover === null || ctx.options[SHOW_PREVIEW_DOT] !== true) {
    return null;
  }
  return (
    <Group listening={false}>
      <Circle
        x={hover.point.x * ctx.gridSize}
        y={hover.point.y * ctx.gridSize}
        radius={3 / ctx.scale}
        fill={ACCENT}
        opacity={0.6}
      />
    </Group>
  );
};

export const variantB = defineVariant<EdgePreviewHit, never>({
  key: 'B',
  name: '辺のダブルクリックで挿入',
  summary:
    '辺をダブルクリックすると、その位置に最も近いグリッド点へ頂点を挿入する。挿入後は #50 の頂点ドラッグで動かす。常設のハンドルは増えない。',
  tryThis: [
    '矩形の辺をダブルクリック → 頂点マーカーが出て #44 のハンドルが消える（矩形ではなくなる）',
    '挿入直後の頂点は辺の上（直線上）にある。動かさないと何のための頂点か分かるか',
    '#62 前の本体では図形のダブルクリック＝セル編集、グループのダブルクリック＝構成図形の選択と競合する',
    'オプション「hover で挿入位置を予告」を付けると発見しやすくなるか',
  ],
  options: [{ key: SHOW_PREVIEW_DOT, label: 'hover で挿入位置を予告する（点を表示）', defaultValue: false }],
  ownsEdgeDrag: false,
  passive: true,
  hitTest: (ctx) => {
    if (vertexAtPoint(ctx.polygon, ctx.point, ctx.hitRadius) !== null) {
      return null;
    }
    const edge = edgeAtPoint(ctx.polygon, ctx.point, ctx.hitRadius);
    if (edge === null) {
      return null;
    }
    const [a, b] = edgeEndpoints(ctx.polygon, edge);
    const nearest = nearestInteriorGridPoint(a, b, ctx.point);
    return nearest === null ? null : { edge, point: nearest.point };
  },
  cursorFor: () => 'default',
  startGesture: () => null,
  moveGesture: () => {
    throw new Error('variant B has no gesture');
  },
  endGesture: () => {
    throw new Error('variant B has no gesture');
  },
  doubleClickEdge: (ctx, edge) => {
    const [a, b] = edgeEndpoints(ctx.polygon, edge);
    const nearest = nearestInteriorGridPoint(a, b, ctx.point);
    if (nearest === null) {
      return { polygon: null, message: 'この辺には挿入できるグリッド点がない（長さ 1）' };
    }
    const polygon = withVertexInserted(ctx.polygon, edge, nearest.point);
    const validation = validatePolygon(polygon);
    if (!validation.ok) {
      return { polygon: null, message: `拒否: ${validation.reason ?? ''}` };
    }
    return {
      polygon,
      message: `ダブルクリックで (${nearest.point.x},${nearest.point.y}) に頂点を挿入（辺上のまま）`,
    };
  },
  Overlay,
});
