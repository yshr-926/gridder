import { useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type { EditorDocument } from '@gridder/editor-core';
import { polygonBounds } from '@/features/editor';

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
}

/** Selection frame colour (single accent per ui-principles §3). */
const SELECTION_STROKE = '#2563eb';
/** Frame width in screen pixels, held constant across zoom (ui-principles §5). */
const SELECTION_STROKE_SCREEN_WIDTH = 1.5;
/** Screen-pixel padding so the frame sits just outside the shape. */
const SELECTION_PADDING_SCREEN = 2;

/**
 * Draws a rectangular frame around every selected shape on its own overlay
 * layer (issue #42). Only the frame is drawn here; resize / vertex handles are
 * issue #44. `strokeScaleEnabled={false}` plus dividing the world-space padding
 * by `scale` keeps the outline the same thickness and offset on screen at any
 * zoom.
 */
export const SelectionOverlay = ({
  document,
  selectedIds,
  gridSize,
  scale,
}: SelectionOverlayProps) => {
  const frames = useMemo(() => {
    const safeScale = Math.max(scale, Number.EPSILON);
    const padWorld = SELECTION_PADDING_SCREEN / safeScale;

    return selectedIds
      .map((shapeId) => {
        const shape = document.shapes[shapeId];
        if (shape === undefined) {
          return null;
        }
        const bounds = polygonBounds(shape.polygon);
        return {
          id: shapeId,
          x: bounds.minX * gridSize - padWorld,
          y: bounds.minY * gridSize - padWorld,
          width: (bounds.maxX - bounds.minX) * gridSize + padWorld * 2,
          height: (bounds.maxY - bounds.minY) * gridSize + padWorld * 2,
        };
      })
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null);
  }, [document, selectedIds, gridSize, scale]);

  if (frames.length === 0) {
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
    </Group>
  );
};
