/* eslint-disable react-refresh/only-export-components -- prototype: the variant object carries its own overlay component */
/**
 * PROTOTYPE (issue #63) — 案 C: 辺ドラッグで自動分割（押し出し）。
 * 辺の途中を掴んでドラッグすると、掴んだ 1 セル分の区間に頂点が 2 つ生まれ、
 * その区間だけが法線方向へ押し出される（外向き＝結合、内向き＝くり抜き）。
 * 辺に沿ってドラッグすると区間が広がるので、矩形の一辺を端まで引っ張ると L 字になる。
 * ポリゴン論理演算（editor-core の engine）で実現しているため、#62 の結合・くり抜きと同じ土台。
 */
import { Group } from 'react-konva';
import type { GridPoint, GridPolygon } from '@gridder/editor-core';
import {
  edgeAtPoint,
  isAxisAlignedPolygonEdge,
  vertexAtPoint,
  type PolygonEdgeRef,
} from '@/features/editor';
import {
  edgeEndpoints,
  edgeSteps,
  outwardNormal,
  pointAtStep,
  pushEdgeSpan,
  snapPoint,
  stepParameter,
} from '../geometry';
import { EdgeHighlight, GhostRect } from '../overlayParts';
import { defineVariant, type GesturePreview, type OverlayProps } from '../types';

interface SpanHit {
  readonly edge: PolygonEdgeRef;
  /** Index of the grabbed cell along the edge: [step, step + 1]. */
  readonly step: number;
  readonly a: GridPoint;
  readonly b: GridPoint;
}

interface PushGesture extends SpanHit, GridPolygon {
  readonly steps: number;
  readonly normal: GridPoint;
}

const spanOf = (gesture: PushGesture, point: GridPoint): readonly [number, number] => {
  const { a, b, step, steps } = gesture;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // Unclamped projection (in steps; an axis-aligned edge has 1 step per cell).
  const s = Math.round((((point.x - a.x) * dx + (point.y - a.y) * dy) / length / length) * steps);
  if (s > step) {
    return [step, Math.min(s, steps)];
  }
  return [Math.max(s, 0), step + 1];
};

const depthOf = (gesture: PushGesture, point: GridPoint): number => {
  const { a, normal } = gesture;
  return Math.round((point.x - a.x) * normal.x + (point.y - a.y) * normal.y);
};

const previewOf = (gesture: PushGesture, rawPoint: GridPoint): GesturePreview => {
  const point = snapPoint(rawPoint);
  const [start, end] = spanOf(gesture, point);
  const depth = depthOf(gesture, point);
  const result = pushEdgeSpan(gesture, gesture.edge, start, end, depth);
  const ghostKind = depth < 0 ? 'cut' : 'add';
  if (result.polygon === null) {
    return {
      polygon: gesture,
      ghostRect: result.rect,
      ghostKind,
      message: result.reason === undefined ? undefined : `拒否: ${result.reason}`,
    };
  }
  return {
    polygon: result.polygon,
    ghostRect: result.rect,
    ghostKind,
    message:
      depth === 0
        ? '辺に沿った移動だけでは変化しない（法線方向へ引く）'
        : `${depth > 0 ? '押し出し' : 'くり抜き'}: 区間 ${start}〜${end}、深さ ${Math.abs(depth)}`,
  };
};

const Overlay = ({ ctx, hover, gesture, preview }: OverlayProps<SpanHit, PushGesture>) => {
  if (gesture !== null) {
    const rect = preview?.ghostRect ?? null;
    return rect === null ? null : (
      <GhostRect ring={rect} gridSize={ctx.gridSize} subtract={preview?.ghostKind === 'cut'} />
    );
  }
  if (hover === null) {
    return null;
  }
  return (
    <Group listening={false}>
      <EdgeHighlight
        a={pointAtStep(hover.a, hover.b, hover.step)}
        b={pointAtStep(hover.a, hover.b, hover.step + 1)}
        gridSize={ctx.gridSize}
        widthScreen={6}
      />
    </Group>
  );
};

export const variantC = defineVariant<SpanHit, PushGesture>({
  key: 'C',
  name: '辺ドラッグで自動分割（押し出し）',
  summary:
    '辺の途中を掴んで引くと、掴んだ 1 セル区間に頂点が 2 つ生まれてその区間だけが押し出される。辺に沿って引くと区間が広がり、端まで引くと L 字になる。内向きに引くとくり抜き。#50 の「辺の平行移動」は矩形の #44 ハンドルにだけ残る。',
  tryThis: [
    '矩形の下辺の右寄りを掴んで斜め下へ → 区間が広がる。右端まで引くと L 字になるか',
    '真下へだけ引く → 1 セル幅の出っ張り。これが期待どおりか',
    '内向きに引く → くり抜き。図形が 2 つに分かれる操作は拒否される',
    'L 字で: #50 の頂点ドラッグと辺の押し出しの境界がカーソルで分かるか（頂点=move、辺=crosshair）',
    '斜辺は押し出し不可（#50 の辺移動にフォールバック）',
  ],
  options: [],
  ownsEdgeDrag: true,
  hitTest: (ctx) => {
    if (vertexAtPoint(ctx.polygon, ctx.point, ctx.hitRadius) !== null) {
      return null;
    }
    const edge = edgeAtPoint(ctx.polygon, ctx.point, ctx.hitRadius);
    if (edge === null || !isAxisAlignedPolygonEdge(ctx.polygon, edge)) {
      return null;
    }
    const [a, b] = edgeEndpoints(ctx.polygon, edge);
    const steps = edgeSteps(a, b);
    const step = Math.min(steps - 1, Math.max(0, Math.floor(stepParameter(a, b, ctx.point))));
    return { edge, step, a, b };
  },
  cursorFor: () => 'crosshair',
  startGesture: (ctx, hit) => ({
    ...hit,
    ...ctx.polygon,
    steps: edgeSteps(hit.a, hit.b),
    normal: outwardNormal(ctx.polygon, hit.edge),
  }),
  moveGesture: (gesture, ctx) => previewOf(gesture, ctx.point),
  endGesture: (gesture, ctx) => {
    const preview = previewOf(gesture, ctx.point);
    if (preview.polygon === gesture || preview.polygon.outerRing === gesture.outerRing) {
      return { polygon: null, message: preview.message ?? '変更なし' };
    }
    return { polygon: preview.polygon, message: preview.message ?? '押し出しを確定' };
  },
  Overlay,
});
