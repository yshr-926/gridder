import type { EditorDocument, GridPoint, GridPolygon } from '@gridder/editor-core';
import {
  edgeAtPoint,
  isAxisAlignedRect,
  polygonBounds,
  polygonEdgeAxis,
  rectFromPoints,
  resizeHandleAtPoint,
  resizeRectBounds,
  shapeAtPoint,
  shapesWithinRegion,
  vertexAtPoint,
  vertexInsertionAtPoint,
  withEdgeMoved,
  withVertexInserted,
  withVertexMoved,
  type EdgeAxis,
  type GridRect,
  type PolygonEdgeRef,
  type PolygonVertexRef,
  type ResizeHandleKind,
  type VertexInsertionHit,
} from './hitTest';

/**
 * Pointer arbitration for the polygon editor's normal state (spec §6.1, §6.2,
 * §6.3, issues #42, #43, #44, #48, #50, #64). One controller decides, from a
 * stream of pointer and keyboard events, whether the gesture is a
 * click-select, a Shift-toggle, a blank-drag rectangle, a Shift-drag
 * marquee, a shape-drag move, a handle-drag resize, a vertex/edge drag, a
 * ghost-vertex insert-and-drag, or a click-by-click polygon creation —
 * without adding tool modes for the direct-manipulation gestures. Polygon creation (spec §6.3 "一時的なポリゴン
 * 作成") is the one modal exception ui-principles §2 allows, entered
 * explicitly (`P` / the top-bar button) and exited via confirm or `Esc`.
 * Cell editing (the former `editingShape` state of issue #49) was retired by
 * issue #62 in favour of combining / subtracting whole shapes, which are
 * plain Commands on the selection and never pass through this reducer.
 *
 * It is a pure reducer: {@link reduceInteraction} takes the current
 * {@link InteractionState}, one {@link InteractionEvent}, the document, the
 * live selection, and a resize-handle hit radius, and returns the next state
 * plus at most one {@link InteractionEffect} for the caller to carry out
 * (mutate the document through a Command, change the selection). Panning is
 * not modelled here: while `#40`'s `useViewportPan` reports a pan in progress
 * the caller feeds no events to this controller.
 */

/** A pointer sample in both grid-vertex and grid-unit-float space. */
export interface PointerSample {
  /** Nearest grid vertex (integers), used for rectangle geometry. */
  readonly vertex: GridPoint;
  /** Exact position in grid units (floats), used for shape hit-testing. */
  readonly precise: GridPoint;
  /** Whether Shift was held for this event. */
  readonly shiftKey: boolean;
}

