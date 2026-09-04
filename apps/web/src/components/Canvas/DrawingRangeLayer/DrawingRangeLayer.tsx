import { useCallback, useMemo, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { GridPoint } from '@gridder/editor-core';
import {
  RESIZE_HANDLE_KINDS,
  resizeCursorForHandle,
  resizeHandlePoint,
  resizeRectBounds,
  setManualDrawingBounds,
  useDrawingBounds,
  type GridRect,
  type ResizeHandleKind,
} from '@/features/editor';
import { screenToWorld } from '@/features/viewport';
import { useSelectionStore } from '@/stores/selectionStore';

interface DrawingRangeLayerProps {
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Viewport scale. */
  scale: number;
  /** Viewport offset in screen pixels. */
  offset: { x: number; y: number };
}

/** Frame colour: neutral, distinct from the accent used for shape selection (ui-principles §3). */
const RANGE_STROKE = '#94a3b8';
const RANGE_STROKE_SCREEN_WIDTH = 1;
/** Handle fill/stroke, matching the frame's neutral tone. */
const HANDLE_FILL = '#ffffff';
const HANDLE_STROKE = '#64748b';
const HANDLE_SCREEN_SIZE = 8;
const HANDLE_HIT_SCREEN_RADIUS = 10;

const toGridRect = (bounds: { min: GridPoint; max: GridPoint }): GridRect => ({
  minX: bounds.min.x,
  minY: bounds.min.y,
  maxX: bounds.max.x,
  maxY: bounds.max.y,
});

/**
 * Draws the drawing range as a restrained rectangle with edge/corner drag
 * handles (issue #46, spec §4). Sits between the grid and the shapes layer in
 * `GridCanvas` (behind shapes, in front of the grid).
 *
 * Handles render only while nothing is selected. This is the chosen
 * resolution for "the shape handles and the drawing-range handles must not
 * compete" (issue #46's acceptance criterion): resizing a shape and resizing
 * the drawing range are both edge/corner drags anchored at the same kind of
 * position, so showing both at once would put two draggable targets at
 * overlapping screen locations whenever a selected shape sits near the
 * range's edge. Selection and the drawing range are mutually exclusive
 * focuses in this UI already (the inspector only shows for a selection), so
 * gating on "nothing selected" needs no per-pixel overlap math and never
 * hides a range handle a shape happens to be near but doesn't cover.
 *
 * The frame itself (no handles) still renders during a selection so the range
 * stays visible as a reference — only the interactive handles are withheld.
 *
 * Handle dragging is self-contained: it does not go through
 * `interactionController` (that state machine is issue #44's shape-resize
 * scope). Pointer handlers here track a local preview rectangle (Konva-only;
 * the document is untouched mid-drag) and commit exactly one
 * `SetDrawingBoundsCommand` via {@link setManualDrawingBounds} on pointer up.
 */
export const DrawingRangeLayer = ({ gridSize, scale, offset }: DrawingRangeLayerProps) => {
  const bounds = useDrawingBounds();
  const hasSelection = useSelectionStore((state) => state.selectedIds.length > 0);
  const [dragState, setDragState] = useState<{
    readonly kind: ResizeHandleKind;
    readonly startBounds: GridRect;
    readonly bounds: GridRect;
  } | null>(null);

  const safeScale = Math.max(scale, Number.EPSILON);
  const handleSizeWorld = HANDLE_SCREEN_SIZE / safeScale;
  const hitRadiusWorld = HANDLE_HIT_SCREEN_RADIUS / safeScale;

  const baseRect = useMemo(() => (bounds === null ? null : toGridRect(bounds)), [bounds]);
  const displayRect = dragState?.bounds ?? baseRect;

  const pointerToGrid = useCallback(
    (event: KonvaEventObject<PointerEvent>): GridPoint | null => {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) {
        return null;
      }
      const world = screenToWorld(pointer, { scale, offset });
      return { x: world.x / gridSize, y: world.y / gridSize };
    },
    [gridSize, scale, offset],
  );

  const handlePointerDown = useCallback(
    (kind: ResizeHandleKind) => (event: KonvaEventObject<PointerEvent>) => {
      if (baseRect === null) {
        return;
      }
      event.cancelBubble = true;
      setDragState({ kind, startBounds: baseRect, bounds: baseRect });
    },
    [baseRect],
  );

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      if (dragState === null) {
        return;
      }
      const point = pointerToGrid(event);
      if (point === null) {
        return;
      }
      const snapped: GridPoint = { x: Math.round(point.x), y: Math.round(point.y) };
      const nextBounds = resizeRectBounds(dragState.startBounds, dragState.kind, snapped);
      setDragState({ ...dragState, bounds: nextBounds });
    },
    [dragState, pointerToGrid],
  );

  const commitDrag = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      event.target.getStage()?.container().style.setProperty('cursor', '');
      // Read the drag state and clear it first, then dispatch the Command
      // afterward: `setManualDrawingBounds` synchronously notifies document
      // subscribers, so calling it from inside the `setDragState` updater
      // (React state reducers must stay pure) would update this component
      // while React is still processing its own state transition.
      if (dragState !== null) {
        const { minX, minY, maxX, maxY } = dragState.bounds;
        setDragState(null);
        setManualDrawingBounds({ x: minX, y: minY }, { x: maxX, y: maxY });
      }
    },
    [dragState],
  );

  const handlePointerEnter = useCallback(
    (kind: ResizeHandleKind) => (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (stage) {
        stage.container().style.cursor = `${resizeCursorForHandle(kind)}-resize`;
      }
    },
    [],
  );

  const handlePointerLeave = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (stage && dragState === null) {
        stage.container().style.cursor = '';
      }
    },
    [dragState],
  );

  if (displayRect === null) {
    return null;
  }

  const x = displayRect.minX * gridSize;
  const y = displayRect.minY * gridSize;
  const width = (displayRect.maxX - displayRect.minX) * gridSize;
  const height = (displayRect.maxY - displayRect.minY) * gridSize;

  const showHandles = !hasSelection;

  return (
    <Group
      name="drawing-range"
      onPointerMove={handlePointerMove}
      onPointerUp={commitDrag}
      onPointerCancel={() => setDragState(null)}
    >
      <Rect
        name="drawing-range-frame"
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={RANGE_STROKE}
        strokeWidth={RANGE_STROKE_SCREEN_WIDTH}
        strokeScaleEnabled={false}
        listening={false}
      />
      {showHandles &&
        RESIZE_HANDLE_KINDS.map((kind) => {
          const point = resizeHandlePoint(displayRect, kind);
          return (
            <Rect
              key={kind}
              name={`drawing-range-handle-${kind}`}
              x={point.x * gridSize - handleSizeWorld / 2}
              y={point.y * gridSize - handleSizeWorld / 2}
              width={handleSizeWorld}
              height={handleSizeWorld}
              fill={HANDLE_FILL}
              stroke={HANDLE_STROKE}
              strokeWidth={1}
              strokeScaleEnabled={false}
              hitStrokeWidth={hitRadiusWorld}
              onPointerDown={handlePointerDown(kind)}
              onPointerEnter={handlePointerEnter(kind)}
              onPointerLeave={handlePointerLeave}
            />
          );
        })}
    </Group>
  );
};
