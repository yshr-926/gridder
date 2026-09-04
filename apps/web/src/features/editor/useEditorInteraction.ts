import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridPoint } from '@gridder/editor-core';
import type { Position } from '@/types';
import { screenToWorld } from '@/features/viewport';
import { useSelectionStore } from '@/stores/selectionStore';
import { useMovePreviewStore } from '@/stores/movePreviewStore';
import { applyInteractionEffect } from './applyInteractionEffect';
import { editorSession } from './useEditorSession';
import {
  IDLE_STATE,
  movePreview,
  reduceInteraction,
  type InteractionEvent,
  type InteractionState,
  type PointerSample,
} from './interactionController';

/** Move-gesture pointer-move updates are throttled to once per frame (16ms). */
const MOVE_THROTTLE_MS = 16;

interface UseEditorInteractionArgs {
  /** Current viewport scale. */
  readonly scale: number;
  /** Current viewport offset in screen pixels. */
  readonly offset: Position;
  /** Pixel size of one grid cell. */
  readonly gridSize: number;
  /**
   * When `true`, `#40`'s pan gesture owns the pointer; the controller ignores
   * every event so a Space/middle-button drag never creates or selects a shape.
   */
  readonly isViewportInteracting: boolean;
}

interface UseEditorInteractionResult {
  /** Live state machine value, for rendering the drag preview. */
  readonly state: InteractionState;
  readonly onPointerDown: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerMove: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerUp: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerCancel: () => void;
}

/**
 * React glue around {@link reduceInteraction}. Translates screen pointer
 * positions to grid space, drives the pure reducer, applies any effect through
 * {@link applyInteractionEffect}, and re-renders only when the preview-relevant
 * state changes (so a rectangle drag repaints the Konva preview but never the
 * React document).
 */
export const useEditorInteraction = ({
  scale,
  offset,
  gridSize,
  isViewportInteracting,
}: UseEditorInteractionArgs): UseEditorInteractionResult => {
  const stateRef = useRef<InteractionState>(IDLE_STATE);
  const [state, setState] = useState<InteractionState>(IDLE_STATE);
  /** Timestamp (`performance.now()`) of the last processed move while `moving`. */
  const lastMoveThrottleRef = useRef(0);

  const toSample = useCallback(
    (screenPoint: Position, shiftKey: boolean): PointerSample => {
      const world = screenToWorld(screenPoint, { scale, offset });
      const precise: GridPoint = { x: world.x / gridSize, y: world.y / gridSize };
      const vertex: GridPoint = {
        x: Math.round(precise.x),
        y: Math.round(precise.y),
      };
      return { vertex, precise, shiftKey };
    },
    [scale, offset, gridSize]
  );

  // The Konva-only move preview (issue #43, spec §14) is transient UI state
  // owned by this hook; clear it whenever the gesture leaves `moving` for any
  // reason (commit, cancel, or unmount) so a stale offset never lingers.
  const syncMovePreview = useCallback((nextState: InteractionState) => {
    const preview = movePreview(nextState);
    const store = useMovePreviewStore.getState();
    if (preview === null) {
      if (store.preview !== null) {
        store.clearPreview();
      }
      return;
    }
    store.setPreview(preview.shapeIds, preview.delta);
  }, []);

  useEffect(() => () => syncMovePreview(IDLE_STATE), [syncMovePreview]);

  const dispatchEvent = useCallback(
    (event: InteractionEvent) => {
      if (isViewportInteracting && stateRef.current.kind === 'idle') {
        return;
      }
      const { state: nextState, effect } = reduceInteraction(
        stateRef.current,
        event,
        editorSession.getDocument(),
        useSelectionStore.getState().selectedIds
      );
      if (nextState !== stateRef.current) {
        stateRef.current = nextState;
        setState(nextState);
        syncMovePreview(nextState);
      }
      if (effect !== undefined) {
        applyInteractionEffect(editorSession, effect);
      }
    },
    [isViewportInteracting, syncMovePreview]
  );

  const onPointerDown = useCallback(
    (screenPoint: Position, shiftKey: boolean) => {
      if (isViewportInteracting) {
        return;
      }
      dispatchEvent({ type: 'pointerDown', sample: toSample(screenPoint, shiftKey) });
    },
    [dispatchEvent, toSample, isViewportInteracting]
  );

  const onPointerMove = useCallback(
    (screenPoint: Position, shiftKey: boolean) => {
      if (stateRef.current.kind === 'idle') {
        return;
      }
      // Throttle only the move-drag path (issue #43): rectangle/marquee
      // previews stay at native pointer rate, but a shape drag recomputes a
      // delta and repaints every dragged node, so it is capped to ~60fps. The
      // very first move that enters `moving` (from `pending`) always goes
      // through — only subsequent moves while already `moving` are subject to
      // the interval, so the timestamp is (re)armed after every processed
      // move that is in, or lands in, `moving`.
      const wasMoving = stateRef.current.kind === 'moving';
      if (wasMoving) {
        const now = performance.now();
        if (now - lastMoveThrottleRef.current < MOVE_THROTTLE_MS) {
          return;
        }
      }
      dispatchEvent({ type: 'pointerMove', sample: toSample(screenPoint, shiftKey) });
      if (wasMoving || stateRef.current.kind === 'moving') {
        lastMoveThrottleRef.current = performance.now();
      }
    },
    [dispatchEvent, toSample]
  );

  const onPointerUp = useCallback(
    (screenPoint: Position, shiftKey: boolean) => {
      if (stateRef.current.kind === 'idle') {
        return;
      }
      dispatchEvent({ type: 'pointerUp', sample: toSample(screenPoint, shiftKey) });
    },
    [dispatchEvent, toSample]
  );

  const onPointerCancel = useCallback(() => {
    if (stateRef.current.kind === 'idle') {
      return;
    }
    dispatchEvent({ type: 'pointerCancel' });
  }, [dispatchEvent]);

  return { state, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
};
