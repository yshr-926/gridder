import { useCallback, useRef, useState } from 'react';
import type { GridPoint } from '@gridder/editor-core';
import type { Position } from '@/types';
import { screenToWorld } from '@/features/viewport';
import { applyInteractionEffect } from './applyInteractionEffect';
import { editorSession } from './useEditorSession';
import {
  IDLE_STATE,
  reduceInteraction,
  type InteractionEvent,
  type InteractionState,
  type PointerSample,
} from './interactionController';

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

  const dispatchEvent = useCallback(
    (event: InteractionEvent) => {
      if (isViewportInteracting && stateRef.current.kind === 'idle') {
        return;
      }
      const { state: nextState, effect } = reduceInteraction(
        stateRef.current,
        event,
        editorSession.getDocument()
      );
      if (nextState !== stateRef.current) {
        stateRef.current = nextState;
        setState(nextState);
      }
      if (effect !== undefined) {
        applyInteractionEffect(editorSession, effect);
      }
    },
    [isViewportInteracting]
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
      dispatchEvent({ type: 'pointerMove', sample: toSample(screenPoint, shiftKey) });
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
