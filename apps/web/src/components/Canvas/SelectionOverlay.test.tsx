import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { SelectionOverlay } from './SelectionOverlay';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-name={String(props.name ?? '')}
      data-x={String(props.x ?? '')}
      data-y={String(props.y ?? '')}
      data-width={String(props.width ?? '')}
      data-height={String(props.height ?? '')}
      data-stroke-width={String(props.strokeWidth ?? '')}
      data-stroke-scale-enabled={String(props.strokeScaleEnabled ?? '')}
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

describe('SelectionOverlay', () => {
  it('test_SelectionOverlay_rendersNothing_whenSelectionEmpty', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { queryByTestId } = render(
      <SelectionOverlay document={document} selectedIds={[]} gridSize={10} scale={1} />
    );
    expect(queryByTestId('konva-group')).toBeNull();
  });

  it('test_SelectionOverlay_drawsOneFramePerSelectedShape', () => {
    const document = documentOf([
      rectShape('a', 0, 0, 4, 4),
      rectShape('b', 6, 0, 3, 3),
    ]);
    const { getAllByTestId } = render(
      <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
    );
    const frames = getAllByTestId('konva-rect');
    expect(frames).toHaveLength(2);
    expect(frames.map((el) => el.getAttribute('data-name'))).toEqual([
      'selection-frame-a',
      'selection-frame-b',
    ]);
  });

  it('test_SelectionOverlay_skipsSelectedIdWithNoMatchingShape', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { getAllByTestId } = render(
      <SelectionOverlay document={document} selectedIds={['a', 'ghost']} gridSize={10} scale={1} />
    );
    expect(getAllByTestId('konva-rect')).toHaveLength(1);
  });

  it('test_SelectionOverlay_framePadding_shrinksInWorldUnitsAsZoomGrows_forConstantScreenSize', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);

    const zoomedIn = render(
      <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={4} />
    );
    const wideWidth = Number(
      zoomedIn.getByTestId('konva-rect').getAttribute('data-width')
    );
    zoomedIn.unmount();

    const zoomedOut = render(
      <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    const narrowWidth = Number(
      zoomedOut.getByTestId('konva-rect').getAttribute('data-width')
    );
    zoomedOut.unmount();

    // World-space padding is inversely proportional to scale, so the frame at
    // higher zoom is tighter around the 40px shape.
    expect(wideWidth).toBeLessThan(narrowWidth);
    expect(wideWidth).toBeGreaterThan(40);
  });

  it('test_SelectionOverlay_frameStroke_isZoomInvariant', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { getByTestId } = render(
      <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={2.5} />
    );
    const frame = getByTestId('konva-rect');
    expect(frame.getAttribute('data-stroke-scale-enabled')).toBe('false');
    expect(Number(frame.getAttribute('data-stroke-width'))).toBeGreaterThan(0);
  });
});
