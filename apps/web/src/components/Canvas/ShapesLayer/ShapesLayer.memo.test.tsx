import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ShapesLayer } from './ShapesLayer';
import { createDummyDocument } from './fixtures';

/**
 * Issue #61: with 500 shapes on screen, a re-render of `ShapesLayer` must not
 * re-run the 500 polygon / annotation components whose inputs did not
 * change. These tests count renders of the two leaf components through
 * mocks; the geometry itself is covered by `ShapesLayer.test.tsx`.
 */
const renders = { polygon: new Map<string, number>(), annotation: new Map<string, number>() };

const bump = (map: Map<string, number>, id: string): void => {
  map.set(id, (map.get(id) ?? 0) + 1);
};

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ShapePolygon', () => ({
  ShapePolygon: ({ shape }: { shape: { id: string } }) => {
    bump(renders.polygon, shape.id);
    return <div data-testid="polygon" />;
  },
}));

vi.mock('./ShapeAnnotation', () => ({
  ShapeAnnotation: ({ shape }: { shape: { id: string } }) => {
    bump(renders.annotation, shape.id);
    return <div data-testid="annotation" />;
  },
}));

const countsAfterFirstRender = (map: Map<string, number>): number[] => [...map.values()];

describe('ShapesLayer memoisation (issue #61)', () => {
  const document = createDummyDocument({ shapeCount: 5, cellsPerShape: 4, withName: true });

  beforeEach(() => {
    renders.polygon.clear();
    renders.annotation.clear();
  });

  it('test_ShapesLayer_zoom_rerendersAnnotationsButNotPolygons', () => {
    const { rerender } = render(<ShapesLayer document={document} gridSize={10} scale={1} />);
    expect(countsAfterFirstRender(renders.polygon)).toEqual([1, 1, 1, 1, 1]);

    rerender(<ShapesLayer document={document} gridSize={10} scale={2} />);

    expect([...renders.polygon.values()]).toEqual([1, 1, 1, 1, 1]);
    expect([...renders.annotation.values()]).toEqual([2, 2, 2, 2, 2]);
  });

  it('test_ShapesLayer_movePreview_rerendersOnlyTheMovingShape', () => {
    const { rerender } = render(<ShapesLayer document={document} gridSize={10} scale={1} />);

    rerender(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        movePreview={{ shapeIds: ['shape-2'], delta: { x: 1, y: 0 } }}
      />
    );
    rerender(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        movePreview={{ shapeIds: ['shape-2'], delta: { x: 2, y: 0 } }}
      />
    );

    // Only the moving shape's items re-render (the leaf mocks here are not
    // memoised themselves, so they count each item render); the other four
    // shapes' offsets stayed 0 and their shape references stayed identical.
    for (const id of ['shape-0', 'shape-1', 'shape-3', 'shape-4']) {
      expect(renders.polygon.get(id)).toBe(1);
      expect(renders.annotation.get(id)).toBe(1);
    }
    expect(renders.polygon.get('shape-2')).toBe(3);
    expect(renders.annotation.get('shape-2')).toBe(3);
  });

  it('test_ShapesLayer_resizePreview_rerendersOnlyTheResizedShape', () => {
    const { rerender } = render(<ShapesLayer document={document} gridSize={10} scale={1} />);

    rerender(
      <ShapesLayer
        document={document}
        gridSize={10}
        scale={1}
        resizePreview={{ shapeId: 'shape-1', bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } }}
      />
    );

    expect(renders.polygon.get('shape-1')).toBe(2);
    expect(renders.annotation.get('shape-1')).toBe(2);
    for (const id of ['shape-0', 'shape-2', 'shape-3', 'shape-4']) {
      expect(renders.polygon.get(id)).toBe(1);
      expect(renders.annotation.get(id)).toBe(1);
    }
  });

  it('test_ShapesLayer_sameProps_doesNotRerenderAnything', () => {
    const props = { document, gridSize: 10, scale: 1 };
    const { rerender } = render(<ShapesLayer {...props} />);

    rerender(<ShapesLayer {...props} />);

    expect([...renders.polygon.values()]).toEqual([1, 1, 1, 1, 1]);
    expect([...renders.annotation.values()]).toEqual([1, 1, 1, 1, 1]);
  });
});
