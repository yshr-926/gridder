import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PolygonDraftLayer } from './PolygonDraftLayer';

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
      data-dash={JSON.stringify(props.dash ?? null)}
    />
  ),
  Circle: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-circle"
      data-name={String(props.name ?? '')}
      data-radius={String(props.radius ?? '')}
      data-fill={String(props.fill ?? '')}
    />
  ),
}));

describe('PolygonDraftLayer', () => {
  it('test_PolygonDraftLayer_noVerticesNoCursor_rendersNothing', () => {
    const { container } = render(
      <PolygonDraftLayer vertices={[]} cursorVertex={null} canClose={false} gridSize={10} scale={1} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('test_PolygonDraftLayer_oneVertex_rendersOnlyAMarker_noEdges', () => {
    const { queryByTestId, getAllByTestId } = render(
      <PolygonDraftLayer
        vertices={[{ x: 1, y: 1 }]}
        cursorVertex={null}
        canClose={false}
        gridSize={10}
        scale={1}
      />
    );
    expect(queryByTestId('konva-line')).toBeNull();
    expect(getAllByTestId('konva-circle')).toHaveLength(1);
  });

  it('test_PolygonDraftLayer_placedVertices_drawEdgesBetweenThem', () => {
    const { container } = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
        ]}
        cursorVertex={null}
        canClose={true}
        gridSize={10}
        scale={1}
      />
    );
    const edges = container.querySelector('[data-name="polygon-draft-edges"]');
    expect(edges).not.toBeNull();
    expect(JSON.parse(edges?.getAttribute('data-points') ?? '[]')).toEqual([
      0, 0, 40, 0, 40, 40,
    ]);
  });

  it('test_PolygonDraftLayer_cursorVertex_drawsRubberBandFromLastVertex', () => {
    const { container } = render(
      <PolygonDraftLayer
        vertices={[{ x: 0, y: 0 }]}
        cursorVertex={{ x: 5, y: 3 }}
        canClose={false}
        gridSize={10}
        scale={1}
      />
    );
    const rubberBand = container.querySelector('[data-name="polygon-draft-rubber-band"]');
    expect(rubberBand).not.toBeNull();
    expect(JSON.parse(rubberBand?.getAttribute('data-points') ?? '[]')).toEqual([0, 0, 50, 30]);
  });

  it('test_PolygonDraftLayer_canClose_drawsDashedClosingEdge_toStartVertex', () => {
    const { container } = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ]}
        cursorVertex={{ x: 6, y: 6 }}
        canClose={true}
        gridSize={10}
        scale={1}
      />
    );
    const closing = container.querySelector('[data-name="polygon-draft-closing-edge"]');
    expect(closing).not.toBeNull();
    expect(JSON.parse(closing?.getAttribute('data-points') ?? '[]')).toEqual([60, 60, 0, 0]);
    expect(JSON.parse(closing?.getAttribute('data-dash') ?? 'null')).not.toBeNull();
  });

  it('test_PolygonDraftLayer_cannotCloseYet_noClosingEdge_evenWithCursor', () => {
    const { container } = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ]}
        cursorVertex={{ x: 6, y: 6 }}
        canClose={false}
        gridSize={10}
        scale={1}
      />
    );
    expect(container.querySelector('[data-name="polygon-draft-closing-edge"]')).toBeNull();
  });

  it('test_PolygonDraftLayer_startVertex_getsARing_onlyWhenCanClose', () => {
    const withoutClose = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ]}
        cursorVertex={null}
        canClose={false}
        gridSize={10}
        scale={1}
      />
    );
    expect(withoutClose.container.querySelector('[data-name="polygon-draft-start-ring"]')).toBeNull();
    withoutClose.unmount();

    const withClose = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ]}
        cursorVertex={null}
        canClose={true}
        gridSize={10}
        scale={1}
      />
    );
    expect(withClose.container.querySelector('[data-name="polygon-draft-start-ring"]')).not.toBeNull();
  });

  it('test_PolygonDraftLayer_rendersOneMarkerPerPlacedVertex', () => {
    const { getAllByTestId } = render(
      <PolygonDraftLayer
        vertices={[
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ]}
        cursorVertex={{ x: 1, y: 1 }}
        canClose={true}
        gridSize={10}
        scale={1}
      />
    );
    // 3 vertex markers + 1 start ring.
    expect(getAllByTestId('konva-circle')).toHaveLength(4);
  });

  it('test_PolygonDraftLayer_markerRadius_isZoomInvariant', () => {
    const zoomedIn = render(
      <PolygonDraftLayer
        vertices={[{ x: 0, y: 0 }]}
        cursorVertex={null}
        canClose={false}
        gridSize={10}
        scale={4}
      />
    );
    const radiusAt4x = Number(
      zoomedIn.getAllByTestId('konva-circle')[0].getAttribute('data-radius')
    );
    zoomedIn.unmount();

    const zoomedOut = render(
      <PolygonDraftLayer
        vertices={[{ x: 0, y: 0 }]}
        cursorVertex={null}
        canClose={false}
        gridSize={10}
        scale={1}
      />
    );
    const radiusAt1x = Number(
      zoomedOut.getAllByTestId('konva-circle')[0].getAttribute('data-radius')
    );
    zoomedOut.unmount();

    // World-space radius is inversely proportional to scale, so the on-screen
    // size (radius * scale) stays constant.
    expect(radiusAt4x * 4).toBeCloseTo(radiusAt1x * 1);
  });
});
