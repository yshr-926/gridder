import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridPoint } from '@gridder/editor-core';
import type { Position } from '@/types';
import { readViewportTransform, screenToWorld } from '@/features/viewport';
import { useSelectionStore } from '@/stores/selectionStore';
import { useMovePreviewStore } from '@/stores/movePreviewStore';
import { useResizePreviewStore } from '@/stores/resizePreviewStore';
import { useVertexPreviewStore } from '@/stores/vertexPreviewStore';
import { applyInteractionEffect } from './applyInteractionEffect';
import { editorSession } from './useEditorSession';
import {
  isAxisAlignedRect,
  polygonBounds,
  resizeHandleAtPoint,
  type ResizeHandleKind,
} from './hitTest';
import {
  IDLE_STATE,
  movePreview,
  reduceInteraction,
  resizePreview,
  vertexEditPreview,
  type InteractionEvent,
  type InteractionState,
  type PointerSample,
} from './interactionController';

/**
 * Move- and resize-gesture pointer-move updates are throttled to once per
 * frame (16ms, issues #43 / #44).
 */
const DRAG_THROTTLE_MS = 16;
/**
 * On-screen radius (pixels) a pointer-down must land within a resize
 * handle's exact grid position to grab it (issue #44 "hit 領域は表示より広く
 * する") — independent of zoom, so the handle stays equally easy to grab at
 * any scale.
 */
const RESIZE_HANDLE_HIT_RADIUS_PX = 10;

interface UseEditorInteractionArgs {
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
  /**
   * The resize handle currently under the pointer while idle (issue #44),
   * for hover cursor feedback before a drag starts. `null` off any handle.
   */
  readonly hoveredHandle: ResizeHandleKind | null;
  readonly onPointerDown: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerMove: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerUp: (screenPoint: Position, shiftKey: boolean) => void;
  readonly onPointerCancel: () => void;
  /**
   * Enter polygon creation (issue #48, spec §6.3) — the `P` shortcut and the
   * top-bar button both call this. A no-op unless the controller is `idle`.
   */
  readonly startPolygon: () => void;
}

/**
 * React glue around {@link reduceInteraction}. Translates screen pointer
 * positions to grid space, drives the pure reducer, applies any effect through
 * {@link applyInteractionEffect}, and re-renders only when the preview-relevant
 * state changes (so a rectangle drag repaints the Konva preview but never the
 * React document). The viewport transform is read from the store at event
 * time (`readViewportTransform`, issue #61) rather than taken as an argument,
 * so a pan or zoom never has to re-render the caller to keep conversions
 * current.
 */
