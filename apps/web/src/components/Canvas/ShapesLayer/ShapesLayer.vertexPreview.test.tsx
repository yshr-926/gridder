import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CURRENT_DOCUMENT_FORMAT_VERSION, type EditorDocument, type EditorShape } from '@gridder/editor-core';
import { ShapesLayer } from './ShapesLayer';

/**
 * `vertexPreview` prop substitution (issue #50). Split from
 * `ShapesLayer.test.tsx` so parallel work on that file's other preview cases
 * doesn't collide here.
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
    <span data-testid="konva-text" data-name={String(props.name ?? '')} />
  ),
}));

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

describe('ShapesLayer — vertexPreview (issue #50)', () => {
  it('test_ShapesLayer_vertexPreview_substitutesTheDrawnPolygon_forThatShapeOnly', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 10, 3, 3)]);

    const previewPolygon = {
      outerRing: [
        { x: -2, y: -2 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    };
    const { getAllByTestId } = render(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        vertexPreview={{ shapeId: 'a', polygon: previewPolygon }}
      />
    );
    const shapeNodes = getAllByTestId('konva-shape');
    const aPoints = JSON.parse(shapeNodes[0].getAttribute('data-points') ?? '[]');
    const bPoints = JSON.parse(shapeNodes[1].getAttribute('data-points') ?? '[]');

    expect(aPoints).toEqual([-20, -20, 40, 0, 40, 40, 0, 40]);
    // The other shape's geometry is untouched.
    expect(bPoints).toEqual([100, 100, 130, 100, 130, 130, 100, 130]);
  });

  it('test_ShapesLayer_noVertexPreview_drawsDocumentGeometry', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { getAllByTestId } = render(<ShapesLayer document={document} gridSize={10} scale={1} />);
    const points = JSON.parse(getAllByTestId('konva-shape')[0].getAttribute('data-points') ?? '[]');
    expect(points).toEqual([0, 0, 40, 0, 40, 40, 0, 40]);
  });
});
