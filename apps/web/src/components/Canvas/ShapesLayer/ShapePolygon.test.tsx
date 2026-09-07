import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { EditorShape } from '@gridder/editor-core';
import { ShapePolygon } from './ShapePolygon';
import { DEFAULT_SHAPES_LAYER_THEME } from './shapesLayerTheme';

interface CapturedShapeProps {
  sceneFunc: (context: Context, shape: KonvaShape) => void;
  hitFunc: (context: Context, shape: KonvaShape) => void;
  fill: string;
  opacity: number;
  fillRule: string;
  stroke?: string;
  strokeEnabled: boolean;
  hitStrokeWidth: number;
  perfectDrawEnabled: boolean;
  name: string;
}

const captured: { props: CapturedShapeProps | null } = { props: null };

vi.mock('react-konva', () => ({
  Shape: (props: CapturedShapeProps) => {
    captured.props = props;
    return <div data-testid="konva-shape" data-name={props.name} />;
  },
}));

/** Minimal fake Konva context that records the path commands issued to it. */
const createFakeContext = () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    beginPath: () => calls.push(['beginPath']),
    closePath: () => calls.push(['closePath']),
    moveTo: (x: number, y: number) => calls.push(['moveTo', x, y]),
    lineTo: (x: number, y: number) => calls.push(['lineTo', x, y]),
    fillStrokeShape: () => calls.push(['fillStrokeShape']),
  } as unknown as Context;
  return { context, calls };
};

const rectShape = (): EditorShape => ({
  id: 'rect-1',
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ],
    innerRings: [
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
      ],
    ],
  },
  style: { fill: '#3b82f6', opacity: 0.5, isBorderVisible: true },
  name: 'Rect',
});

const concaveShape = (): EditorShape => ({
  id: 'concave-1',
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 6 },
      { x: 0, y: 6 },
    ],
    innerRings: [],
  },
  style: { fill: '#ef4444', opacity: 1, isBorderVisible: false },
});

describe('ShapePolygon', () => {
  it('test_ShapePolygon_rendersExactlyOneKonvaNode', () => {
    const { getAllByTestId } = render(<ShapePolygon shape={rectShape()} gridSize={10} />);

    expect(getAllByTestId('konva-shape')).toHaveLength(1);
  });

  it('test_ShapePolygon_passesStyleAndEvenoddFillRule', () => {
    render(<ShapePolygon shape={rectShape()} gridSize={10} />);

    const props = captured.props;
    expect(props).not.toBeNull();
    expect(props?.fill).toBe('#3b82f6');
    expect(props?.opacity).toBe(0.5);
    expect(props?.fillRule).toBe('evenodd');
    expect(props?.stroke).toBe(DEFAULT_SHAPES_LAYER_THEME.borderColor);
    expect(props?.strokeEnabled).toBe(true);
    expect(props?.hitStrokeWidth).toBe(DEFAULT_SHAPES_LAYER_THEME.hitStrokeWidth);
    expect(props?.name).toBe('shape-polygon-rect-1');
  });

  it('test_ShapePolygon_disablesPerfectDraw_toSkipKonvaBufferCanvas', () => {
    // Issue #61: with fill + stroke + opacity < 1, Konva's default would
    // composite every shape through a full-layer buffer canvas (~93 ms/frame
    // of raster for the spec §14 baseline).
    render(<ShapePolygon shape={rectShape()} gridSize={10} />);

    expect(captured.props?.perfectDrawEnabled).toBe(false);
  });

  it('test_ShapePolygon_borderHidden_disablesStroke', () => {
    render(<ShapePolygon shape={concaveShape()} gridSize={10} />);

    expect(captured.props?.strokeEnabled).toBe(false);
    expect(captured.props?.stroke).toBeUndefined();
  });

  it('test_ShapePolygon_sceneFunc_tracesOuterRingAndHoleAsSubpaths', () => {
    render(<ShapePolygon shape={rectShape()} gridSize={10} />);
    const { context, calls } = createFakeContext();

    captured.props?.sceneFunc(context, {} as KonvaShape);

    // One beginPath, one fillStrokeShape, one closePath per ring (outer + hole).
    expect(calls.filter(c => c[0] === 'beginPath')).toHaveLength(1);
    expect(calls.filter(c => c[0] === 'closePath')).toHaveLength(2);
    expect(calls.filter(c => c[0] === 'moveTo')).toHaveLength(2);
    expect(calls.filter(c => c[0] === 'fillStrokeShape')).toHaveLength(1);

    // Outer ring scaled by gridSize, first move at origin.
    expect(calls).toContainEqual(['moveTo', 0, 0]);
    expect(calls).toContainEqual(['lineTo', 40, 0]);
    // Hole ring scaled by gridSize.
    expect(calls).toContainEqual(['moveTo', 10, 10]);
    expect(calls).toContainEqual(['lineTo', 30, 30]);
  });

  it('test_ShapePolygon_sceneFunc_tracesConcaveOuterRingFaithfully', () => {
    render(<ShapePolygon shape={concaveShape()} gridSize={1} />);
    const { context, calls } = createFakeContext();

    captured.props?.sceneFunc(context, {} as KonvaShape);

    const vertexCalls = calls.filter(c => c[0] === 'moveTo' || c[0] === 'lineTo');
    // 8 vertices of the U-shape, no simplification.
    expect(vertexCalls).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 6, 0],
      ['lineTo', 6, 6],
      ['lineTo', 4, 6],
      ['lineTo', 4, 3],
      ['lineTo', 2, 3],
      ['lineTo', 2, 6],
      ['lineTo', 0, 6],
    ]);
  });

  it('test_ShapePolygon_hitFunc_tracesSamePolygonPathAsScene', () => {
    render(<ShapePolygon shape={rectShape()} gridSize={10} />);
    const scene = createFakeContext();
    const hit = createFakeContext();

    captured.props?.sceneFunc(scene.context, {} as KonvaShape);
    captured.props?.hitFunc(hit.context, {} as KonvaShape);

    expect(hit.calls).toEqual(scene.calls);
  });
});
