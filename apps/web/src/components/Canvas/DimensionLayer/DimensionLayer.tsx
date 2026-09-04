import { useMemo } from 'react';
import { Text } from 'react-konva';
import type { EditorDocument, PhysicalScale } from '@gridder/editor-core';
import { formatDimension, polygonBounds, shapeCellSize } from '@/features/editor';

interface DimensionLayerProps {
  /** Current document snapshot. */
  document: EditorDocument;
  /** IDs of the selected shapes (spec §8: dimensions show for the selection). */
  selectedIds: readonly string[];
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Viewport scale — used to keep the label a constant screen size. */
  scale: number;
}

/** Label colour and size, matching `ShapesLayer`'s name annotation (screen pixels, zoom-invariant). */
const LABEL_COLOR = '#1f2937';
const LABEL_FONT_SIZE_SCREEN = 11;
const LABEL_FONT_FAMILY =
  "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
/** Gap between a shape's bottom edge and its dimension label, in screen pixels. */
const LABEL_OFFSET_SCREEN = 6;

/** Rough on-screen width of the label, used only to centre it horizontally. */
const estimateLabelWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.6;

/**
 * Draws each selected shape's width × height beneath its bounding box (issue
 * #53, spec §8). Independent Konva layer — it reads the document and
 * selection but never the other way around, and doesn't touch
 * `SelectionOverlay` / `ShapesLayer` / `interactionController` (all mid-edit
 * for #44 concurrently). "N セル" when the sketch has no real-world scale,
 * a unit-suffixed length once one is set — both come from
 * `@gridder/editor-core`'s `formatDimension`, the same function the
 * inspector uses, so the two surfaces never disagree.
 */
export const DimensionLayer = ({ document, selectedIds, gridSize, scale }: DimensionLayerProps) => {
  const physicalScale: PhysicalScale | undefined = document.physicalScale;

  const labels = useMemo(() => {
    const safeScale = Math.max(scale, Number.EPSILON);
    const fontSize = LABEL_FONT_SIZE_SCREEN / safeScale;
    const offset = LABEL_OFFSET_SCREEN / safeScale;

    return selectedIds
      .map((shapeId) => {
        const shape = document.shapes[shapeId];
        if (shape === undefined) {
          return null;
        }
        const bounds = polygonBounds(shape.polygon);
        const { widthCells, heightCells } = shapeCellSize(shape.polygon);
        const text = `${formatDimension(widthCells, physicalScale)} × ${formatDimension(heightCells, physicalScale)}`;
        const centerX = ((bounds.minX + bounds.maxX) / 2) * gridSize;
        const y = bounds.maxY * gridSize + offset;
        const width = estimateLabelWidth(text, fontSize);
        return { id: shapeId, text, x: centerX - width / 2, y, fontSize, width };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);
  }, [document, selectedIds, gridSize, scale, physicalScale]);

  if (labels.length === 0) {
    return null;
  }

  return (
    <>
      {labels.map((label) => (
        <Text
          key={label.id}
          name={`dimension-label-${label.id}`}
          x={label.x}
          y={label.y}
          width={label.width}
          text={label.text}
          fontSize={label.fontSize}
          fontFamily={LABEL_FONT_FAMILY}
          fill={LABEL_COLOR}
          align="center"
          listening={false}
        />
      ))}
    </>
  );
};