export type InteractionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pending';
      /** Where the pointer went down (grid vertex). */
      readonly originVertex: GridPoint;
      readonly originPrecise: GridPoint;
      readonly shiftKey: boolean;
      /** A shape hit at pointer-down, if any — decides click vs. drag intent. */
      readonly hitShapeId: string | null;
    }
  | {
      readonly kind: 'creatingRect';
      readonly originVertex: GridPoint;
      /** Live opposite corner (grid vertex). */
      readonly currentVertex: GridPoint;
    }
  | {
      readonly kind: 'marquee';
      readonly originPrecise: GridPoint;
      readonly currentPrecise: GridPoint;
    }
  | {
      readonly kind: 'moving';
      /** Where the drag started (grid vertex), the delta's zero point. */
      readonly originVertex: GridPoint;
      /** Every shape being dragged (issue #43: whole selection moves together). */
      readonly shapeIds: readonly string[];
      /** Live offset in whole grid units, applied to every shape's vertices. */
      readonly delta: GridPoint;
    }
  | {
      readonly kind: 'resizing';
      readonly shapeId: string;
      readonly handle: ResizeHandleKind;
      /** The rectangle's bounds at gesture start — the fixed reference edges. */
      readonly originBounds: GridRect;
      /** Live resized bounds, recomputed from the pointer each move. */
      readonly currentBounds: GridRect;
    }
  | {
      readonly kind: 'creatingPolygon';
      /** Grid vertices placed so far, in click order. */
      readonly vertices: readonly GridPoint[];
      /** Live pointer position (grid vertex), for the rubber-band preview edge. */
      readonly cursorVertex: GridPoint | null;
    }
  | {
      /**
       * Dragging one vertex (issue #50) — either an existing one, or a vertex
       * just inserted from a ghost (issue #64). For an insertion,
       * `originPolygon` already contains the new vertex at its edge position,
       * so "no net change" on pointer-up (a click that never moved) commits
       * nothing and the ghost leaves no vertex behind.
       */
      readonly kind: 'movingVertex';
      readonly shapeId: string;
      readonly vertex: PolygonVertexRef;
      /** The shape's polygon at gesture start — restored if the drag is cancelled or rejected. */
      readonly originPolygon: GridPolygon;
      /** Live polygon with only `vertex` moved to the pointer's grid vertex. */
      readonly currentPolygon: GridPolygon;
    }
  | {
      readonly kind: 'movingEdge';
      readonly shapeId: string;
      readonly edge: PolygonEdgeRef;
      /** Where the drag started (grid vertex), the delta's zero point. */
      readonly originVertex: GridPoint;
      /** The shape's polygon at gesture start — restored if the drag is cancelled or rejected. */
      readonly originPolygon: GridPolygon;
      /** Live polygon with both of `edge`'s endpoints translated by the drag delta. */
      readonly currentPolygon: GridPolygon;
    };

export type InteractionEvent =
  | { readonly type: 'pointerDown'; readonly sample: PointerSample }
  | { readonly type: 'pointerMove'; readonly sample: PointerSample }
  | { readonly type: 'pointerUp'; readonly sample: PointerSample }
  | { readonly type: 'pointerCancel' }
  /**
   * `P` or the top-bar button (issue #48, spec §6.3): enter polygon
   * creation. Only takes effect from `idle` — it never interrupts a drag
   * already in progress.
   */
  | { readonly type: 'startPolygon' }
  /** `Enter`, only meaningful while `creatingPolygon`. */
  | { readonly type: 'confirmPolygon' }
  /** `Esc`, only meaningful while `creatingPolygon`. */
  | { readonly type: 'cancelPolygon' };

export type InteractionEffect =
  | { readonly type: 'selectOnly'; readonly shapeId: string }
  | { readonly type: 'toggleSelection'; readonly shapeId: string }
  | { readonly type: 'setSelection'; readonly shapeIds: readonly string[] }
  | { readonly type: 'clearSelection' }
  | {
      readonly type: 'createRect';
      readonly start: GridPoint;
      readonly end: GridPoint;
    }
  | {
      readonly type: 'moveShapes';
      readonly shapeIds: readonly string[];
      /** Whole-grid-unit offset applied to every vertex of every shape. */
      readonly delta: GridPoint;
    }
  | {
      readonly type: 'resizeShape';
      readonly shapeId: string;
      /** Final rectangle bounds (already flip-normalised, min 1 cell). */
      readonly bounds: GridRect;
    }
  | {
      readonly type: 'createPolygon';
      /** Confirmed grid vertices, in click order (at least 3). */
      readonly vertices: readonly GridPoint[];
    }
  | {
      readonly type: 'updateShapeVertices';
      readonly shapeId: string;
      /**
       * Proposed replacement polygon. The caller must validate it (self-
       * intersection, zero area — spec §6.2 "自己交差や退化になる操作は確定時に
       * 拒否") before committing; a rejected edit is simply not applied, leaving
       * the shape at its pre-gesture geometry.
       */
      readonly polygon: GridPolygon;
    };

export interface InteractionResult {
  readonly state: InteractionState;
  readonly effect?: InteractionEffect;
}

/** Grid-vertex distance past which a pending pointer becomes a drag gesture. */
const DRAG_THRESHOLD_CELLS = 0.35;
/**
 * Grid-vertex distance within which a click during polygon creation
 * (issue #48) counts as clicking the start vertex again, closing the shape,
 * rather than placing a new vertex on top of it.
 */
