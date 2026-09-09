import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
} from '@gridder/editor-core';
import { ShapesLayer } from './ShapesLayer';
import { createDummyDocument, createConcaveHoleDocument } from './fixtures';

/**
 * Records the path a `ShapePolygon`'s `sceneFunc` traces, by invoking it with
 * a stub Konva `Context` that just logs `moveTo` / `lineTo` calls. Used to
 * confirm the resize preview (issue #44) actually substitutes the drawn
 * geometry, not just the Konva-only Group's props.
 */
const capturedScenePath = (sceneFunc: unknown): readonly number[] => {
  const points: number[] = [];
  const stubContext = {
    beginPath: () => {},
    moveTo: (x: number, y: number) => points.push(x, y),
    lineTo: (x: number, y: number) => points.push(x, y),
    closePath: () => {},
    fillStrokeShape: () => {},
  };
  (sceneFunc as (context: unknown, shape: unknown) => void)(stubContext, {});
  return points;
};

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Shape: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-shape"
      data-name={String(props.name ?? '')}
      data-points={JSON.stringify(capturedScenePath(props.sceneFunc))}
    />
  ),
  Text: (props: Record<string, unknown>) => (
    <span
      data-testid="konva-text"
      data-name={String(props.name ?? '')}
      data-text={String(props.text ?? '')}
      data-fontsize={String(props.fontSize ?? '')}
    />
  ),
}));

/** Count the grid cells the document's shapes span (outer-ring footprint). */
const countCells = (document: EditorDocument): number => {
  let total = 0;
  for (const shape of Object.values(document.shapes)) {
    const { outerRing } = shape.polygon;
    const outerXs = outerRing.map((p) => p.x);
    const outerYs = outerRing.map((p) => p.y);
    total +=
      (Math.max(...outerXs) - Math.min(...outerXs)) *
      (Math.max(...outerYs) - Math.min(...outerYs));
  }
  return total;
};

