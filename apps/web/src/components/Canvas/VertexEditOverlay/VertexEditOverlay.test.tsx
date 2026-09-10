import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { VertexEditOverlay } from './VertexEditOverlay';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Circle: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-circle"
      data-name={String(props.name ?? '')}
      data-x={String(props.x ?? '')}
      data-y={String(props.y ?? '')}
      data-radius={String(props.radius ?? '')}
    />
  ),
  Line: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-name={String(props.name ?? '')}
      data-points={JSON.stringify(props.points ?? [])}
    />
  ),
}));

const ghostCircle = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-name="vertex-insert-ghost-circle"]');

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

const lShapeRing: GridRing = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 3 },
  { x: 3, y: 3 },
  { x: 3, y: 6 },
  { x: 0, y: 6 },
];

const lShape = (id: string): EditorShape => ({
  id,
  polygon: { outerRing: lShapeRing, innerRings: [] },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const holedShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: rectRing(0, 0, 8, 8),
    innerRings: [rectRing(2, 2, 2, 2)],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

describe('VertexEditOverlay', () => {
  it('test_VertexEditOverlay_rendersNothing_whenSelectionEmpty', () => {
    const document = documentOf([lShape('l')]);
    const { queryByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={[]} gridSize={10} scale={1} />
    );
    expect(queryByTestId('konva-group')).toBeNull();
  });

  it('test_VertexEditOverlay_rendersNothing_forAxisAlignedRect', () => {
    const document = documentOf([rectShape('r', 0, 0, 4, 4)]);
    const { queryByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['r']} gridSize={10} scale={1} />
    );
    expect(queryByTestId('konva-group')).toBeNull();
  });

  it('test_VertexEditOverlay_rendersNothing_forMultiSelection', () => {
    const document = documentOf([lShape('l'), lShape('l2')]);
    const { queryByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['l', 'l2']} gridSize={10} scale={1} />
    );
    expect(queryByTestId('konva-group')).toBeNull();
  });

  it('test_VertexEditOverlay_nonRectangularShape_drawsOneMarkerPerVertex', () => {
    const document = documentOf([lShape('l')]);
    const { getAllByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['l']} gridSize={10} scale={1} />
    );
    const markers = getAllByTestId('konva-circle').filter((el) =>
      el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
    );
    expect(markers).toHaveLength(lShapeRing.length);
  });

  it('test_VertexEditOverlay_drawsOneEdgeHitLine_forTheOuterRing', () => {
    const document = documentOf([lShape('l')]);
    const { getAllByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['l']} gridSize={10} scale={1} />
    );
    const edgeLines = getAllByTestId('konva-line');
    expect(edgeLines).toHaveLength(1);
  });

  it('test_VertexEditOverlay_holedShape_drawsMarkersAndEdgeLineForTheHoleToo', () => {
    const document = documentOf([holedShape('h')]);
    const { getAllByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['h']} gridSize={10} scale={1} />
    );
    // 4 outer + 4 inner vertices.
    const markers = getAllByTestId('konva-circle').filter((el) =>
      el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
    );
    expect(markers).toHaveLength(8);
    // One edge-hit line per ring: outer + hole.
    expect(getAllByTestId('konva-line')).toHaveLength(2);
  });

  it('test_VertexEditOverlay_vertexPreview_drawsFromPreviewPolygon_notDocument', () => {
    const document = documentOf([lShape('l')]);
    const previewPolygon = {
      outerRing: [{ x: -5, y: -5 }, ...lShapeRing.slice(1)],
      innerRings: [],
    };
    const { getAllByTestId } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['l']}
        gridSize={10}
        scale={1}
        vertexPreview={{ shapeId: 'l', polygon: previewPolygon }}
      />
    );
    const firstMarker = getAllByTestId('konva-circle').find(
      (el) => el.getAttribute('data-name') === 'vertex-edit-marker-0-0'
    );
    expect(firstMarker?.getAttribute('data-x')).toBe(String(-5 * 10));
    expect(firstMarker?.getAttribute('data-y')).toBe(String(-5 * 10));
  });

  it('test_VertexEditOverlay_vertexPreview_forADifferentShape_isIgnored', () => {
    const document = documentOf([lShape('l')]);
    const { getAllByTestId } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['l']}
        gridSize={10}
        scale={1}
        vertexPreview={{
          shapeId: 'other',
          polygon: { outerRing: [{ x: 0, y: 0 }], innerRings: [] },
        }}
      />
    );
    const firstMarker = getAllByTestId('konva-circle').find(
      (el) => el.getAttribute('data-name') === 'vertex-edit-marker-0-0'
    );
    expect(firstMarker?.getAttribute('data-x')).toBe('0');
    expect(firstMarker?.getAttribute('data-y')).toBe('0');
  });

  it('test_VertexEditOverlay_scalesMarkerSizesInverselyWithZoom', () => {
    const document = documentOf([lShape('l')]);
    const { getAllByTestId } = render(
      <VertexEditOverlay document={document} selectedIds={['l']} gridSize={10} scale={2} />
    );
    const marker = getAllByTestId('konva-circle').find((el) =>
      el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
    );
    // VERTEX_RADIUS_SCREEN (4.5) / scale (2) = 2.25.
    expect(marker?.getAttribute('data-radius')).toBe('2.25');
  });
});