const CLOSE_VERTEX_THRESHOLD_CELLS = 0.35;
/** Minimum vertex count spec §5/§48 requires before a polygon can confirm. */
const MIN_POLYGON_VERTICES = 3;

export const IDLE_STATE: InteractionState = { kind: 'idle' };

const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

const movedEnough = (from: GridPoint, to: GridPoint): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_THRESHOLD_CELLS;

/** Structural equality for two {@link GridRect} bounds (issue #44 resize). */
const boundsEqual = (a: GridRect, b: GridRect): boolean =>
  a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;

/** Whole-grid-unit offset from `origin` to `current` (issue #43 move delta). */
const gridDelta = (origin: GridPoint, current: GridPoint): GridPoint => ({
  x: current.x - origin.x,
  y: current.y - origin.y,
});

/**
 * The marquee / rectangle region currently being dragged, in grid units, or
 * `null` when no drag is in progress. The caller renders this as a Konva-only
 * preview; it never touches React document state.
 */
export const previewRegion = (state: InteractionState): GridRect | null => {
  if (state.kind === 'creatingRect') {
    return rectFromPoints(state.originVertex, state.currentVertex);
  }
  if (state.kind === 'marquee') {
    return rectFromPoints(state.originPrecise, state.currentPrecise);
  }
  return null;
};

/**
 * What a pointer-down at a given point would grab on the single selected
 * shape, before falling through to the shape body: a resize handle
 * (issue #44), an existing vertex (issue #50), a ghost vertex on an edge
 * (issue #64), or an edge (issue #50). Also what the idle hover cursor and
 * the ghost marker are driven by, so hover and press can never disagree.
 */
export type HandleTarget =
  | {
      readonly kind: 'resizeHandle';
      readonly shapeId: string;
      readonly handle: ResizeHandleKind;
      readonly bounds: GridRect;
    }
  | { readonly kind: 'vertex'; readonly shapeId: string; readonly vertex: PolygonVertexRef }
  | {
      readonly kind: 'insertVertex';
      readonly shapeId: string;
      readonly hit: VertexInsertionHit;
    }
  | {
      readonly kind: 'edge';
      readonly shapeId: string;
      readonly edge: PolygonEdgeRef;
      /** Orientation, for the hover cursor (`ns` for horizontal, `ew` for vertical, `move` for diagonal). */
      readonly axis: EdgeAxis;
    };

/**
 * Resolves the handle a pointer at `point` (grid units) is over, in the
 * priority order every gesture and hover shares (issue #63's comparison,
 * issue #64): resize handle > existing vertex > ghost vertex > edge.
 *
 * A single selected axis-aligned rectangle has resize handles and — when
 * `insertHitRadius` is not `null` — ghost vertices on its edges, but no
 * vertex / edge dragging (spec §6.2: rectangles resize by their handles). Any
 * other single selected shape has vertex, ghost and edge targets instead.
 * `insertHitRadius` is `null` when the caller has decided cells are drawn
 * too small on screen to offer ghosts (`vertexInsertHitRadiusPx`).
 */
