import { useMemo } from 'react';
import { Text } from 'react-konva';
import type { EditorDocument, PhysicalScale } from '@gridder/editor-core';
import { formatDimension, polygonBounds, shapeCellSize } from '@/features/editor';
import { estimateLabelWidth } from '../ShapesLayer/labelWidth';

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

/** Label colour, matching `ShapesLayer`'s name annotation. */
const LABEL_COLOR = '#1f2937';
/**
 * Dimension labels follow the sketch-wide annotation font size (issue #66,
 * spec §8 treats names and dimensions together) at this ratio, so they stay
 * one step smaller than the name — the pre-#66 relation of 11 px to 12 px —
 * whatever size the user picks. The result is not rounded: the label is drawn
 * inside a `1 / scale` world, so it is fractional on screen anyway.
 */
const DIMENSION_TO_ANNOTATION_FONT_RATIO = 11 / 12;
const LABEL_FONT_FAMILY = "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
/** Gap between a shape's bottom edge and its dimension label, in screen pixels. */
const LABEL_OFFSET_SCREEN = 6;

/**
 * The `Text` below is given a box this much wider than the estimated label
 * width, centred on the shape, with `wrap="none"`. Konva centres the real
 * glyphs inside the box, so centring is exact whatever the estimate; the
 * slack only guards against a font wider than `estimateLabelWidth` assumes.
 * Before issue #67 the box was the bare 0.6-em-per-character estimate and
 * Konva wrapped "10 セル × 6 セル" onto two lines in the share image.
 */
const LABEL_BOX_SLACK = 1.25;

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
  const annotationFontSize = document.annotationFontSize;

  const labels = useMemo(() => {
    const safeScale = Math.max(scale, Number.EPSILON);
    const fontSize = (annotationFontSize * DIMENSION_TO_ANNOTATION_FONT_RATIO) / safeScale;
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
        const width = estimateLabelWidth(text, fontSize) * LABEL_BOX_SLACK;
        return { id: shapeId, text, x: centerX - width / 2, y, fontSize, width };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);
  }, [document, selectedIds, gridSize, scale, physicalScale, annotationFontSize]);

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
          wrap="none"
          listening={false}
        />
      ))}
    </>
  );
};
