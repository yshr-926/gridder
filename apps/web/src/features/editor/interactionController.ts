import type { EditorDocument, GridPoint } from '@gridder/editor-core';
import {
  rectFromPoints,
  shapeAtPoint,
  shapesWithinRegion,
  type GridRect,
} from './hitTest';

/**
 * Pointer arbitration for the polygon editor's normal state (spec §6.1,
 * issues #42 and #43). One controller decides, from a stream of pointer
 * events, whether the gesture is a click-select, a Shift-toggle, a blank-drag
 * rectangle, a Shift-drag marquee, or a shape-drag move — without adding tool
 * modes.
 *
 * It is a pure reducer: {@link reduceInteraction} takes the current
 * {@link InteractionState}, one {@link InteractionEvent}, the document, and the
 * live selection, and returns the next state plus at most one
 * {@link InteractionEffect} for the caller to carry out (mutate the document
 * through a Command, change the selection). Panning is not modelled here:
 * while `#40`'s `useViewportPan` reports a pan in progress the caller feeds no
 * events to this controller.
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
    };

export type InteractionEvent =
  | { readonly type: 'pointerDown'; readonly sample: PointerSample }
  | { readonly type: 'pointerMove'; readonly sample: PointerSample }
  | { readonly type: 'pointerUp'; readonly sample: PointerSample }
  | { readonly type: 'pointerCancel' };

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
    };

export interface InteractionResult {
  readonly state: InteractionState;
  readonly effect?: InteractionEffect;
}

/** Grid-vertex distance past which a pending pointer becomes a drag gesture. */
const DRAG_THRESHOLD_CELLS = 0.35;

export const IDLE_STATE: InteractionState = { kind: 'idle' };

const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

const movedEnough = (from: GridPoint, to: GridPoint): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_THRESHOLD_CELLS;

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

export const reduceInteraction = (
  state: InteractionState,
  event: InteractionEvent,
  document: EditorDocument,
  /**
   * Currently-selected shape IDs (issue #43). A drag that starts on an
   * unselected shape moves only that shape (after selecting it); a drag that
   * starts on an already-selected shape moves the whole selection together.
   */
  selectedIds: readonly string[] = []
): InteractionResult => {
  if (event.type === 'pointerCancel') {
    return { state: IDLE_STATE };
  }

  switch (state.kind) {
    case 'idle': {
      if (event.type !== 'pointerDown') {
        return { state };
      }
      const { sample } = event;
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
