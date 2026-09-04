import { useCallback, useMemo } from 'react';
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
}

/** Blank-drag rectangle preview fill / stroke (accent, low alpha). */
const RECT_PREVIEW_FILL = 'rgba(37, 99, 235, 0.12)';
const RECT_PREVIEW_STROKE = '#2563eb';
/** Shift-drag marquee preview fill / stroke (neutral, dashed). */
const MARQUEE_PREVIEW_FILL = 'rgba(100, 116, 139, 0.10)';
const MARQUEE_PREVIEW_STROKE = '#475569';

/**
 * The pointer-arbitration layer for the polygon editor (issue #42). A single
 * transparent Konva rect captures pointer events across the whole world and
 * feeds them to {@link useEditorInteraction}; the drag preview (blank-drag
 * rectangle or Shift-drag marquee) is drawn here as Konva-only nodes, so React
 * document state is never touched mid-gesture. Replaces the cell-era
 * `InteractionLayer` on `GridCanvas`'s document path.
 */
export const EditorInteractionLayer = ({
  panPosition,
  zoom,
  gridSize,
  isViewportInteracting,
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
