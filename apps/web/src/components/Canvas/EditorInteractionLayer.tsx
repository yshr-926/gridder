import { useCallback, useEffect, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Position } from '@/types';
import {
  previewRegion,
  useEditorInteraction,
} from '@/features/editor';

/**
 * EditorInteractionLayer Props
 */
interface EditorInteractionLayerProps {
  /** Viewport offset in screen pixels. */
  panPosition: Position;
  /** Viewport scale. */
  zoom: number;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** `#40`'s pan gesture has priority when true. */
  isViewportInteracting: boolean;
  /**
   * Reports the cursor the container should show for the move gesture
   * (issue #43): `grab` / `grabbing`, or `null` when this layer has no
   * cursor opinion (the caller falls back to its own default).
   */
  onCursorChange?: (cursor: 'grab' | 'grabbing' | null) => void;
}

/** Blank-drag rectangle preview fill / stroke (accent, low alpha). */
const RECT_PREVIEW_FILL = 'rgba(37, 99, 235, 0.12)';
const RECT_PREVIEW_STROKE = '#2563eb';
/** Shift-drag marquee preview fill / stroke (neutral, dashed). */
const MARQUEE_PREVIEW_FILL = 'rgba(100, 116, 139, 0.10)';
const MARQUEE_PREVIEW_STROKE = '#475569';

/**
 * The pointer-arbitration layer for the polygon editor (issues #42, #43). A
 * single transparent Konva rect captures pointer events across the whole
 * world and feeds them to {@link useEditorInteraction}; the drag preview
 * (blank-drag rectangle or Shift-drag marquee) is drawn here as Konva-only
 * nodes, so React document state is never touched mid-gesture. A shape-drag
 * move has no preview node of its own here — `GridCanvas` reads the same
 * move-gesture state from `useMovePreviewStore` and offsets the moving
 * shapes' actual Konva nodes in `ShapesLayer` / `SelectionOverlay` instead.
 * Replaces the cell-era `InteractionLayer` on `GridCanvas`'s document path.
 */
export const EditorInteractionLayer = ({
  panPosition,
  zoom,
  gridSize,
  isViewportInteracting,
  onCursorChange,
}: EditorInteractionLayerProps) => {
  const { state, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useEditorInteraction({
      scale: zoom,
      offset: panPosition,
      gridSize,
      isViewportInteracting,
    });

  const pointerFromEvent = useCallback(
    (event: KonvaEventObject<PointerEvent | MouseEvent>): Position | null => {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      return pointer ? { x: pointer.x, y: pointer.y } : null;
    },
    []
  );

  const handleDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerDown(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerDown]
  );

  const handleMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerMove(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerMove]
  );

  const handleUp = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerUp(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerUp]
  );

  // Cursor feedback for the move gesture (spec §6.1, issue #43): `grabbing`
  // once the drag is moving a shape, `grab` while the pointer is down on a
  // shape but hasn't crossed the drag threshold yet. Reported to the parent
  // so it can be applied to the Stage container, matching how `#40`'s pan
  // cursor is set on `GridCanvas`.
  const cursor: 'grab' | 'grabbing' | null =
    state.kind === 'moving'
      ? 'grabbing'
      : state.kind === 'pending' && state.hitShapeId !== null
        ? 'grab'
        : null;

  useEffect(() => {
    onCursorChange?.(cursor);
  }, [cursor, onCursorChange]);

  const preview = useMemo(() => {
    const region = previewRegion(state);
    if (region === null) {
      return null;
    }
    const isMarquee = state.kind === 'marquee';
    return (
      <Rect
        name={isMarquee ? 'marquee-preview' : 'rect-preview'}
        x={region.minX * gridSize}
        y={region.minY * gridSize}
        width={(region.maxX - region.minX) * gridSize}
        height={(region.maxY - region.minY) * gridSize}
        fill={isMarquee ? MARQUEE_PREVIEW_FILL : RECT_PREVIEW_FILL}
        stroke={isMarquee ? MARQUEE_PREVIEW_STROKE : RECT_PREVIEW_STROKE}
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={isMarquee ? [4, 3] : undefined}
        listening={false}
      />
    );
  }, [state, gridSize]);

  // A large transparent rect so pointer events land even on empty canvas.
  const size = 200000;
  const origin = -100000;

  return (
    <Group listening={!isViewportInteracting}>
      <Rect
        name="editor-interaction-surface"
        x={origin}
        y={origin}
        width={size}
        height={size}
        fill="transparent"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={onPointerCancel}
      />
      {preview}
    </Group>
  );
};