describe('VertexEditOverlay — ghost vertex (issue #64)', () => {
  it('test_VertexEditOverlay_insertGhost_onSelectedRectangle_drawsGhostButNoVertexMarkers', () => {
    const document = documentOf([rectShape('r', 0, 0, 4, 4)]);
    const { container, queryAllByTestId } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['r']}
        gridSize={10}
        scale={1}
        insertGhost={{ shapeId: 'r', point: { x: 2, y: 0 } }}
      />
    );
    const ghost = ghostCircle(container);
    expect(ghost?.getAttribute('data-x')).toBe('20');
    expect(ghost?.getAttribute('data-y')).toBe('0');
    expect(ghost?.getAttribute('data-radius')).toBe('6');
    // Two "+" arms, no edge hit-line for a rectangle.
    expect(container.querySelectorAll('[data-name^="vertex-insert-ghost-plus"]')).toHaveLength(2);
    expect(
      queryAllByTestId('konva-circle').filter((el) =>
        el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
      )
    ).toHaveLength(0);
  });

  it('test_VertexEditOverlay_insertGhost_onPolygon_drawsGhostAlongsideVertexMarkers', () => {
    const document = documentOf([lShape('l')]);
    const { container, getAllByTestId } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['l']}
        gridSize={10}
        scale={2}
        insertGhost={{ shapeId: 'l', point: { x: 3, y: 0 } }}
      />
    );
    expect(ghostCircle(container)?.getAttribute('data-x')).toBe('30');
    // GHOST_RADIUS_SCREEN (6) / scale (2) = 3.
    expect(ghostCircle(container)?.getAttribute('data-radius')).toBe('3');
    const markers = getAllByTestId('konva-circle').filter((el) =>
      el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
    );
    expect(markers).toHaveLength(lShapeRing.length);
  });

  it('test_VertexEditOverlay_insertGhost_forAnUnselectedShape_isNotDrawn', () => {
    const document = documentOf([rectShape('r', 0, 0, 4, 4), rectShape('other', 10, 10, 4, 4)]);
    const { container } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['r']}
        gridSize={10}
        scale={1}
        insertGhost={{ shapeId: 'other', point: { x: 12, y: 10 } }}
      />
    );
    expect(ghostCircle(container)).toBeNull();
  });

  it('test_VertexEditOverlay_insertGhost_isHiddenWhileAVertexGestureIsLive', () => {
    const document = documentOf([lShape('l')]);
    const { container } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['l']}
        gridSize={10}
        scale={1}
        vertexPreview={{ shapeId: 'l', polygon: { outerRing: lShapeRing, innerRings: [] } }}
        insertGhost={{ shapeId: 'l', point: { x: 3, y: 0 } }}
      />
    );
    expect(ghostCircle(container)).toBeNull();
  });

  it('test_VertexEditOverlay_vertexPreview_onARectangle_drawsMarkersFromThePreview', () => {
    // A ghost drag on a rectangle: the document shape is still a rectangle,
    // but the live polygon has the inserted vertex, which must get a marker.
    const document = documentOf([rectShape('r', 0, 0, 4, 4)]);
    const previewPolygon = {
      outerRing: [{ x: 0, y: 0 }, { x: 2, y: 1 }, ...rectRing(0, 0, 4, 4).slice(1)],
      innerRings: [],
    };
    const { getAllByTestId } = render(
      <VertexEditOverlay
        document={document}
        selectedIds={['r']}
        gridSize={10}
        scale={1}
        vertexPreview={{ shapeId: 'r', polygon: previewPolygon }}
      />
    );
    const markers = getAllByTestId('konva-circle').filter((el) =>
      el.getAttribute('data-name')?.startsWith('vertex-edit-marker-')
    );
    expect(markers).toHaveLength(5);
    expect(markers[1]?.getAttribute('data-x')).toBe('20');
    expect(markers[1]?.getAttribute('data-y')).toBe('10');
  });
});
