import type { EditorDocument, GridPoint } from '@gridder/editor-core';
import {
  rectFromPoints,
  shapeAtPoint,
  shapesWithinRegion,
  type GridRect,
} from './hitTest';

/**
 * Pointer arbitration for the polygon editor's normal state (spec §6.1,
 * issue #42). One controller decides, from a stream of pointer events, whether
 * the gesture is a click-select, a Shift-toggle, a blank-drag rectangle, or a
 * Shift-drag marquee — without adding tool modes.
 *
 * It is a pure reducer: {@link reduceInteraction} takes the current
 * {@link InteractionState} and one {@link InteractionEvent} and returns the next
 * state plus at most one {@link InteractionEffect} for the caller to carry out
 * (mutate the document through a Command, change the selection). Panning is not
 * modelled here: while `#40`'s `useViewportPan` reports a pan in progress the
 * caller feeds no events to this controller.
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
  document: EditorDocument
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
        // A drag that started on a shape is reserved for move/resize (other
        // issues); here it just holds until pointer-up acts as a click.
        if (state.hitShapeId !== null) {
          return { state };
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
  }
};
