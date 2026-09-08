/* eslint-disable react-refresh/only-export-components -- prototype: the variant object carries its own overlay component */
/**
 * PROTOTYPE (issue #63) — 案 D（追加案）: 辺ホバーでゴースト頂点。
 * 常設ハンドルは増やさず、辺の上でポインターがグリッド点の近くに来たときだけ
 * 「まだ無い頂点」を破線の丸＋「+」で予告する。そこからドラッグすると
 * 頂点が挿入されてそのまま動く（案 A と同じ 1 段階の操作）。グリッド点から
 * 離れた辺上は #50 の辺移動のまま。
 */
import type { GridPoint } from '@gridder/editor-core';
import { edgeAtPoint, vertexAtPoint, type PolygonEdgeRef } from '@/features/editor';
import { edgeEndpoints, nearestInteriorGridPoint } from '../geometry';
import { endInsertDrag, moveInsertDrag, startInsertDrag, type InsertDragGesture } from '../insertDrag';
import { GhostVertex } from '../overlayParts';
import { defineVariant, type OverlayProps } from '../types';

interface GhostHit {
  readonly edge: PolygonEdgeRef;
  readonly point: GridPoint;
}

const ALWAYS = 'always';
const ALT_ONLY = 'altOnly';
const KEEP_ON_CLICK = 'keepOnClick';
/** Screen-pixel radius around a grid point on the edge where the ghost appears. */
const GHOST_SNAP_PX = 9;

const Overlay = ({ ctx, hover, gesture }: OverlayProps<GhostHit, InsertDragGesture>) => {
  if (gesture !== null || hover === null) {
    return null;
  }
  return <GhostVertex point={hover.point} gridSize={ctx.gridSize} scale={ctx.scale} armed />;
};

export const variantD = defineVariant<GhostHit, InsertDragGesture>({
  key: 'D',
  name: '辺ホバーでゴースト頂点（追加案）',
  summary:
    '常設ハンドルを増やさない。辺上でポインターがグリッド点に近づいたときだけ、破線の丸＋「+」で「まだ無い頂点」を予告する。そこからドラッグすると挿入と移動が 1 回で終わる。グリッド点から離れた辺上は #50 の辺移動のまま。',
  tryThis: [
    '矩形の辺をなぞる → グリッド点ごとにゴーストが現れ、その間は ew/ns-resize カーソル（辺移動）になる。切り替わりが分かるか',
    'ゴーストからドラッグ → 頂点が挿入されて移動（1 段階）',
    'ゴーストをクリックだけ → 辺上に頂点が残る。続けて #50 の辺移動で片側の半辺を引くと L 字（2 段階）',
    'ズームアウト（ホイール）してグリッドが詰まると、辺のほぼ全域がゴーストになる。辺移動ができなくなるか',
    'オプション「Alt 押下時だけ」でモディファイア方式に切り替えて比較する',
    'オプション「辺上ならどこでも」で辺移動を諦めた場合の単純さを比較する',
  ],
  options: [
    { key: KEEP_ON_CLICK, label: 'クリックだけ（動かさない）でも頂点を残す', defaultValue: true },
    { key: ALWAYS, label: '辺上ならどこでもゴーストを出す（辺移動を諦める）', defaultValue: false },
    { key: ALT_ONLY, label: 'Alt 押下時だけゴーストを出す', defaultValue: false },
  ],
  ownsEdgeDrag: false,
  hitTest: (ctx) => {
    if (ctx.options[ALT_ONLY] === true && !ctx.altKey) {
      return null;
    }
    if (vertexAtPoint(ctx.polygon, ctx.point, ctx.hitRadius) !== null) {
      return null;
    }
    const edge = edgeAtPoint(ctx.polygon, ctx.point, ctx.hitRadius);
    if (edge === null) {
      return null;
    }
    const [a, b] = edgeEndpoints(ctx.polygon, edge);
    const nearest = nearestInteriorGridPoint(a, b, ctx.point);
    if (nearest === null) {
      return null;
    }
    const distance = Math.hypot(ctx.point.x - nearest.point.x, ctx.point.y - nearest.point.y);
    if (ctx.options[ALWAYS] !== true && distance > ctx.pxToGrid(GHOST_SNAP_PX)) {
      return null;
    }
    return { edge, point: nearest.point };
  },
  cursorFor: () => 'copy',
  startGesture: (ctx, hit) => startInsertDrag(ctx, hit.edge, hit.point),
  moveGesture: moveInsertDrag,
  endGesture: (gesture, ctx) => endInsertDrag(gesture, ctx, ctx.options[KEEP_ON_CLICK] === true),
  Overlay,
});
