import {
  createPolygonClippingEngine,
  type EditorDocument,
  type GridPoint,
  type GridPolygon,
  type PolygonBooleanEngine,
} from '@gridder/editor-core';
import {
  cellAtPoint,
  cellPolygon,
  cellsEqual,
  edgeAtPoint,
  isAxisAlignedRect,
  polygonBounds,
  rectFromPoints,
  resizeHandleAtPoint,
  resizeRectBounds,
  shapeAtPoint,
  shapesWithinRegion,
  vertexAtPoint,
  withEdgeMoved,
  withVertexMoved,
  type GridRect,
  type PolygonEdgeRef,
  type PolygonVertexRef,
  type ResizeHandleKind,
} from './hitTest';

/**
 * The polygon boolean Adapter used for the live cell-edit preview
 * (issue #49). `PolygonBooleanEngine` is stateless, so one module-level
 * instance is enough — the reducer stays a plain function without threading
 * a fresh engine through every call site.
 */
const booleanEngine: PolygonBooleanEngine = createPolygonClippingEngine();

/**
 * Pointer arbitration for the polygon editor's normal state (spec §6.1, §6.2,
 * §6.3, issues #42, #43, #44, #48, #49). One controller decides, from a
 * stream of pointer and keyboard events, whether the gesture is a
 * click-select, a Shift-toggle, a blank-drag rectangle, a Shift-drag
 * marquee, a shape-drag move, a handle-drag resize, a click-by-click polygon
 * creation, or a cell-drag shape edit — without adding tool modes for the
 * direct-manipulation gestures. Polygon creation (spec §6.3 "一時的なポリゴン
 * 作成") and shape editing (spec §6.3 "一時的な図形編集状態") are the modal
 * exceptions ui-principles §2 allows, each entered explicitly (`P` / the
 * top-bar button, or a double-click) and exited via confirm or `Esc`.
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
  /** Whether Alt/Option was held for this event (issue #49 cell removal). */
  readonly altKey?: boolean;
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
    }
  | {
      readonly kind: 'editingShape';
      readonly shapeId: string;
      /** The shape's polygon when editing began — restored on `Esc`. */
      readonly originalPolygon: GridPolygon;
      /**
       * The live preview: every completed stroke so far, plus the
       * in-progress stroke's cells applied on top (issue #49). Usually one
       * polygon; a `difference` that disconnects the shape leaves more than
       * one here, each previewed and eligible for further edits until
       * confirm splits them into real shapes (ADR-0001). Nothing here is
       * committed to the document until `confirmShapeEdit`.
       */
      readonly workingPolygons: readonly GridPolygon[];
      /**
       * `workingPolygons` as of the end of the *previous* stroke — the
       * baseline the in-progress stroke's cells are replayed against on
       * every pointer move, so recomputing never compounds the boolean op
       * onto its own prior output. Equal to `workingPolygons` whenever
       * `stroke` is `null`.
       */
      readonly strokeBaseline: readonly GridPolygon[];
      /**
       * The in-progress drag stroke, or `null` between strokes. `isRemoving`
       * is fixed for the whole stroke from the pointer-down's Alt state;
       * `cells` accumulates every distinct cell the pointer has crossed
       * this stroke, in encounter order.
       */
      readonly stroke: {
        readonly isRemoving: boolean;
        readonly cells: readonly GridRect[];
      } | null;
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
  | { readonly type: 'cancelPolygon' }
  /**
   * Double-click on a shape (issue #49, spec §6.3): enters cell-edit mode
   * for that shape. Only takes effect from `idle` — double-clicking during
   * another gesture does nothing.
   */
  | { readonly type: 'doubleClickShape'; readonly shapeId: string }
  /** `Enter`, only meaningful while `editingShape`. */
  | { readonly type: 'confirmShapeEdit' }
  /** `Esc`, only meaningful while `editingShape`. */
  | { readonly type: 'cancelShapeEdit' };

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
    }
  | {
      readonly type: 'commitShapeEdit';
      readonly shapeId: string;
      /** The polygon the shape had before this cell-edit gesture began. */
      readonly originalPolygon: GridPolygon;
      /**
       * The result polygons as of the last completed stroke (issue #49). One
       * entry replaces the shape in place; more than one means a `difference`
       * disconnected it and the caller splits it into that many shapes
       * (ADR-0001), each inheriting the original name and style under a new
       * id; zero entries means the shape was fully erased and the caller
       * deletes it.
       */
      readonly resultPolygons: readonly GridPolygon[];
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

/**
 * A stable string key for a {@link GridPolygon}'s exact vertex data (issue
 * #49): used only to detect "no change at all" before committing a shape
 * edit, never to compare polygons that differ merely by vertex rotation or
 * winding — those already come out normalised and consistent from the
 * boolean engine within one editing session.
 */
const polygonKey = (polygon: GridPolygon): string => {
  const ringKey = (ring: readonly GridPoint[]): string =>
    ring.map((point) => `${point.x},${point.y}`).join('|');
  return [ringKey(polygon.outerRing), ...polygon.innerRings.map(ringKey)].join(';');
};

/** Whole-grid-unit offset from `origin` to `current` (issue #43 move delta). */
const gridDelta = (origin: GridPoint, current: GridPoint): GridPoint => ({
  x: current.x - origin.x,
  y: current.y - origin.y,
});

/**
 * Applies one cell-drag stroke to the shape's current working polygons
 * (issue #49, ADR-0001): a plain drag unions every touched cell into the
 * shape; an Alt-drag subtracts them instead, applied independently to each
 * working polygon so a `difference` that disconnects one piece never
 * touches the others. `union` never disconnects a single starting polygon,
 * so it always collapses back to exactly one result; `difference` may leave
 * more than one (a split) or none at all (the shape fully erased).
 */
const applyCellStroke = (
  workingPolygons: readonly GridPolygon[],
  strokeCells: readonly GridRect[],
  isRemoving: boolean
): readonly GridPolygon[] => {
  if (strokeCells.length === 0) {
    return workingPolygons;
  }
  const cellPolygons = strokeCells.map(cellPolygon);
  if (isRemoving) {
    return workingPolygons.flatMap((polygon) =>
      booleanEngine.difference(polygon, cellPolygons)
    );
  }
  return booleanEngine.union([...workingPolygons, ...cellPolygons]);
};

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
  handleHitRadius = 0
): InteractionResult => {
  // A stray pointer-cancel (e.g. losing capture mid-drag) resets any active
  // drag gesture, but never interrupts polygon creation (issue #48) or
  // shape editing (issue #49) — those modes have no pointer capture of
  // their own to lose, and only `Esc` / their `cancel*` event should
  // discard them. Mid-stroke while `editingShape`, it drops just the
  // in-progress stroke, matching a plain pointer-up with no further move.
  if (event.type === 'pointerCancel') {
    if (state.kind === 'creatingPolygon') {
      return { state };
    }
    if (state.kind === 'editingShape') {
      return {
        state: { ...state, workingPolygons: state.strokeBaseline, stroke: null },
      };
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

  // `doubleClickShape` / `confirmShapeEdit` / `cancelShapeEdit` are the
  // keyboard- and gesture-driven controls for cell editing (issue #49, spec
  // §6.3), handled the same way as the polygon-creation triad above: entry
  // only from `idle`, confirm / cancel only while already `editingShape`.
  if (event.type === 'doubleClickShape') {
    if (state.kind !== 'idle') {
      return { state };
    }
    const shape = document.shapes[event.shapeId];
    if (shape === undefined) {
      return { state };
    }
    return {
      state: {
        kind: 'editingShape',
        shapeId: shape.id,
        originalPolygon: shape.polygon,
        workingPolygons: [shape.polygon],
        strokeBaseline: [shape.polygon],
        stroke: null,
      },
    };
  }
  if (event.type === 'cancelShapeEdit') {
    if (state.kind !== 'editingShape') {
      return { state };
    }
    return { state: IDLE_STATE };
  }
  if (event.type === 'confirmShapeEdit') {
    if (state.kind !== 'editingShape') {
      return { state };
    }
    // No net change at all: nothing to commit, not even a no-op Command.
    if (
      state.workingPolygons.length === 1 &&
      polygonKey(state.workingPolygons[0]) === polygonKey(state.originalPolygon)
    ) {
      return { state: IDLE_STATE };
    }
    return {
      state: IDLE_STATE,
      effect: {
        type: 'commitShapeEdit',
        shapeId: state.shapeId,
        originalPolygon: state.originalPolygon,
        resultPolygons: state.workingPolygons,
      },
    };
  }

  switch (state.kind) {
    case 'idle': {
      if (event.type !== 'pointerDown') {
        return { state };
      }
      const { sample } = event;

      // A resize handle only exists for a single selected axis-aligned
      // rectangle (issue #44) and always wins over the shape body underneath
      // it — grabbing a handle resizes, it never starts a move.
      if (selectedIds.length === 1) {
        const selectedShape = document.shapes[selectedIds[0]];
        if (selectedShape !== undefined && isAxisAlignedRect(selectedShape.polygon)) {
          const bounds = polygonBounds(selectedShape.polygon);
          const handle = resizeHandleAtPoint(bounds, sample.precise, handleHitRadius);
          if (handle !== null) {
            return {
              state: {
                kind: 'resizing',
                shapeId: selectedShape.id,
                handle,
                originBounds: bounds,
                currentBounds: bounds,
              },
            };
          }
        } else if (selectedShape !== undefined) {
          // A single selected shape that is not a rectangle gets vertex/edge
          // handles instead (issue #50, spec §6.2 "ポリゴンは...頂点・辺を直接動か
          // して変形する" — no bounding-box handles for these). A vertex hit
          // wins over an edge hit at the same point, matching the corners-
          // before-edges priority resize handles already use.
          const vertex = vertexAtPoint(selectedShape.polygon, sample.precise, handleHitRadius);
          if (vertex !== null) {
            return {
              state: {
                kind: 'movingVertex',
                shapeId: selectedShape.id,
                vertex,
                originPolygon: selectedShape.polygon,
                currentPolygon: selectedShape.polygon,
              },
            };
          }
          const edge = edgeAtPoint(selectedShape.polygon, sample.precise, handleHitRadius);
          if (edge !== null) {
            return {
              state: {
                kind: 'movingEdge',
                shapeId: selectedShape.id,
                edge,
                originVertex: sample.vertex,
                originPolygon: selectedShape.polygon,
                currentPolygon: selectedShape.polygon,
              },
            };
          }
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
        const currentPolygon = withVertexMoved(state.originPolygon, state.vertex, event.sample.vertex);
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

    case 'editingShape': {
      // Selecting another shape is disallowed while editing (issue #49
      // "編集中は他の図形を選択できない"): a pointer-down starts a cell-drag stroke
      // regardless of what is under the pointer, rather than hit-testing for
      // a different shape to select.
      if (event.type === 'pointerDown') {
        const cell = cellAtPoint(event.sample.precise);
        const isRemoving = event.sample.altKey ?? false;
        const workingPolygons = applyCellStroke(state.strokeBaseline, [cell], isRemoving);
        return {
          state: { ...state, workingPolygons, stroke: { isRemoving, cells: [cell] } },
        };
      }
      if (event.type === 'pointerMove') {
        if (state.stroke === null) {
          return { state };
        }
        const cell = cellAtPoint(event.sample.precise);
        const lastCell = state.stroke.cells[state.stroke.cells.length - 1];
        if (lastCell !== undefined && cellsEqual(lastCell, cell)) {
          return { state };
        }
        const cells = [...state.stroke.cells, cell];
        // Always replay every cell this stroke has touched against the
        // pre-stroke baseline, rather than folding just this move's cell
        // into the live preview — the boolean op is not associative enough
        // to stack safely (e.g. a difference already covering a cell must
        // stay idempotent), so a clean replay is the only way the preview
        // matches what pointer-up will finalize.
        const workingPolygons = applyCellStroke(state.strokeBaseline, cells, state.stroke.isRemoving);
        return { state: { ...state, workingPolygons, stroke: { ...state.stroke, cells } } };
      }
      if (event.type === 'pointerUp') {
        // The stroke's result (already the live preview) becomes the new
        // baseline for the next stroke; a plain click with no drag leaves
        // exactly one cell's worth of edit, matching the issue's "セルのドラッグ
        // で領域を追加" for a single cell too.
        return { state: { ...state, strokeBaseline: state.workingPolygons, stroke: null } };
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

/**
 * Live cell-edit state, or `null` when not editing a shape (issue #49, spec
 * §6.3 / §14). The caller draws the edited shape from `workingPolygons`
 * instead of its document geometry, dims every other shape, and shows the
 * cell grid over the edited shape's footprint; the document is untouched
 * until confirm.
 */
export const shapeEditPreview = (
  state: InteractionState
): { readonly shapeId: string; readonly workingPolygons: readonly GridPolygon[] } | null => {
  if (state.kind !== 'editingShape') {
    return null;
  }
  return { shapeId: state.shapeId, workingPolygons: state.workingPolygons };
};
