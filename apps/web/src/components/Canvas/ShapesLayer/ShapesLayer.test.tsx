import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
} from '@gridder/editor-core';
import { ShapesLayer } from './ShapesLayer';
import { createDummyDocument, createConcaveHoleDocument } from './fixtures';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Shape: (props: Record<string, unknown>) => (
    <div data-testid="konva-shape" data-name={String(props.name ?? '')} />
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

  it('test_ShapesLayer_annotationFontSize_growsAsZoomShrinks_forConstantScreenSize', () => {
    const document = createConcaveHoleDocument();

    const zoomedIn = render(<ShapesLayer document={document} gridSize={10} scale={2} />);
    const fontAt2x = Number(
      zoomedIn.getByTestId('konva-text').getAttribute('data-fontsize')
    );
    zoomedIn.unmount();

    const zoomedOut = render(<ShapesLayer document={document} gridSize={10} scale={0.5} />);
    const fontAtHalf = Number(
      zoomedOut.getByTestId('konva-text').getAttribute('data-fontsize')
    );
    zoomedOut.unmount();

    // World font size is inversely proportional to scale, so the on-screen size
    // (fontSize * scale) stays constant.
    expect(fontAt2x * 2).toBeCloseTo(fontAtHalf * 0.5);
  });

  it('test_ShapesLayer_emptyDocument_rendersNoShapeNodes', () => {
    const empty: EditorDocument = {
      formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
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