describe('ShapesLayer', () => {
  it('test_ShapesLayer_renders_oneKonvaShapeNodePerShape', () => {
    const document = createDummyDocument({ shapeCount: 12, cellsPerShape: 9 });

    const { getAllByTestId } = render(
      <ShapesLayer document={document} gridSize={10} scale={1} />
    );

    const polygons = getAllByTestId('konva-shape');
    expect(polygons).toHaveLength(12);
    // Node count matches shape count exactly, not cell count.
    expect(polygons.length).toBe(document.zOrder.length);
  });

  it('test_ShapesLayer_nodeCount_scalesWithShapeCount_notCellCount', () => {
    const small = createDummyDocument({ shapeCount: 50, cellsPerShape: 100 });
    const large = createDummyDocument({ shapeCount: 500, cellsPerShape: 100 });

    // The large fixture is the ADR-0003 target: ~500 shapes / ~50,000 cells.
    expect(large.zOrder).toHaveLength(500);
    expect(countCells(large)).toBeGreaterThanOrEqual(45_000);
    expect(countCells(large)).toBeLessThanOrEqual(55_000);

    const smallRender = render(
      <ShapesLayer document={small} gridSize={8} scale={1} />
    );
    const smallPolygons = smallRender.getAllByTestId('konva-shape').length;
    smallRender.unmount();

    const largeRender = render(
      <ShapesLayer document={large} gridSize={8} scale={1} />
    );
    const largePolygons = largeRender.getAllByTestId('konva-shape').length;
    const largeTexts = largeRender.getAllByTestId('konva-text').length;
    largeRender.unmount();

    expect(smallPolygons).toBe(50);
    expect(largePolygons).toBe(500);
    // Polygon nodes are exactly proportional (1:1) to shape count...
    expect(largePolygons / smallPolygons).toBe(large.zOrder.length / small.zOrder.length);
    // ...and total nodes stay a small constant multiple of the shape count
    // regardless of the ~50k cells the shapes cover.
    const totalLargeNodes = largePolygons + largeTexts;
    expect(totalLargeNodes).toBeLessThanOrEqual(2 * large.zOrder.length);
  });

  it('test_ShapesLayer_rendersShapesInZOrder_backToFront', () => {
    const base = createDummyDocument({ shapeCount: 3, cellsPerShape: 4, withHole: false });
    const reordered: EditorDocument = {
      ...base,
      zOrder: ['shape-2', 'shape-0', 'shape-1'],
    };

    const { getAllByTestId } = render(
      <ShapesLayer document={reordered} gridSize={10} scale={1} />
    );

    const names = getAllByTestId('konva-shape').map((el) => el.getAttribute('data-name'));
    expect(names).toEqual([
      'shape-polygon-shape-2',
      'shape-polygon-shape-0',
      'shape-polygon-shape-1',
    ]);
  });

  it('test_ShapesLayer_skipsZOrderIdsWithNoMatchingShape', () => {
    const base = createDummyDocument({ shapeCount: 2, cellsPerShape: 4, withHole: false });
    const withGhost: EditorDocument = {
      ...base,
      zOrder: ['shape-0', 'ghost', 'shape-1'],
    };

    const { getAllByTestId } = render(
      <ShapesLayer document={withGhost} gridSize={10} scale={1} />
    );

    expect(getAllByTestId('konva-shape')).toHaveLength(2);
  });

  it('test_ShapesLayer_rendersNameAnnotationPerNamedShape', () => {
    const document = createDummyDocument({ shapeCount: 4, cellsPerShape: 9, withName: true });

    const { getAllByTestId } = render(
      <ShapesLayer document={document} gridSize={10} scale={1} />
    );

    const texts = getAllByTestId('konva-text');
    expect(texts).toHaveLength(4);
    expect(texts.map((el) => el.getAttribute('data-text'))).toEqual([
      'Shape 0',
      'Shape 1',
      'Shape 2',
      'Shape 3',
    ]);
  });

  it('test_ShapesLayer_annotationGroupScale_isInverseOfZoom_forConstantScreenSize', () => {
    const document = createConcaveHoleDocument();
    const shapeId = document.zOrder[0];

    const annotationScale = (scale: number): { group: number; font: number } => {
      const { container, getByTestId, unmount } = render(
        <ShapesLayer document={document} gridSize={10} scale={scale} />
      );
      const group = container.querySelector(`[name="shape-annotation-${shapeId}"]`);
      const result = {
        group: Number(group?.getAttribute('scaleX')),
        font: Number(getByTestId('konva-text').getAttribute('data-fontsize')),
      };
      unmount();
      return result;
    };

    const zoomedIn = annotationScale(2);
    const zoomedOut = annotationScale(0.5);

    // The label keeps its screen font size; the wrapping group is scaled by
    // 1 / zoom, so on screen (group scale * zoom) stays 1 at any zoom (#61).
    expect(zoomedIn.font).toBe(zoomedOut.font);
    expect(zoomedIn.group * 2).toBeCloseTo(1);
    expect(zoomedOut.group * 0.5).toBeCloseTo(1);
  });

  it('test_ShapesLayer_annotationFontSize_comesFromTheDocument_issue66', () => {
    const document = { ...createConcaveHoleDocument(), annotationFontSize: 20 };

    const { getByTestId } = render(<ShapesLayer document={document} gridSize={10} scale={1} />);

    expect(getByTestId('konva-text').getAttribute('data-fontsize')).toBe('20');
  });

  it('test_ShapesLayer_largerAnnotationFontSize_hidesNamesOnShapesShorterThanOneLine_issue66', () => {
    // 3x3-cell shapes at gridSize 10 are 30px on screen at zoom 1: legible
    // at 12px, but a 32px label would outgrow them.
    const base = createDummyDocument({ shapeCount: 2, cellsPerShape: 9, withName: true });

    const small = render(<ShapesLayer document={base} gridSize={10} scale={1} />);
    expect(small.getAllByTestId('konva-text')).toHaveLength(2);
    small.unmount();

    const large = render(
      <ShapesLayer document={{ ...base, annotationFontSize: 32 }} gridSize={10} scale={1} />
    );
    expect(large.queryAllByTestId('konva-text')).toHaveLength(0);
    large.unmount();
  });

  it('test_ShapesLayer_annotation_isOmittedWhenShapeIsSmallerThanOneLineOnScreen', () => {
    // 3x3-cell shapes at gridSize 10: 30px on screen at zoom 1, 3px at zoom 0.1.
    const document = createDummyDocument({ shapeCount: 2, cellsPerShape: 9, withName: true });

    const legible = render(<ShapesLayer document={document} gridSize={10} scale={1} />);
    expect(legible.getAllByTestId('konva-text')).toHaveLength(2);
    legible.unmount();

    const tooSmall = render(<ShapesLayer document={document} gridSize={10} scale={0.1} />);
    expect(tooSmall.queryAllByTestId('konva-text')).toHaveLength(0);
    tooSmall.unmount();
  });

  it('test_ShapesLayer_movePreview_offsetsOnlyTheMovingShapesGroup_issue43', () => {
    const document = createDummyDocument({ shapeCount: 3, cellsPerShape: 4, withHole: false });

    const { container } = render(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        movePreview={{ shapeIds: ['shape-1'], delta: { x: 2, y: -3 } }}
      />
    );

    const movedGroup = container.querySelector('[name="shape-move-group-shape-1"]');
    const staticGroup = container.querySelector('[name="shape-move-group-shape-0"]');
    expect(movedGroup?.getAttribute('x')).toBe('20');
    expect(movedGroup?.getAttribute('y')).toBe('-30');
    expect(staticGroup?.getAttribute('x')).toBe('0');
    expect(staticGroup?.getAttribute('y')).toBe('0');

    const movedAnnotationGroup = container.querySelector(
      '[name="shape-annotation-move-group-shape-1"]'
    );
    expect(movedAnnotationGroup?.getAttribute('x')).toBe('20');
    expect(movedAnnotationGroup?.getAttribute('y')).toBe('-30');
  });

  it('test_ShapesLayer_resizePreview_substitutesTheDrawnPolygon_forThatShapeOnly', () => {
    const document = createDummyDocument({ shapeCount: 2, cellsPerShape: 4, withHole: false });
    const shape0Before = document.shapes[document.zOrder[0]];
    const shape1Before = document.shapes[document.zOrder[1]];

    const withoutPreview = render(
      <ShapesLayer document={document} gridSize={10} scale={1} />
    );
    const shape0PointsBefore = withoutPreview
      .getAllByTestId('konva-shape')[0]
      .getAttribute('data-points');
    withoutPreview.unmount();

    const newBounds = { minX: 0, minY: 0, maxX: 20, maxY: 30 };
    const { getAllByTestId } = render(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        resizePreview={{ shapeId: shape0Before.id, bounds: newBounds }}
      />
    );
    const shapeNodes = getAllByTestId('konva-shape');
    const shape0PointsAfter = shapeNodes[0].getAttribute('data-points');
    const shape1Points = shapeNodes[1].getAttribute('data-points');

    // The previewed shape draws the new bounds' rectangle, in pixels.
    expect(JSON.parse(shape0PointsAfter ?? '[]')).toEqual([
      newBounds.minX * 10,
      newBounds.minY * 10,
      newBounds.maxX * 10,
      newBounds.minY * 10,
      newBounds.maxX * 10,
      newBounds.maxY * 10,
      newBounds.minX * 10,
      newBounds.maxY * 10,
    ]);
    expect(shape0PointsAfter).not.toBe(shape0PointsBefore);

    // The other shape's geometry is untouched.
    const untouchedRender = render(
      <ShapesLayer document={document} gridSize={10} scale={1} />
    );
    const shape1PointsWithoutPreview = untouchedRender
      .getAllByTestId('konva-shape')[1]
      .getAttribute('data-points');
    untouchedRender.unmount();
    expect(shape1Points).toBe(shape1PointsWithoutPreview);
    expect(shape1Before.id).not.toBe(shape0Before.id);
  });

  it('test_ShapesLayer_emptyDocument_rendersNoShapeNodes', () => {
    const empty: EditorDocument = {
      formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
      annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
      shapes: {},
      zOrder: [],
      groups: {},
      drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    };

    const { queryAllByTestId } = render(
      <ShapesLayer document={empty} gridSize={10} scale={1} />
    );

    expect(queryAllByTestId('konva-shape')).toHaveLength(0);
    expect(queryAllByTestId('konva-text')).toHaveLength(0);
  });
});
