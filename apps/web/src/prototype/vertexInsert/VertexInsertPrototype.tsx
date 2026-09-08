/**
 * PROTOTYPE (issue #63) — host page.
 *
 * Four variants of "add a vertex to an existing shape", switchable via
 * `?variant=A|B|C|D` and the floating bottom bar, on a standalone Konva stage
 * with one shape, a grid, wheel zoom and Space/middle-button pan. The base
 * interactions of the product (#44 rectangle resize handles, #50 vertex and
 * edge drag, body move) are reproduced here so each variant can be judged
 * *next to* them (ui-principles §2 / §8), not in a vacuum.
 *
 * Deliberately not production code: React state is updated on every pointer
 * move (ADR-0005 forbids this in the product), there is no Command / history
 * layer beyond a plain undo stack, and no tests. Delete with this folder.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { Group, Layer, Shape, Stage } from 'react-konva';
import type Konva from 'konva';
import type { GridPoint, GridPolygon, GridRing } from '@gridder/editor-core';
import {
  edgeAtPoint,
  isAxisAlignedPolygonEdge,
  isAxisAlignedRect,
  isPointInPolygon,
  polygonBounds,
  resizeCursorForHandle,
  resizeHandleAtPoint,
  resizeRectBounds,
  ringFromRect,
  vertexAtPoint,
  withEdgeMoved,
  withVertexMoved,
  type PolygonEdgeRef,
  type PolygonVertexRef,
  type ResizeHandleKind,
} from '@/features/editor';
import { edgeEndpoints, formatRing, polygonArea, snapPoint, validatePolygon } from './geometry';
import {
  EdgeHighlight,
  ResizeHandles,
  SelectionFrame,
  ShapeFill,
  VertexMarkers,
} from './overlayParts';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import type { AnyVariant, GesturePreview, HitContext, OverlayContext, VariantOptions } from './types';
import { VARIANTS } from './variants';

const GRID_SIZE = 32;
const HANDLE_HIT_PX = 10;
const EDGE_HIT_PX = 7;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface Preset {
  readonly key: string;
  readonly label: string;
  readonly polygon: GridPolygon;
}

const rect = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const PRESETS: readonly Preset[] = [
  { key: 'rect', label: '矩形 8×5', polygon: { outerRing: rect(0, 0, 8, 5), innerRings: [] } },
  {
    key: 'l',
    label: 'L 字',
    polygon: {
      outerRing: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    },
  },
  {
    key: 'hole',
    label: '穴あき',
    polygon: { outerRing: rect(0, 0, 8, 6), innerRings: [[...rect(2, 2, 3, 2)].reverse()] },
  },
  {
    key: 'diag',
    label: '斜辺あり',
    polygon: {
      outerRing: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 4, y: 7 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Base (#44 / #50 / move) hit-test and gestures
// ---------------------------------------------------------------------------

type BaseHit =
  | { readonly kind: 'resize'; readonly handle: ResizeHandleKind }
  | { readonly kind: 'vertex'; readonly ref: PolygonVertexRef; readonly point: GridPoint }
  | { readonly kind: 'edge'; readonly ref: PolygonEdgeRef }
  | { readonly kind: 'body' };

type BaseGesture =
  | { readonly kind: 'resize'; readonly handle: ResizeHandleKind }
  | { readonly kind: 'vertex'; readonly ref: PolygonVertexRef }
  | { readonly kind: 'edge'; readonly ref: PolygonEdgeRef; readonly start: GridPoint }
  | { readonly kind: 'move'; readonly start: GridPoint };

type Gesture =
  | { readonly kind: 'variant'; readonly gesture: unknown }
  | { readonly kind: 'base'; readonly gesture: BaseGesture }
  | { readonly kind: 'pan'; readonly startClient: GridPoint; readonly startView: GridPoint };

interface BaseHitOptions {
  readonly resizeHandles: boolean;
  readonly vertexMarkers: boolean;
  readonly edgeDrag: boolean;
}

const baseHitTest = (ctx: HitContext, options: BaseHitOptions): BaseHit | null => {
  const { polygon, point } = ctx;
  if (options.resizeHandles) {
    const handle = resizeHandleAtPoint(polygonBounds(polygon), point, ctx.pxToGrid(HANDLE_HIT_PX));
    if (handle !== null) {
      return { kind: 'resize', handle };
    }
  }
  if (options.vertexMarkers) {
    const ref = vertexAtPoint(polygon, point, ctx.pxToGrid(HANDLE_HIT_PX));
    if (ref !== null) {
      const ring = ref.ring.kind === 'outer' ? polygon.outerRing : polygon.innerRings[ref.ring.holeIndex];
      const vertex = ring?.[ref.vertexIndex];
      if (vertex !== undefined) {
        return { kind: 'vertex', ref, point: vertex };
      }
    }
    if (options.edgeDrag) {
      const ref = edgeAtPoint(polygon, point, ctx.pxToGrid(EDGE_HIT_PX));
      if (ref !== null) {
        return { kind: 'edge', ref };
      }
    }
  }
  if (isPointInPolygon(point, polygon)) {
    return { kind: 'body' };
  }
  return null;
};

const baseCursor = (hit: BaseHit | null, polygon: GridPolygon): string => {
  if (hit === null) {
    return 'default';
  }
  switch (hit.kind) {
    case 'resize':
      return `${resizeCursorForHandle(hit.handle)}-resize`;
    case 'vertex':
      return 'move';
    case 'edge': {
      if (!isAxisAlignedPolygonEdge(polygon, hit.ref)) {
        return 'move';
      }
      const [a, b] = edgeEndpoints(polygon, hit.ref);
      return a.y === b.y ? 'ns-resize' : 'ew-resize';
    }
    case 'body':
      return 'grab';
  }
};

const translate = (polygon: GridPolygon, delta: GridPoint): GridPolygon => ({
  outerRing: polygon.outerRing.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
  innerRings: polygon.innerRings.map((ring) =>
    ring.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }))
  ),
});

const baseGesturePreview = (
  gesture: BaseGesture,
  polygon: GridPolygon,
  point: GridPoint
): GridPolygon => {
  const snapped = snapPoint(point);
  switch (gesture.kind) {
    case 'resize':
      return {
        outerRing: ringFromRect(resizeRectBounds(polygonBounds(polygon), gesture.handle, snapped)),
        innerRings: [],
      };
    case 'vertex':
      return withVertexMoved(polygon, gesture.ref, snapped);
    case 'edge':
      return withEdgeMoved(polygon, gesture.ref, {
        x: snapped.x - gesture.start.x,
        y: snapped.y - gesture.start.y,
      });
    case 'move':
      return translate(polygon, { x: snapped.x - gesture.start.x, y: snapped.y - gesture.start.y });
  }
};

const BASE_GESTURE_LABEL: Record<BaseGesture['kind'], string> = {
  resize: '#44 矩形リサイズ',
  vertex: '#50 頂点移動',
  edge: '#50 辺移動',
  move: '移動',
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const readVariantIndex = (): number => {
  const key = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  const index = VARIANTS.findIndex((v) => v.key === key);
  return index === -1 ? 0 : index;
};

const writeVariantKey = (key: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  window.history.replaceState(null, '', url);
};

const defaultOptions = (variant: AnyVariant): VariantOptions =>
  Object.fromEntries(variant.options.map((o) => [o.key, o.defaultValue]));

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const VertexInsertPrototype = () => {
  const [variantIndex, setVariantIndex] = useState(readVariantIndex);
  const variant = VARIANTS[variantIndex] ?? VARIANTS[0];
  if (variant === undefined) {
    throw new Error('no variants');
  }

  const [optionsByVariant, setOptionsByVariant] = useState<Record<string, VariantOptions>>(() =>
    Object.fromEntries(VARIANTS.map((v) => [v.key, defaultOptions(v)]))
  );
  const options = optionsByVariant[variant.key] ?? defaultOptions(variant);

  const [showResizeHandles, setShowResizeHandles] = useState(true);
  const [showVertexMarkers, setShowVertexMarkers] = useState(true);
  const [markersOnRect, setMarkersOnRect] = useState(false);

  const [doc, setDoc] = useState<{
    readonly polygon: GridPolygon;
    readonly history: readonly GridPolygon[];
  }>({ polygon: PRESETS[0]?.polygon ?? { outerRing: [], innerRings: [] }, history: [] });
  const { polygon, history } = doc;
  const [log, setLog] = useState<readonly string[]>(['矩形 8×5 を読み込み']);

  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [hover, setHover] = useState<{ variant: unknown; base: BaseHit | null }>({
    variant: null,
    base: null,
  });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [preview, setPreview] = useState<GesturePreview | null>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  const isRect = isAxisAlignedRect(polygon);
  const displayPolygon = preview?.polygon ?? polygon;
  const displayIsRect = isAxisAlignedRect(displayPolygon);

  const pushLog = useCallback((message: string) => {
    setLog((entries) => [message, ...entries].slice(0, 10));
  }, []);

  const commit = useCallback(
    (next: GridPolygon, message: string) => {
      setDoc((d) => ({ polygon: next, history: [...d.history, d.polygon] }));
      pushLog(message);
    },
    [pushLog]
  );

  const undo = useCallback(() => {
    setDoc((d) => {
      const last = d.history[d.history.length - 1];
      return last === undefined ? d : { polygon: last, history: d.history.slice(0, -1) };
    });
    pushLog('Undo');
  }, [pushLog]);

  const loadPreset = (preset: Preset) => {
    setDoc({ polygon: preset.polygon, history: [] });
    setPreview(null);
    setGesture(null);
    pushLog(`${preset.label} を読み込み`);
  };

  // Container size + initial centring.
  useEffect(() => {
    const el = containerRef.current;
    if (el === null) {
      return;
    }
    const apply = () => {
      const rectangle = el.getBoundingClientRect();
      setSize({ width: rectangle.width, height: rectangle.height });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const centreView = useCallback(() => {
    setView({ scale: 1, x: size.width / 2 - 4 * GRID_SIZE, y: size.height / 2 - 3 * GRID_SIZE });
  }, [size]);

  const hasCentred = useRef(false);
  useEffect(() => {
    if (!hasCentred.current && size.width > 0) {
      hasCentred.current = true;
      centreView();
    }
  }, [size, centreView]);

  // Keyboard: Space = pan, Cmd/Ctrl+Z = undo, Esc = cancel gesture.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        setIsSpaceDown(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key === 'Escape') {
        setGesture(null);
        setPreview(null);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [undo]);

  // Pointer → grid coordinates.
  const toGrid = useCallback(
    (event: { clientX: number; clientY: number }): GridPoint => {
      const el = containerRef.current;
      const bounds = el?.getBoundingClientRect() ?? { left: 0, top: 0 };
      return {
        x: (event.clientX - bounds.left - view.x) / view.scale / GRID_SIZE,
        y: (event.clientY - bounds.top - view.y) / view.scale / GRID_SIZE,
      };
    },
    [view]
  );

  const makeCtx = useCallback(
    (point: GridPoint, altKey: boolean): HitContext => ({
      polygon,
      point,
      hitRadius: HANDLE_HIT_PX / view.scale / GRID_SIZE,
      pxToGrid: (px) => px / view.scale / GRID_SIZE,
      isRect,
      options,
      altKey,
    }),
    [polygon, view.scale, isRect, options]
  );

  const baseOptions: BaseHitOptions = {
    resizeHandles: isRect && showResizeHandles,
    vertexMarkers: showVertexMarkers && (!isRect || markersOnRect),
    edgeDrag: !variant.ownsEdgeDrag,
  };

  const resolveHits = useCallback(
    (ctx: HitContext): { variant: unknown; base: BaseHit | null } => {
      // Product priority: a #44 resize handle wins over anything on the same spot.
      const resize = baseHitTest(ctx, { ...baseOptions, vertexMarkers: false });
      if (resize?.kind === 'resize') {
        return { variant: null, base: resize };
      }
      const variantHit = variant.hitTest(ctx);
      // A variant that owns edge drags (C) still leaves edges it declined (diagonals) to #50.
      const base = baseHitTest(ctx, {
        ...baseOptions,
        resizeHandles: false,
        edgeDrag: baseOptions.edgeDrag || variantHit === null,
      });
      return { variant: variantHit, base };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseOptions is rebuilt each render; the three flags are the real deps.
    [variant, baseOptions.resizeHandles, baseOptions.vertexMarkers, baseOptions.edgeDrag]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || (event.button === 0 && isSpaceDown)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGesture({
        kind: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        startView: { x: view.x, y: view.y },
      });
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const ctx = makeCtx(toGrid(event), event.altKey);
    const hits = resolveHits(ctx);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (hits.variant !== null && variant.passive !== true) {
      const g = variant.startGesture(ctx, hits.variant);
      if (g !== null) {
        setGesture({ kind: 'variant', gesture: g });
        setPreview(variant.moveGesture(g, ctx));
        return;
      }
    }
    if (hits.base === null) {
      return;
    }
    const snapped = snapPoint(ctx.point);
    const base: BaseGesture =
      hits.base.kind === 'resize'
        ? { kind: 'resize', handle: hits.base.handle }
        : hits.base.kind === 'vertex'
          ? { kind: 'vertex', ref: hits.base.ref }
          : hits.base.kind === 'edge'
            ? { kind: 'edge', ref: hits.base.ref, start: snapped }
            : { kind: 'move', start: snapped };
    setGesture({ kind: 'base', gesture: base });
    setPreview({ polygon: baseGesturePreview(base, polygon, ctx.point) });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture?.kind === 'pan') {
      setView((v) => ({
        ...v,
        x: gesture.startView.x + (event.clientX - gesture.startClient.x),
        y: gesture.startView.y + (event.clientY - gesture.startClient.y),
      }));
      return;
    }
    const ctx = makeCtx(toGrid(event), event.altKey);
    if (gesture === null) {
      setHover(resolveHits(ctx));
      return;
    }
    if (gesture.kind === 'variant') {
      setPreview(variant.moveGesture(gesture.gesture, ctx));
    } else {
      setPreview({ polygon: baseGesturePreview(gesture.gesture, polygon, ctx.point) });
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    setGesture(null);
    setPreview(null);
    if (gesture.kind === 'pan') {
      return;
    }
    const ctx = makeCtx(toGrid(event), event.altKey);
    if (gesture.kind === 'variant') {
      const result = variant.endGesture(gesture.gesture, ctx);
      if (result.polygon === null) {
        pushLog(`[${variant.key}] ${result.message}`);
      } else {
        commit(result.polygon, `[${variant.key}] ${result.message}`);
      }
      return;
    }
    const next = baseGesturePreview(gesture.gesture, polygon, ctx.point);
    if (next === polygon || JSON.stringify(next) === JSON.stringify(polygon)) {
      return;
    }
    const validation = validatePolygon(next);
    if (!validation.ok) {
      pushLog(`${BASE_GESTURE_LABEL[gesture.gesture.kind]} を拒否: ${validation.reason ?? ''}`);
      return;
    }
    commit(next, BASE_GESTURE_LABEL[gesture.gesture.kind]);
  };

  const handleDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (variant.doubleClickEdge === undefined) {
      return;
    }
    const ctx = makeCtx(toGrid(event), event.altKey);
    if (vertexAtPoint(polygon, ctx.point, ctx.hitRadius) !== null) {
      return;
    }
    const edge = edgeAtPoint(polygon, ctx.point, ctx.pxToGrid(EDGE_HIT_PX));
    if (edge === null) {
      return;
    }
    const result = variant.doubleClickEdge(ctx, edge);
    if (result === null) {
      return;
    }
    if (result.polygon === null) {
      pushLog(`[${variant.key}] ${result.message}`);
    } else {
      commit(result.polygon, `[${variant.key}] ${result.message}`);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (el === null) {
      return;
    }
    const bounds = el.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    setView((v) => {
      const factor = Math.exp(-event.deltaY * 0.0015);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const ratio = scale / v.scale;
      return { scale, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  };

  // Cursor.
  const cursor = (() => {
    if (gesture?.kind === 'pan' || isSpaceDown) {
      return gesture?.kind === 'pan' ? 'grabbing' : 'grab';
    }
    if (gesture?.kind === 'base') {
      return gesture.gesture.kind === 'move'
        ? 'grabbing'
        : baseCursor(
            gesture.gesture.kind === 'resize'
              ? { kind: 'resize', handle: gesture.gesture.handle }
              : gesture.gesture.kind === 'vertex'
                ? { kind: 'vertex', ref: gesture.gesture.ref, point: { x: 0, y: 0 } }
                : { kind: 'edge', ref: gesture.gesture.ref },
            polygon
          );
    }
    if (gesture?.kind === 'variant') {
      return hover.variant !== null ? variant.cursorFor(hover.variant) : 'default';
    }
    if (hover.variant !== null && variant.passive !== true) {
      return variant.cursorFor(hover.variant);
    }
    return baseCursor(hover.base, polygon);
  })();

  const overlayCtx: OverlayContext = {
    polygon: displayPolygon,
    gridSize: GRID_SIZE,
    scale: view.scale,
    isRect: displayIsRect,
    options,
    showResizeHandles,
    showVertexMarkers,
  };

  const hoveredEdge = useMemo(() => {
    if (gesture !== null || hover.base?.kind !== 'edge') {
      return null;
    }
    return edgeEndpoints(polygon, hover.base.ref);
  }, [gesture, hover, polygon]);

  const changeVariant = useCallback((index: number) => {
    const next = VARIANTS[index];
    if (next === undefined) {
      return;
    }
    setVariantIndex(index);
    writeVariantKey(next.key);
    setHover({ variant: null, base: null });
    setGesture(null);
    setPreview(null);
  }, []);

  const VariantOverlay = variant.Overlay;
  const showBaseVertexMarkers = showVertexMarkers && (!displayIsRect || markersOnRect);

  return (
    <div className="flex h-screen flex-col bg-canvas text-ui">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ui-border bg-surface px-4 text-sm">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          PROTOTYPE #63
        </span>
        <span className="font-medium">頂点追加操作の比較</span>
        <span className="mx-1 h-5 w-px bg-ui-border" />
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => loadPreset(preset)}
            className="whitespace-nowrap rounded border border-ui-border bg-surface px-2 py-1 text-xs hover:bg-surface-muted"
          >
            {preset.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-ui-border" />
        <label className="flex items-center gap-1 whitespace-nowrap text-xs">
          <input
            type="checkbox"
            checked={showResizeHandles}
            onChange={(e) => setShowResizeHandles(e.target.checked)}
          />
          #44 矩形ハンドル
        </label>
        <label className="flex items-center gap-1 whitespace-nowrap text-xs">
          <input
            type="checkbox"
            checked={showVertexMarkers}
            onChange={(e) => setShowVertexMarkers(e.target.checked)}
          />
          #50 頂点マーカー
        </label>
        <label className="flex items-center gap-1 whitespace-nowrap text-xs">
          <input
            type="checkbox"
            checked={markersOnRect}
            onChange={(e) => setMarkersOnRect(e.target.checked)}
          />
          矩形にも頂点マーカー
        </label>
        <span className="mx-1 h-5 w-px bg-ui-border" />
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          className="rounded border border-ui-border bg-surface px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-40"
        >
          Undo (⌘Z)
        </button>
        <button
          type="button"
          onClick={centreView}
          className="rounded border border-ui-border bg-surface px-2 py-1 text-xs hover:bg-surface-muted"
        >
          表示をリセット
        </button>
        <span className="ml-auto text-xs text-ui-muted">
          ズーム {Math.round(view.scale * 100)}% · ホイールでズーム · Space+ドラッグ / 中ボタンでパン
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (gesture === null) {
              setHover({ variant: null, base: null });
            }
          }}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Stage
            width={size.width}
            height={size.height}
            x={view.x}
            y={view.y}
            scaleX={view.scale}
            scaleY={view.scale}
            listening={false}
          >
            <Layer listening={false}>
              <GridLines view={view} size={size} />
            </Layer>
            <Layer listening={false}>
              <ShapeFill polygon={displayPolygon} gridSize={GRID_SIZE} scale={view.scale} />
            </Layer>
            <Layer listening={false}>
              <Group>
                <SelectionFrame polygon={displayPolygon} gridSize={GRID_SIZE} scale={view.scale} />
                {hoveredEdge !== null && (
                  <EdgeHighlight a={hoveredEdge[0]} b={hoveredEdge[1]} gridSize={GRID_SIZE} />
                )}
                {showResizeHandles && displayIsRect && (
                  <ResizeHandles
                    polygon={displayPolygon}
                    gridSize={GRID_SIZE}
                    scale={view.scale}
                    hovered={
                      gesture?.kind === 'base' && gesture.gesture.kind === 'resize'
                        ? gesture.gesture.handle
                        : hover.base?.kind === 'resize' && gesture === null
                          ? hover.base.handle
                          : null
                    }
                  />
                )}
                {showBaseVertexMarkers && (
                  <VertexMarkers
                    polygon={displayPolygon}
                    gridSize={GRID_SIZE}
                    scale={view.scale}
                    hovered={hover.base?.kind === 'vertex' && gesture === null ? hover.base.point : null}
                  />
                )}
                <VariantOverlay
                  ctx={overlayCtx}
                  hover={hover.variant}
                  gesture={gesture?.kind === 'variant' ? gesture.gesture : null}
                  preview={preview}
                />
              </Group>
            </Layer>
          </Stage>
          {preview?.message !== undefined && (
            <div className="pointer-events-none absolute left-3 top-3 rounded bg-gray-900/80 px-2 py-1 text-xs text-white">
              {preview.message}
            </div>
          )}
        </div>

        {/* Right panel */}
        <aside className="flex w-[22rem] shrink-0 flex-col overflow-y-auto border-l border-ui-border bg-surface text-sm">
          <section className="border-b border-ui-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
              案 {variant.key}
            </h2>
            <p className="mt-1 text-base font-medium">{variant.name}</p>
            <p className="mt-2 text-xs leading-relaxed text-ui-muted">{variant.summary}</p>
          </section>
          <section className="border-b border-ui-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted">試すこと</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              {variant.tryThis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          {variant.options.length > 0 && (
            <section className="border-b border-ui-border px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
                この案のオプション
              </h3>
              <div className="mt-2 space-y-1">
                {variant.options.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={options[opt.key] ?? opt.defaultValue}
                      onChange={(e) =>
                        setOptionsByVariant((all) => ({
                          ...all,
                          [variant.key]: { ...(all[variant.key] ?? {}), [opt.key]: e.target.checked },
                        }))
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </section>
          )}
          <section className="border-b border-ui-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted">状態</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-ui-muted">種別</dt>
              <dd>{isRect ? '矩形（#44 ハンドル）' : 'ポリゴン（#50 頂点編集）'}</dd>
              <dt className="text-ui-muted">頂点数</dt>
              <dd>
                {polygon.outerRing.length}
                {polygon.innerRings.length > 0 &&
                  ` + 穴 ${polygon.innerRings.map((r) => r.length).join(', ')}`}
              </dd>
              <dt className="text-ui-muted">面積</dt>
              <dd>{polygonArea(polygon)} セル</dd>
              <dt className="text-ui-muted">カーソル</dt>
              <dd className="font-mono">{cursor}</dd>
              <dt className="text-ui-muted">外周</dt>
              <dd className="break-all font-mono text-[11px] leading-snug">
                {formatRing(polygon.outerRing)}
              </dd>
              {polygon.innerRings.map((ring, i) => (
                <div key={i} className="contents">
                  <dt className="text-ui-muted">穴 {i}</dt>
                  <dd className="break-all font-mono text-[11px] leading-snug">{formatRing(ring)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted">ログ</h3>
            <ol className="mt-2 space-y-1 text-xs">
              {log.map((entry, i) => (
                <li key={`${i}-${entry}`} className={i === 0 ? '' : 'text-ui-muted'}>
                  {entry}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <PrototypeSwitcher
        keys={VARIANTS.map((v) => v.key)}
        labels={VARIANTS.map((v) => v.name)}
        current={variantIndex}
        onChange={changeVariant}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

interface GridLinesProps {
  readonly view: { readonly scale: number; readonly x: number; readonly y: number };
  readonly size: { readonly width: number; readonly height: number };
}

const GridLines = ({ view, size }: GridLinesProps) => {
  const startX = Math.floor(-view.x / view.scale / GRID_SIZE) - 1;
  const startY = Math.floor(-view.y / view.scale / GRID_SIZE) - 1;
  const endX = Math.ceil((size.width - view.x) / view.scale / GRID_SIZE) + 1;
  const endY = Math.ceil((size.height - view.y) / view.scale / GRID_SIZE) + 1;
  return (
    <Shape
      listening={false}
      sceneFunc={(context: Konva.Context) => {
        const ctx = context._context;
        ctx.lineWidth = 1 / view.scale;
        for (let x = startX; x <= endX; x += 1) {
          ctx.beginPath();
          ctx.strokeStyle = x % 5 === 0 ? '#cfd4d9' : '#e4e7eb';
          ctx.moveTo(x * GRID_SIZE, startY * GRID_SIZE);
          ctx.lineTo(x * GRID_SIZE, endY * GRID_SIZE);
          ctx.stroke();
        }
        for (let y = startY; y <= endY; y += 1) {
          ctx.beginPath();
          ctx.strokeStyle = y % 5 === 0 ? '#cfd4d9' : '#e4e7eb';
          ctx.moveTo(startX * GRID_SIZE, y * GRID_SIZE);
          ctx.lineTo(endX * GRID_SIZE, y * GRID_SIZE);
          ctx.stroke();
        }
      }}
    />
  );
};
