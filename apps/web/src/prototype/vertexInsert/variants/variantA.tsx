/* eslint-disable react-refresh/only-export-components -- prototype: the variant object carries its own overlay component */
/**
 * PROTOTYPE (issue #63) — 案 A: 辺の中点ハンドル。
 * 各辺の中点（に最も近いグリッド点）にひし形ハンドルを常時表示し、
 * ドラッグすると新しい頂点が生まれてそこから 2 辺に分かれる。
 */
import { Group } from 'react-konva';
import type { GridPoint } from '@gridder/editor-core';
import type { PolygonEdgeRef } from '@/features/editor';
import { allRingRefs, midpointGridPoint, pointAtStep, edgeSteps } from '../geometry';
import { endInsertDrag, moveInsertDrag, startInsertDrag, type InsertDragGesture } from '../insertDrag';
import { DiamondHandle } from '../overlayParts';
import { defineVariant, type HitContext, type OverlayContext, type OverlayProps } from '../types';

interface MidpointHit {
  readonly edge: PolygonEdgeRef;
  readonly point: GridPoint;
}

const OFFSET_ON_RECT = 'offsetOnRect';

/** Handle positions for every edge: the midpoint, or (option) the 1/4 point on a rectangle so it clears #44's edge handle. */
const handlePoints = (
  polygon: HitContext['polygon'],
  isRect: boolean,
  options: HitContext['options']
): readonly MidpointHit[] => {
  const hits: MidpointHit[] = [];
  for (const [ringRef, ring] of allRingRefs(polygon)) {
    ring.forEach((a, edgeIndex) => {
      const b = ring[(edgeIndex + 1) % ring.length] ?? a;
      const steps = edgeSteps(a, b);
      const useQuarter = isRect && options[OFFSET_ON_RECT] === true && steps >= 4;
      const point = useQuarter ? pointAtStep(a, b, Math.floor(steps / 4)) : midpointGridPoint(a, b);
      if (point !== null) {
        hits.push({ edge: { ring: ringRef, edgeIndex }, point });
      }
    });
  }
  return hits;
};

const Overlay = ({ ctx, hover, gesture }: OverlayProps<MidpointHit, InsertDragGesture>) => {
  if (gesture !== null) {
    return null;
  }
  const overlayCtx: OverlayContext = ctx;
  return (
    <Group listening={false}>
      {handlePoints(overlayCtx.polygon, overlayCtx.isRect, overlayCtx.options).map((h) => (
        <DiamondHandle
          key={`${h.edge.ring.kind}-${h.edge.ring.kind === 'inner' ? h.edge.ring.holeIndex : 0}-${h.edge.edgeIndex}`}
          point={h.point}
          gridSize={overlayCtx.gridSize}
          scale={overlayCtx.scale}
          hovered={hover !== null && hover.point.x === h.point.x && hover.point.y === h.point.y}
        />
      ))}
    </Group>
  );
};

export const variantA = defineVariant<MidpointHit, InsertDragGesture>({
  key: 'A',
  name: '辺の中点ハンドル',
  summary:
    '各辺の中点にひし形ハンドルを常時表示する。ドラッグで頂点が挿入され、そのまま移動する。多くのベクター編集ツールと同じ。',
  tryThis: [
    '矩形で: 中点ハンドルと #44 の辺ハンドルが同じ場所に重なる。どちらを掴めるか、見分けがつくか',
    'オプション「矩形では 1/4 点に置く」で重なりを避けた場合の見え方',
    'L 字で: #50 の頂点マーカー（丸）とひし形が並ぶ。1 セル辺（ハンドルなし）はどう見えるか',
    '斜辺で: 中点がグリッド上にないときの位置',
  ],
  options: [{ key: OFFSET_ON_RECT, label: '矩形では 1/4 点に置く', defaultValue: false }],
  ownsEdgeDrag: false,
  hitTest: (ctx) => {
    let best: MidpointHit | null = null;
    let bestDistance = ctx.pxToGrid(10);
    for (const h of handlePoints(ctx.polygon, ctx.isRect, ctx.options)) {
      const d = Math.hypot(ctx.point.x - h.point.x, ctx.point.y - h.point.y);
      if (d <= bestDistance) {
        bestDistance = d;
        best = h;
      }
    }
    return best;
  },
  cursorFor: () => 'copy',
  startGesture: (ctx, hit) => startInsertDrag(ctx, hit.edge, hit.point),
  moveGesture: moveInsertDrag,
  endGesture: endInsertDrag,
  Overlay,
});