export const handleTargetAt = (
  document: EditorDocument,
  selectedIds: readonly string[],
  point: GridPoint,
  handleHitRadius: number,
  insertHitRadius: number | null
): HandleTarget | null => {
  if (selectedIds.length !== 1) {
    return null;
  }
  const shape = document.shapes[selectedIds[0]];
  if (shape === undefined) {
    return null;
  }
  const { polygon } = shape;
  if (isAxisAlignedRect(polygon)) {
    const bounds = polygonBounds(polygon);
    const handle = resizeHandleAtPoint(bounds, point, handleHitRadius);
    if (handle !== null) {
      return { kind: 'resizeHandle', shapeId: shape.id, handle, bounds };
    }
    if (insertHitRadius !== null) {
      const hit = vertexInsertionAtPoint(polygon, point, handleHitRadius, insertHitRadius);
      if (hit !== null) {
        return { kind: 'insertVertex', shapeId: shape.id, hit };
      }
    }
    return null;
  }
  const vertex = vertexAtPoint(polygon, point, handleHitRadius);
  if (vertex !== null) {
    return { kind: 'vertex', shapeId: shape.id, vertex };
  }
  if (insertHitRadius !== null) {
    const hit = vertexInsertionAtPoint(polygon, point, handleHitRadius, insertHitRadius);
    if (hit !== null) {
      return { kind: 'insertVertex', shapeId: shape.id, hit };
    }
  }
  const edge = edgeAtPoint(polygon, point, handleHitRadius);
  if (edge !== null) {
    return {
      kind: 'edge',
      shapeId: shape.id,
      edge,
      axis: polygonEdgeAxis(polygon, edge),
    };
  }
  return null;
};

