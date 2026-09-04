import { useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type { EditorDocument, GridPolygon } from '@gridder/editor-core';
import {
  isAxisAlignedRect,
  polygonBounds,
  RESIZE_HANDLE_KINDS,
  resizeHandlePoint,
  type GridRect,
} from '@/features/editor';
import type { ShapesLayerMovePreview } from './ShapesLayer';

/** A rectangle resize in progress (issue #44), or `undefined` when idle. */
export interface SelectionOverlayResizePreview {
  readonly shapeId: string;
  /** Live flip-normalised bounds, replacing the shape's document geometry. */
  readonly bounds: GridRect;
}

/**
 * SelectionOverlay Props
 */
interface SelectionOverlayProps {
  /** Current document snapshot (bounding boxes come from here). */
  document: EditorDocument;
  /** IDs of the selected shapes. */
  selectedIds: readonly string[];
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Viewport scale — used to keep the frame a constant screen width. */
  scale: number;
  /**
   * Live move-gesture offset (issue #43). A selected shape's frame follows
   * its Konva node during the drag instead of lagging behind at the
   * pre-drag document position.
   */
  movePreview?: ShapesLayerMovePreview;
  /**
   * Live resize-gesture bounds (issue #44). The frame and handles are drawn
   * from this instead of the document polygon while the resized shape's
   * gesture is in progress.
   */
  resizePreview?: SelectionOverlayResizePreview;
}

/** Selection frame colour (single accent per ui-principles §3). */
const SELECTION_STROKE = '#2563eb';
/** Frame width in screen pixels, held constant across zoom (ui-principles §5). */
const SELECTION_STROKE_SCREEN_WIDTH = 1.5;
/** Screen-pixel padding so the frame sits just outside the shape. */
const SELECTION_PADDING_SCREEN = 2;

/** Resize handle square size, in screen pixels (fixed regardless of zoom). */
const HANDLE_SIZE_SCREEN = 7;
/** Resize handle fill / stroke — same accent as the selection frame. */
const HANDLE_FILL = '#ffffff';
const HANDLE_STROKE = SELECTION_STROKE;
const HANDLE_STROKE_WIDTH_SCREEN = 1.5;
/**
 * Invisible hit-area square drawn under each handle, larger than what's
 * shown (issue #44 "hit 領域は表示より広くする"). The actual hit-testing that
 * decides a pointer-down grabs a handle happens in `reduceInteraction`
 * (grid-space, via `resizeHandleAtPoint`) — this square exists only so the
 * cursor changes on hover before a drag starts; it does not itself capture
 * pointer events (the shared `EditorInteractionLayer` surface does).
 */
const HANDLE_HIT_SIZE_SCREEN = 20;

/** True when exactly one shape is selected and it is a resizable rectangle. */
const singleResizableShape = (
  document: EditorDocument,
  selectedIds: readonly string[]
): { readonly id: string; readonly polygon: GridPolygon } | null => {
  if (selectedIds.length !== 1) {
    return null;
  }
  const shape = document.shapes[selectedIds[0]];
  if (shape === undefined || !isAxisAlignedRect(shape.polygon)) {
    return null;
  }
  return { id: shape.id, polygon: shape.polygon };
};

/**
 * Draws a rectangular frame around every selected shape, plus — when exactly
 * one selected shape is an axis-aligned rectangle — 8 resize handles at its
 * edges and corners (issue #44, spec §6.2). `strokeScaleEnabled={false}` plus
 * dividing world-space sizes by `scale` keeps every stroke and handle a
 * constant screen size at any zoom.
 */
export const SelectionOverlay = ({
  document,
  selectedIds,
  gridSize,
  scale,
  movePreview,
  resizePreview,
}: SelectionOverlayProps) => {
  const safeScale = Math.max(scale, Number.EPSILON);

  const frames = useMemo(() => {
    const padWorld = SELECTION_PADDING_SCREEN / safeScale;

    return selectedIds
      .map((shapeId) => {
        const shape = document.shapes[shapeId];
        if (shape === undefined) {
          return null;
        }
        const isResizing = resizePreview !== undefined && resizePreview.shapeId === shapeId;
        const bounds = isResizing ? resizePreview.bounds : polygonBounds(shape.polygon);
        const isMoving =
          !isResizing && movePreview !== undefined && movePreview.shapeIds.includes(shapeId);
        const offsetX = isMoving ? movePreview.delta.x * gridSize : 0;
        const offsetY = isMoving ? movePreview.delta.y * gridSize : 0;
        return {
          id: shapeId,
          x: bounds.minX * gridSize - padWorld + offsetX,
          y: bounds.minY * gridSize - padWorld + offsetY,
          width: (bounds.maxX - bounds.minX) * gridSize + padWorld * 2,
          height: (bounds.maxY - bounds.minY) * gridSize + padWorld * 2,
        };
      })
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null);
  }, [document, selectedIds, gridSize, movePreview, resizePreview, safeScale]);

  const handles = useMemo(() => {
    const resizable = singleResizableShape(document, selectedIds);
    if (resizable === null) {
      return [];
    }
    const isResizing = resizePreview !== undefined && resizePreview.shapeId === resizable.id;
    const bounds = isResizing ? resizePreview.bounds : polygonBounds(resizable.polygon);
    const handleWorld = HANDLE_SIZE_SCREEN / safeScale;
    const hitWorld = HANDLE_HIT_SIZE_SCREEN / safeScale;

    return RESIZE_HANDLE_KINDS.map((kind) => {
      const point = resizeHandlePoint(bounds, kind);
      return {
        kind,
        x: point.x * gridSize,
        y: point.y * gridSize,
        handleWorld,
        hitWorld,
      };
    });
  }, [document, selectedIds, resizePreview, gridSize, safeScale]);

  if (frames.length === 0 && handles.length === 0) {
    return null;
  }

  return (
    <Group name="selection-overlay" listening={false}>
      {frames.map((frame) => (
        <Rect
          key={frame.id}
          name={`selection-frame-${frame.id}`}
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          stroke={SELECTION_STROKE}
          strokeWidth={SELECTION_STROKE_SCREEN_WIDTH}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {handles.map((handle) => (
        <Group key={handle.kind}>
          <Rect
            name={`resize-handle-hit-${handle.kind}`}
            x={handle.x - handle.hitWorld / 2}
            y={handle.y - handle.hitWorld / 2}
            width={handle.hitWorld}
            height={handle.hitWorld}
            fill="transparent"
            listening={false}
          />
          <Rect
            name={`resize-handle-${handle.kind}`}
            x={handle.x - handle.handleWorld / 2}
            y={handle.y - handle.handleWorld / 2}
            width={handle.handleWorld}
            height={handle.handleWorld}
            fill={HANDLE_FILL}
            stroke={HANDLE_STROKE}
            strokeWidth={HANDLE_STROKE_WIDTH_SCREEN}
            strokeScaleEnabled={false}
            listening={false}
          />
        </Group>
      ))}
    </Group>
  );
};
