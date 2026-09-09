import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
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

const documentOf = (
  shapes: readonly EditorShape[],
  groups: Record<string, readonly string[]> = {},
): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: Object.fromEntries(
    Object.entries(groups).map(([groupId, shapeIds]) => [groupId, { id: groupId, shapeIds }]),
  ),
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
      zoomedIn.container
        .querySelector('[data-name="selection-frame-a"]')
        ?.getAttribute('data-width')
    );
    zoomedIn.unmount();

    const zoomedOut = render(
      <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    const narrowWidth = Number(
      zoomedOut.container
        .querySelector('[data-name="selection-frame-a"]')
        ?.getAttribute('data-width')
    );
    zoomedOut.unmount();

    // World-space padding is inversely proportional to scale, so the frame at
    // higher zoom is tighter around the 40px shape.
    expect(wideWidth).toBeLessThan(narrowWidth);
    expect(wideWidth).toBeGreaterThan(40);
  });

  it('test_SelectionOverlay_frameStroke_isZoomInvariant', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { container } = render(
      <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={2.5} />
    );
    const frame = container.querySelector('[data-name="selection-frame-a"]');
    expect(frame?.getAttribute('data-stroke-scale-enabled')).toBe('false');
    expect(Number(frame?.getAttribute('data-stroke-width'))).toBeGreaterThan(0);
  });

  it('test_SelectionOverlay_movePreview_offsetsOnlyTheMovingShapesFrame_issue43', () => {
    const document = documentOf([
      rectShape('a', 0, 0, 4, 4),
      rectShape('b', 10, 0, 4, 4),
    ]);
    const withoutPreview = render(
      <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
    );
    const [beforeA, beforeB] = ['a', 'b'].map((id) => {
      const frame = withoutPreview.container.querySelector(`[data-name="selection-frame-${id}"]`);
      return { x: Number(frame?.getAttribute('data-x')), y: Number(frame?.getAttribute('data-y')) };
    });
    withoutPreview.unmount();

    const withPreview = render(
      <SelectionOverlay
        document={document}
        selectedIds={['a', 'b']}
        gridSize={10}
        scale={1}
        movePreview={{ shapeIds: ['a'], delta: { x: 2, y: -1 } }}
      />
    );
    const frameA = withPreview.container.querySelector('[data-name="selection-frame-a"]');
    const frameB = withPreview.container.querySelector('[data-name="selection-frame-b"]');

    // 'a' is in the move preview: its frame shifts by delta * gridSize.
    expect(Number(frameA?.getAttribute('data-x'))).toBeCloseTo(beforeA.x + 20);
    expect(Number(frameA?.getAttribute('data-y'))).toBeCloseTo(beforeA.y - 10);
    // 'b' is selected but not part of the move: its frame stays put.
    expect(Number(frameB?.getAttribute('data-x'))).toBeCloseTo(beforeB.x);
    expect(Number(frameB?.getAttribute('data-y'))).toBeCloseTo(beforeB.y);
  });

  describe('resize handles (issue #44)', () => {
    it('test_SelectionOverlay_singleSelectedRect_rendersEightHandles', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
      );
      const handles = container.querySelectorAll('[data-name^="resize-handle-"]');
      // 8 visible handles + 8 invisible hit-area squares.
      expect(handles).toHaveLength(16);
      for (const kind of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        expect(container.querySelector(`[data-name="resize-handle-${kind}"]`)).not.toBeNull();
      }
    });

    it('test_SelectionOverlay_multipleSelected_rendersNoHandles', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4), rectShape('b', 6, 0, 3, 3)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
      );
      expect(container.querySelectorAll('[data-name^="resize-handle-"]')).toHaveLength(0);
    });

    it('test_SelectionOverlay_nonRectangularPolygon_rendersNoHandles', () => {
      const triangle: EditorShape = {
        id: 't',
        polygon: {
          outerRing: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 2, y: 4 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
      };
      const document = documentOf([triangle]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['t']} gridSize={10} scale={1} />
      );
      expect(container.querySelectorAll('[data-name^="resize-handle-"]')).toHaveLength(0);
    });

    it('test_SelectionOverlay_handlePositions_matchTheRectBoundsInPixels', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 6)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
      );
      const nw = container.querySelector('[data-name="resize-handle-nw"]');
      const se = container.querySelector('[data-name="resize-handle-se"]');
      // Handle rects are centred on the exact grid position (0,0) and
      // (4,6)*10 = (40,60) respectively — x/y here is the top-left corner of
      // a small square, so it sits slightly negative / short of that point.
      expect(Number(nw?.getAttribute('data-x'))).toBeLessThan(0);
      expect(Number(nw?.getAttribute('data-y'))).toBeLessThan(0);
      const seX = Number(se?.getAttribute('data-x'));
      const seY = Number(se?.getAttribute('data-y'));
      expect(seX).toBeGreaterThan(30);
      expect(seY).toBeGreaterThan(50);
    });

    it('test_SelectionOverlay_handleHitArea_isLargerThanTheVisibleHandle', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
      );
      const visible = container.querySelector('[data-name="resize-handle-nw"]');
      const hit = container.querySelector('[data-name="resize-handle-hit-nw"]');
      const visibleWidth = Number(visible?.getAttribute('data-width'));
      const hitWidth = Number(hit?.getAttribute('data-width'));
      expect(hitWidth).toBeGreaterThan(visibleWidth);
    });

    it('test_SelectionOverlay_resizePreview_handlesFollowLiveBounds', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      const { container } = render(
        <SelectionOverlay
          document={document}
          selectedIds={['a']}
          gridSize={10}
          scale={1}
          resizePreview={{ shapeId: 'a', bounds: { minX: 0, minY: 0, maxX: 9, maxY: 4 } }}
        />
      );
      // The 'e' handle should now sit at grid x=9 (pixel 90), not the
      // document's x=4 (pixel 40).
      const east = container.querySelector('[data-name="resize-handle-e"]');
      const eastX = Number(east?.getAttribute('data-x'));
      expect(eastX).toBeGreaterThan(80);
    });

    it('test_SelectionOverlay_vertexPreview_onTheRect_hidesHandles_andFrameFollowsPreview_issue64', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      // A ghost-vertex drag pulled a new vertex out to (2,-3): the live
      // polygon is no longer a rectangle, so no handles, and the frame grows.
      const { container } = render(
        <SelectionOverlay
          document={document}
          selectedIds={['a']}
          gridSize={10}
          scale={1}
          vertexPreview={{
            shapeId: 'a',
            polygon: {
              outerRing: [
                { x: 0, y: 0 },
                { x: 2, y: -3 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
                { x: 0, y: 4 },
              ],
              innerRings: [],
            },
          }}
        />
      );
      expect(container.querySelectorAll('[data-name^="resize-handle-"]')).toHaveLength(0);
      const frame = container.querySelector('[data-name="selection-frame-a"]');
      expect(Number(frame?.getAttribute('data-y'))).toBeLessThan(-30 + 1);
    });

    it('test_SelectionOverlay_handleSize_isZoomInvariant', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      const zoomedIn = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={4} />
      );
      const widthAt4x = Number(
        zoomedIn.container.querySelector('[data-name="resize-handle-nw"]')?.getAttribute('data-width')
      );
      zoomedIn.unmount();

      const zoomedOut = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
      );
      const widthAt1x = Number(
        zoomedOut.container.querySelector('[data-name="resize-handle-nw"]')?.getAttribute('data-width')
      );
      zoomedOut.unmount();

      // World-space handle size is inversely proportional to scale, so the
      // on-screen size (width * scale) stays constant.
      expect(widthAt4x * 4).toBeCloseTo(widthAt1x * 1);
    });
  });

  describe('group bounding frame (issue #52)', () => {
    it('test_SelectionOverlay_wholeGroupSelected_drawsGroupFrame', () => {
      const document = documentOf(
        [rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 0, 4, 4)],
        { 'group-1': ['a', 'b'] },
      );
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
      );
      const groupFrame = container.querySelector('[data-name="selection-group-frame"]');
      expect(groupFrame).not.toBeNull();
      // Spans from shape a's left edge to shape b's right edge.
      expect(Number(groupFrame?.getAttribute('data-width'))).toBeGreaterThan(140);
    });

    it('test_SelectionOverlay_singleShapeSelected_noGroupFrame', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a']} gridSize={10} scale={1} />
      );
      expect(container.querySelector('[data-name="selection-group-frame"]')).toBeNull();
    });

    it('test_SelectionOverlay_ungroupedMultiSelection_noGroupFrame', () => {
      const document = documentOf([rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 0, 4, 4)]);
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
      );
      expect(container.querySelector('[data-name="selection-group-frame"]')).toBeNull();
    });

    it('test_SelectionOverlay_partialGroupSelection_noGroupFrame', () => {
      const document = documentOf(
        [rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 0, 4, 4), rectShape('c', 20, 0, 4, 4)],
        { 'group-1': ['a', 'b', 'c'] },
      );
      // Only two of the group's three members are selected.
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
      );
      expect(container.querySelector('[data-name="selection-group-frame"]')).toBeNull();
    });

    it('test_SelectionOverlay_groupFrame_isDashed_andZoomInvariant', () => {
      const document = documentOf(
        [rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 0, 4, 4)],
        { 'group-1': ['a', 'b'] },
      );
      const { container } = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={2.5} />
      );
      const groupFrame = container.querySelector('[data-name="selection-group-frame"]');
      expect(groupFrame?.getAttribute('data-stroke-scale-enabled')).toBe('false');
    });

    it('test_SelectionOverlay_groupFrame_followsMovePreview', () => {
      const document = documentOf(
        [rectShape('a', 0, 0, 4, 4), rectShape('b', 10, 0, 4, 4)],
        { 'group-1': ['a', 'b'] },
      );
      const withoutPreview = render(
        <SelectionOverlay document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
      );
      const xBefore = Number(
        withoutPreview.container
          .querySelector('[data-name="selection-group-frame"]')
          ?.getAttribute('data-x'),
      );
      withoutPreview.unmount();

      const withPreview = render(
        <SelectionOverlay
          document={document}
          selectedIds={['a', 'b']}
          gridSize={10}
          scale={1}
          movePreview={{ shapeIds: ['a', 'b'], delta: { x: 3, y: 0 } }}
        />
      );
      const xAfter = Number(
        withPreview.container
          .querySelector('[data-name="selection-group-frame"]')
          ?.getAttribute('data-x'),
      );

      expect(xAfter).toBeCloseTo(xBefore + 30);
    });
  });
});