export const reduceInteraction = (
  state: InteractionState,
  event: InteractionEvent,
  document: EditorDocument,
  /**
   * Currently-selected shape IDs (issue #43). A drag that starts on an
   * unselected shape moves only that shape (after selecting it); a drag that
   * starts on an already-selected shape moves the whole selection together.
   */
  selectedIds: readonly string[] = [],
  /**
   * Resize-handle hit radius, in grid units (issue #44). The caller derives
   * this from a fixed on-screen pixel radius and the current zoom, so the
   * handle stays equally easy to grab at any scale; a handle hit-test takes
   * priority over the shape-body hit-test below it, so grabbing a handle
   * never starts a move instead.
   */
  handleHitRadius = 0,
  /**
   * Ghost-vertex snap radius in grid units (issue #64), or `null` to offer
   * no ghost vertices at all — the caller passes `null` when cells are
   * drawn too small on screen for a ghost to coexist with the edge drag.
   */
  insertHitRadius: number | null = null
): InteractionResult => {
  // A stray pointer-cancel (e.g. losing capture mid-drag) resets any active
  // drag gesture, but never interrupts polygon creation (issue #48) — that
  // mode has no pointer capture of its own to lose, and only `Esc` /
  // `cancelPolygon` should discard it.
  if (event.type === 'pointerCancel') {
    if (state.kind === 'creatingPolygon') {
      return { state };
    }
    return { state: IDLE_STATE };
  }

  // `startPolygon` / `confirmPolygon` / `cancelPolygon` are keyboard-driven
  // (issue #48) and handled once, up front, rather than per-state below:
  // entry only takes effect from `idle`, and confirm / cancel only while
  // already `creatingPolygon`.
  if (event.type === 'startPolygon') {
    if (state.kind !== 'idle') {
      return { state };
    }
    return { state: { kind: 'creatingPolygon', vertices: [], cursorVertex: null } };
  }
  if (event.type === 'cancelPolygon') {
    if (state.kind !== 'creatingPolygon') {
      return { state };
    }
    return { state: IDLE_STATE };
  }
  if (event.type === 'confirmPolygon') {
    if (state.kind !== 'creatingPolygon') {
      return { state };
    }
    if (state.vertices.length < MIN_POLYGON_VERTICES) {
      return { state };
    }
    return { state: IDLE_STATE, effect: { type: 'createPolygon', vertices: state.vertices } };
  }

  switch (state.kind) {
    case 'idle': {
      if (event.type !== 'pointerDown') {
        return { state };
      }
      const { sample } = event;

      // A handle on the single selected shape always wins over the shape
      // body underneath it — grabbing a handle resizes, drags a vertex or
      // edge, or inserts a vertex; it never starts a move. See
      // `handleTargetAt` for the priority order.
      const target = handleTargetAt(
        document,
        selectedIds,
        sample.precise,
        handleHitRadius,
        insertHitRadius
      );
      if (target !== null) {
        const selectedShape = document.shapes[target.shapeId];
        if (selectedShape === undefined) {
          return { state };
        }
        switch (target.kind) {
          case 'resizeHandle':
            return {
              state: {
                kind: 'resizing',
                shapeId: target.shapeId,
                handle: target.handle,
                originBounds: target.bounds,
                currentBounds: target.bounds,
              },
            };
          case 'vertex':
            return {
              state: {
                kind: 'movingVertex',
                shapeId: target.shapeId,
                vertex: target.vertex,
                originPolygon: selectedShape.polygon,
                currentPolygon: selectedShape.polygon,
              },
            };
          case 'insertVertex': {
            // Insert the ghost as a real vertex now and drag it exactly like
            // an existing one (issue #64, 1 ジェスチャ). The origin already
            // holds the inserted vertex, so releasing without moving is a
            // "no net change" and leaves the shape untouched.
            const originPolygon = withVertexInserted(
              selectedShape.polygon,
              target.hit.edge,
              target.hit.point
            );
            return {
              state: {
                kind: 'movingVertex',
                shapeId: target.shapeId,
                vertex: { ring: target.hit.edge.ring, vertexIndex: target.hit.edge.edgeIndex + 1 },
                originPolygon,
                currentPolygon: originPolygon,
              },
            };
          }
          case 'edge':
            return {
              state: {
                kind: 'movingEdge',
                shapeId: target.shapeId,
                edge: target.edge,
                originVertex: sample.vertex,
                originPolygon: selectedShape.polygon,
                currentPolygon: selectedShape.polygon,
              },
            };
        }
      }

      const hit = shapeAtPoint(document, sample.precise);
      return {
        state: {
          kind: 'pending',
          originVertex: sample.vertex,
          originPrecise: sample.precise,
          shiftKey: sample.shiftKey,
          hitShapeId: hit?.id ?? null,
        },
      };
    }

    case 'pending': {
      if (event.type === 'pointerMove') {
        if (!movedEnough(state.originPrecise, event.sample.precise)) {
          return { state };
        }
        // A drag that started on a shape moves it (spec §6.1). Shift is
        // reserved for the blank-space marquee, so a Shift-drag on a shape
        // does not move it — it falls through to nothing (issue #44 territory:
        // resize handles have their own hit-testing outside this surface).
        if (state.hitShapeId !== null) {
          if (state.shiftKey) {
            return { state };
          }
          const hitShapeId = state.hitShapeId;
          const alreadySelected = selectedIds.includes(hitShapeId);
          const shapeIds = alreadySelected ? selectedIds : [hitShapeId];
          return {
            state: {
              kind: 'moving',
              originVertex: state.originVertex,
              shapeIds,
              delta: gridDelta(state.originVertex, event.sample.vertex),
            },
            effect: alreadySelected ? undefined : { type: 'selectOnly', shapeId: hitShapeId },
          };
        }
        if (state.shiftKey) {
          return {
            state: {
              kind: 'marquee',
              originPrecise: state.originPrecise,
              currentPrecise: event.sample.precise,
            },
          };
        }
        return {
          state: {
            kind: 'creatingRect',
            originVertex: state.originVertex,
            currentVertex: event.sample.vertex,
          },
        };
      }

      if (event.type === 'pointerUp') {
        // No meaningful drag: this is a click.
        if (state.hitShapeId !== null) {
          return {
            state: IDLE_STATE,
            effect: state.shiftKey
              ? { type: 'toggleSelection', shapeId: state.hitShapeId }
              : { type: 'selectOnly', shapeId: state.hitShapeId },
          };
        }
        // Clicked blank space. Shift+click on nothing keeps the selection.
        return {
          state: IDLE_STATE,
          effect: state.shiftKey ? undefined : { type: 'clearSelection' },
        };
      }

      return { state };
    }

    case 'creatingRect': {
      if (event.type === 'pointerMove') {
        if (samePoint(state.currentVertex, event.sample.vertex)) {
          return { state };
        }
        return {
          state: { ...state, currentVertex: event.sample.vertex },
        };
      }
      if (event.type === 'pointerUp') {
        return {
          state: IDLE_STATE,
          effect: {
            type: 'createRect',
            start: state.originVertex,
            end: event.sample.vertex,
          },
        };
      }
      return { state };
    }

    case 'marquee': {
      if (event.type === 'pointerMove') {
        if (samePoint(state.currentPrecise, event.sample.precise)) {
          return { state };
        }
        return { state: { ...state, currentPrecise: event.sample.precise } };
      }
      if (event.type === 'pointerUp') {
        const region = rectFromPoints(state.originPrecise, event.sample.precise);
        return {
          state: IDLE_STATE,
          effect: {
            type: 'setSelection',
            shapeIds: shapesWithinRegion(document, region),
          },
        };
      }
      return { state };
    }

    case 'moving': {
      if (event.type === 'pointerMove') {
        const delta = gridDelta(state.originVertex, event.sample.vertex);
        if (delta.x === state.delta.x && delta.y === state.delta.y) {
          return { state };
        }
        return { state: { ...state, delta } };
      }
      if (event.type === 'pointerUp') {
        const delta = gridDelta(state.originVertex, event.sample.vertex);
        // A move that never left its origin cell commits nothing — it was a
        // click, not a drag, and the earlier selectOnly effect already ran.
        if (delta.x === 0 && delta.y === 0) {
          return { state: IDLE_STATE };
        }
        return {
          state: IDLE_STATE,
          effect: { type: 'moveShapes', shapeIds: state.shapeIds, delta },
        };
      }
      return { state };
    }

    case 'resizing': {
      if (event.type === 'pointerMove') {
        const currentBounds = resizeRectBounds(
          state.originBounds,
          state.handle,
          event.sample.vertex
        );
        if (boundsEqual(currentBounds, state.currentBounds)) {
          return { state };
        }
        return { state: { ...state, currentBounds } };
      }
      if (event.type === 'pointerUp') {
        const bounds = resizeRectBounds(state.originBounds, state.handle, event.sample.vertex);
        // No net change (a handle grab with no drag): commit nothing.
        if (boundsEqual(bounds, state.originBounds)) {
          return { state: IDLE_STATE };
        }
        return {
          state: IDLE_STATE,
          effect: { type: 'resizeShape', shapeId: state.shapeId, bounds },
        };
      }
      return { state };
    }

    case 'movingVertex': {
      if (event.type === 'pointerMove') {
        const currentPolygon = withVertexMoved(
          state.originPolygon,
          state.vertex,
          event.sample.vertex
        );
        if (currentPolygon === state.currentPolygon) {
          return { state };
        }
        return { state: { ...state, currentPolygon } };
      }
      if (event.type === 'pointerUp') {
        const polygon = withVertexMoved(state.originPolygon, state.vertex, event.sample.vertex);
        // No net change (a vertex grab with no drag): commit nothing.
        if (polygon === state.originPolygon) {
          return { state: IDLE_STATE };
        }
        return {
          state: IDLE_STATE,
          effect: { type: 'updateShapeVertices', shapeId: state.shapeId, polygon },
        };
      }
      return { state };
    }

    case 'movingEdge': {
      if (event.type === 'pointerMove') {
        const delta = gridDelta(state.originVertex, event.sample.vertex);
        const currentPolygon = withEdgeMoved(state.originPolygon, state.edge, delta);
        if (currentPolygon === state.currentPolygon) {
          return { state };
        }
        return { state: { ...state, currentPolygon } };
      }
      if (event.type === 'pointerUp') {
        const delta = gridDelta(state.originVertex, event.sample.vertex);
        // No net change (an edge grab with no drag): commit nothing.
        if (delta.x === 0 && delta.y === 0) {
          return { state: IDLE_STATE };
        }
        const polygon = withEdgeMoved(state.originPolygon, state.edge, delta);
        return {
          state: IDLE_STATE,
          effect: { type: 'updateShapeVertices', shapeId: state.shapeId, polygon },
        };
      }
      return { state };
    }

    case 'creatingPolygon': {
      if (event.type === 'pointerMove') {
        const cursorVertex = event.sample.vertex;
        if (state.cursorVertex !== null && samePoint(state.cursorVertex, cursorVertex)) {
          return { state };
        }
        return { state: { ...state, cursorVertex } };
      }
      if (event.type === 'pointerDown') {
        const clicked = event.sample.vertex;
        const first = state.vertices[0];
        // Clicking the start vertex again closes the polygon — but only once
        // there are enough vertices to form one (spec §48 "3頂点未満では確定
        // 不可"); before that, clicking on top of it just re-places vertex 0
        // (a no-op placement, since dropping a duplicate point is harmless
        // and keeps the gesture predictable).
        if (
          first !== undefined &&
          state.vertices.length >= MIN_POLYGON_VERTICES &&
          Math.hypot(clicked.x - first.x, clicked.y - first.y) <= CLOSE_VERTEX_THRESHOLD_CELLS
        ) {
          return {
            state: IDLE_STATE,
            effect: { type: 'createPolygon', vertices: state.vertices },
          };
        }
        // A duplicate consecutive vertex (clicking the same spot twice) is a
        // no-op click, not a new edge.
        const last = state.vertices[state.vertices.length - 1];
        if (last !== undefined && samePoint(last, clicked)) {
          return { state };
        }
        return {
          state: { ...state, vertices: [...state.vertices, clicked], cursorVertex: clicked },
        };
      }
      return { state };
    }
  }
};