export const useEditorInteraction = ({
  gridSize,
  isViewportInteracting,
}: UseEditorInteractionArgs): UseEditorInteractionResult => {
  const stateRef = useRef<InteractionState>(IDLE_STATE);
  const [state, setState] = useState<InteractionState>(IDLE_STATE);
  /** Timestamp (`performance.now()`) of the last processed move while dragging. */
  const lastDragThrottleRef = useRef(0);
  /** Resize handle under the pointer while idle (issue #44 hover cursor). */
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandleKind | null>(null);

  const toSample = useCallback(
    (screenPoint: Position, shiftKey: boolean): PointerSample => {
      const world = screenToWorld(screenPoint, readViewportTransform());
      const precise: GridPoint = { x: world.x / gridSize, y: world.y / gridSize };
      const vertex: GridPoint = {
        x: Math.round(precise.x),
        y: Math.round(precise.y),
      };
      return { vertex, precise, shiftKey };
    },
    [gridSize]
  );

  /**
   * On-screen handle hit radius expressed in grid units at the *current*
   * zoom, so the handle stays equally easy to grab at any scale (issue #44).
   */
  const handleHitRadiusInGridUnits = useCallback(
    (): number => RESIZE_HANDLE_HIT_RADIUS_PX / (gridSize * readViewportTransform().scale),
    [gridSize]
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

  // Same idea for the resize preview (issue #44): live bounds while
  // `resizing`, cleared the instant the gesture leaves that state.
  const syncResizePreview = useCallback((nextState: InteractionState) => {
    const preview = resizePreview(nextState);
    const store = useResizePreviewStore.getState();
    if (preview === null) {
      if (store.preview !== null) {
        store.clearPreview();
      }
      return;
    }
    store.setPreview(preview.shapeId, preview.bounds);
  }, []);

  // Same idea for the vertex/edge-edit preview (issue #50): live proposed
  // polygon while `movingVertex` / `movingEdge`, cleared the instant the
  // gesture leaves either state.
  const syncVertexPreview = useCallback((nextState: InteractionState) => {
    const preview = vertexEditPreview(nextState);
    const store = useVertexPreviewStore.getState();
    if (preview === null) {
      if (store.preview !== null) {
        store.clearPreview();
      }
      return;
    }
    store.setPreview(preview.shapeId, preview.polygon);
  }, []);

  useEffect(() => {
    return () => {
      syncMovePreview(IDLE_STATE);
      syncResizePreview(IDLE_STATE);
      syncVertexPreview(IDLE_STATE);
    };
  }, [syncMovePreview, syncResizePreview, syncVertexPreview]);

  const dispatchEvent = useCallback(
    (event: InteractionEvent) => {
      if (isViewportInteracting && stateRef.current.kind === 'idle') {
        return;
      }
      // A resize handle only exists for a single selected axis-aligned
      // rectangle; the hit radius is expressed in grid units so it stays a
      // fixed on-screen size at any zoom (issue #44).
      const { state: nextState, effect } = reduceInteraction(
        stateRef.current,
        event,
        editorSession.getDocument(),
        useSelectionStore.getState().selectedIds,
        handleHitRadiusInGridUnits()
      );
      if (nextState !== stateRef.current) {
        stateRef.current = nextState;
        setState(nextState);
        syncMovePreview(nextState);
        syncResizePreview(nextState);
        syncVertexPreview(nextState);
      }
      if (effect !== undefined) {
        applyInteractionEffect(editorSession, effect);
      }
    },
    [
      isViewportInteracting,
      handleHitRadiusInGridUnits,
      syncMovePreview,
      syncResizePreview,
      syncVertexPreview,
    ]
  );

  const onPointerDown = useCallback(
    (screenPoint: Position, shiftKey: boolean) => {
      if (isViewportInteracting) {
        return;
      }
      setHoveredHandle(null);
      dispatchEvent({ type: 'pointerDown', sample: toSample(screenPoint, shiftKey) });
    },
    [dispatchEvent, toSample, isViewportInteracting]
  );

  // Resize-handle hover cursor (issue #44): while idle, check whether the
  // pointer sits over the single selected rectangle's handle so the cursor
  // can hint the resize direction before any drag begins.
  const updateHoveredHandle = useCallback(
    (screenPoint: Position) => {
      const selectedIds = useSelectionStore.getState().selectedIds;
      if (selectedIds.length !== 1) {
        setHoveredHandle((previous) => (previous === null ? previous : null));
        return;
      }
      const shape = editorSession.getDocument().shapes[selectedIds[0]];
      if (shape === undefined || !isAxisAlignedRect(shape.polygon)) {
        setHoveredHandle((previous) => (previous === null ? previous : null));
        return;
      }
      const { precise } = toSample(screenPoint, false);
      const handle = resizeHandleAtPoint(
        polygonBounds(shape.polygon),
        precise,
        handleHitRadiusInGridUnits()
      );
      setHoveredHandle((previous) => (previous === handle ? previous : handle));
    },
    [toSample, handleHitRadiusInGridUnits]
  );

  const onPointerMove = useCallback(
    (screenPoint: Position, shiftKey: boolean) => {
      if (stateRef.current.kind === 'idle') {
        if (!isViewportInteracting) {
          updateHoveredHandle(screenPoint);
        }
        return;
      }
      if (hoveredHandle !== null) {
        setHoveredHandle(null);
      }
      // Throttle only the drag paths that redraw a shape's Konva node every
      // move — moving (issue #43), resizing (issue #44), and vertex/edge
      // editing (issue #50); rectangle/marquee previews stay at native
      // pointer rate. The very first move that enters one of these states
      // (from `pending` / `idle`) always goes through — only subsequent moves
      // while already dragging are subject to the interval, so the timestamp
      // is (re)armed after every processed move that is in, or lands in, one
      // of these states.
      const isDragKind = (kind: InteractionState['kind']): boolean =>
        kind === 'moving' ||
        kind === 'resizing' ||
        kind === 'movingVertex' ||
        kind === 'movingEdge';
      const wasDragging = isDragKind(stateRef.current.kind);
      if (wasDragging) {
        const now = performance.now();
        if (now - lastDragThrottleRef.current < DRAG_THROTTLE_MS) {
          return;
        }
      }
      dispatchEvent({ type: 'pointerMove', sample: toSample(screenPoint, shiftKey) });
      if (wasDragging || isDragKind(stateRef.current.kind)) {
        lastDragThrottleRef.current = performance.now();
      }
    },
    [dispatchEvent, toSample, isViewportInteracting, updateHoveredHandle, hoveredHandle]
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

  const startPolygon = useCallback(() => {
    dispatchEvent({ type: 'startPolygon' });
  }, [dispatchEvent]);

  // Polygon-creation keyboard control (issue #48, spec §6.3): `P` enters
  // polygon creation (ignored while an editable element has focus, or while
  // any other gesture is in progress — starting mid-drag makes no sense).
  // `Enter` confirms the draft, `Esc` discards it — checked without regard to
  // modifier keys. All routes through the same reducer as pointer events so
  // `creatingPolygon` stays the single source of truth.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === 'Enter') {
        if (stateRef.current.kind === 'creatingPolygon') {
          event.preventDefault();
          dispatchEvent({ type: 'confirmPolygon' });
        }
        return;
      }
      if (event.key === 'Escape') {
        if (stateRef.current.kind === 'creatingPolygon') {
          event.preventDefault();
          dispatchEvent({ type: 'cancelPolygon' });
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if ((event.key === 'p' || event.key === 'P') && stateRef.current.kind === 'idle') {
        event.preventDefault();
        dispatchEvent({ type: 'startPolygon' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatchEvent]);

  return {
    state,
    hoveredHandle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    startPolygon,
  };
};
