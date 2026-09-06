import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { ShapeEditLayer } from './ShapeEditLayer';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Line: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-name={String(props.name ?? '')}
      data-points={JSON.stringify(props.points ?? [])}
    />
  ),
  Shape: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-shape"
      data-fill={String(props.fill ?? '')}
      data-opacity={String(props.opacity ?? '')}
      data-stroke={String(props.stroke ?? '')}
    />
  ),
}));

const rectRing = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: { outerRing: rectRing(x, y, w, h), innerRings: [] },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

describe('ShapeEditLayer', () => {
  it('test_ShapeEditLayer_dimsEveryOtherShape_notTheEditedOne', () => {
    const document = documentOf([
      rectShape('a', 0, 0, 2, 2),
      rectShape('b', 10, 10, 2, 2),
      rectShape('c', 20, 20, 2, 2),
    ]);
    const { getAllByTestId } = render(
      <ShapeEditLayer
        document={document}
        shapeId="a"
        workingPolygons={[rectShape('a', 0, 0, 2, 2).polygon]}
        gridSize={10}
      />
    );
    const shapes = getAllByTestId('konva-shape');
    // 2 dimmed "other" shapes (b, c) + 1 dimmed stale render of 'a' + 1 live
    // working-polygon render of 'a' = 4 Shape nodes.
    expect(shapes).toHaveLength(4);
  });

  it('test_ShapeEditLayer_editedShape_rendersInItsOwnStyle', () => {
    const shape: EditorShape = {
      ...rectShape('a', 0, 0, 2, 2),
      style: { fill: '#ef4444', opacity: 0.5, isBorderVisible: true },
    };
    const document = documentOf([shape]);
    const { getAllByTestId } = render(
      <ShapeEditLayer document={document} shapeId="a" workingPolygons={[shape.polygon]} gridSize={10} />
    );
    const shapes = getAllByTestId('konva-shape');
    const liveShape = shapes.find((node) => node.getAttribute('data-fill') === '#ef4444');
    expect(liveShape).toBeDefined();
    expect(liveShape?.getAttribute('data-opacity')).toBe('0.5');
  });

  it('test_ShapeEditLayer_multipleWorkingPolygons_rendersOneShapeNodePerPiece', () => {
    const shape = rectShape('a', 0, 0, 3, 1);
    const document = documentOf([shape]);
    const left = { outerRing: rectRing(0, 0, 1, 1), innerRings: [] };
    const right = { outerRing: rectRing(2, 0, 1, 1), innerRings: [] };
    const { getAllByTestId } = render(
      <ShapeEditLayer document={document} shapeId="a" workingPolygons={[left, right]} gridSize={10} />
    );
    // 1 dimmed stale 'a' + 2 live pieces = 3 Shape nodes (no other shapes exist).
    expect(getAllByTestId('konva-shape')).toHaveLength(3);
  });

  it('test_ShapeEditLayer_zeroWorkingPolygons_rendersNoLiveShape_onlyDimsTheOriginal', () => {
    const shape = rectShape('a', 0, 0, 1, 1);
    const document = documentOf([shape]);
    const { getAllByTestId } = render(
      <ShapeEditLayer document={document} shapeId="a" workingPolygons={[]} gridSize={10} />
    );
    // Only the dimmed stale render of 'a' — the shape was fully erased.
    expect(getAllByTestId('konva-shape')).toHaveLength(1);
  });

  it('test_ShapeEditLayer_rendersCellGridLines_overTheWorkingPolygonsBounds', () => {
    const shape = rectShape('a', 0, 0, 2, 2);
    const document = documentOf([shape]);
    const { container } = render(
      <ShapeEditLayer document={document} shapeId="a" workingPolygons={[shape.polygon]} gridSize={10} />
    );
    const grid = container.querySelector('[name="shape-edit-cell-grid"]');
    expect(grid).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="konva-line"]').length).toBeGreaterThan(0);
  });

  it('test_ShapeEditLayer_noWorkingPolygons_rendersNoGridLines', () => {
    const shape = rectShape('a', 0, 0, 1, 1);
    const document = documentOf([shape]);
    const { queryAllByTestId } = render(
      <ShapeEditLayer document={document} shapeId="a" workingPolygons={[]} gridSize={10} />
    );
    expect(queryAllByTestId('konva-line')).toHaveLength(0);
  });

  it('test_ShapeEditLayer_unknownShapeId_dimsEveryOtherShape_rendersNoLiveShape', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2), rectShape('b', 10, 10, 2, 2)]);
    const { getAllByTestId } = render(
      <ShapeEditLayer document={document} shapeId="missing" workingPolygons={[]} gridSize={10} />
    );
    // Both 'a' and 'b' are dimmed as "other" shapes; no edited-shape render.
    expect(getAllByTestId('konva-shape')).toHaveLength(2);
  });
});