/**
 * Live move offset in whole grid units, or `null` when no move is in
 * progress. The caller applies this to the moving shapes' Konva nodes only —
 * React document state stays untouched until pointer-up (spec §14).
 */
export const movePreview = (
  state: InteractionState
): { readonly shapeIds: readonly string[]; readonly delta: GridPoint } | null => {
  if (state.kind !== 'moving') {
    return null;
  }
  return { shapeIds: state.shapeIds, delta: state.delta };
};

/**
 * Live resized bounds, or `null` when no resize is in progress. The caller
 * applies this to the resized shape's Konva node only — React document state
 * stays untouched until pointer-up (spec §14, issue #44).
 */
export const resizePreview = (
  state: InteractionState
): { readonly shapeId: string; readonly bounds: GridRect } | null => {
  if (state.kind !== 'resizing') {
    return null;
  }
  return { shapeId: state.shapeId, bounds: state.currentBounds };
};

/**
 * Live polygon-creation state, or `null` when not creating one (issue #48).
 * The caller draws the placed vertices, the rubber-band edge to the pointer,
 * and — once there are enough vertices — a closing-edge hint back to the
 * start; none of it touches React document state until confirm.
 */
export const polygonDraftPreview = (
  state: InteractionState
): {
  readonly vertices: readonly GridPoint[];
  readonly cursorVertex: GridPoint | null;
  readonly canClose: boolean;
} | null => {
  if (state.kind !== 'creatingPolygon') {
    return null;
  }
  return {
    vertices: state.vertices,
    cursorVertex: state.cursorVertex,
    canClose: state.vertices.length >= MIN_POLYGON_VERTICES,
  };
};

/**
 * Live proposed polygon while dragging a vertex or an edge, or `null`
 * otherwise (issue #50, spec §6.2 / §14). The caller applies this to the
 * edited shape's Konva node and the vertex/edge markers only — React
 * document state stays untouched until pointer-up, and a self-intersecting
 * or degenerate result is still shown live here even though it will be
 * rejected on commit (spec §6.2 "確定時に拒否"), so the user sees exactly
 * what would happen before deciding whether to keep dragging.
 */
export const vertexEditPreview = (
  state: InteractionState
): { readonly shapeId: string; readonly polygon: GridPolygon } | null => {
  if (state.kind !== 'movingVertex' && state.kind !== 'movingEdge') {
    return null;
  }
  return { shapeId: state.shapeId, polygon: state.currentPolygon };
};
