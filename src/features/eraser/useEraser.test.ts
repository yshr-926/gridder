import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useEraser,
  groupConnectedCells4Direction,
  findCellInObjects,
} from './useEraser';
import { useCanvasStore } from '@/stores/canvasStore';
import type { GridObject } from '@/types';

describe('groupConnectedCells4Direction', () => {
  it('should return empty array for empty input', () => {
    const result = groupConnectedCells4Direction([]);
    expect(result).toEqual([]);
  });

  it('should group single cell', () => {
    const result = groupConnectedCells4Direction([[0, 0]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([[0, 0]]);
  });

  it('should group horizontally connected cells', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const result = groupConnectedCells4Direction(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should group vertically connected cells', () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const result = groupConnectedCells4Direction(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should NOT group diagonally connected cells (4-direction)', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
    ];
    const result = groupConnectedCells4Direction(cells);
    // Diagonal cells should be separate groups in 4-direction
    expect(result).toHaveLength(3);
  });

  it('should separate non-connected regions', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [5, 5],
      [6, 5],
    ];
    const result = groupConnectedCells4Direction(cells);
    expect(result).toHaveLength(2);
  });

  it('should handle L-shaped region as one group', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ];
    const result = groupConnectedCells4Direction(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(5);
  });
});

describe('findCellInObjects', () => {
  it('should return null for empty objects array', () => {
    const result = findCellInObjects(0, 0, []);
    expect(result).toBeNull();
  });

  it('should find cell in object at origin', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      },
    ];
    const result = findCellInObjects(0, 0, objects);
    expect(result).not.toBeNull();
    expect(result?.object.id).toBe('obj-1');
    expect(result?.cellIndex).toBe(0);
  });

  it('should find cell considering object position', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [
          [0, 0],
          [1, 0],
        ],
        position: { x: 5, y: 5 },
        rotation: 0,
        color: '#333',
      },
    ];
    // Cell [0,0] at position [5,5] = global [5,5]
    const result = findCellInObjects(5, 5, objects);
    expect(result).not.toBeNull();
    expect(result?.cellIndex).toBe(0);

    // Cell [1,0] at position [5,5] = global [6,5]
    const result2 = findCellInObjects(6, 5, objects);
    expect(result2).not.toBeNull();
    expect(result2?.cellIndex).toBe(1);
  });

  it('should return null when cell not found', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      },
    ];
    const result = findCellInObjects(10, 10, objects);
    expect(result).toBeNull();
  });
});

describe('useEraser', () => {
  beforeEach(() => {
    // Reset the store before each test
    useCanvasStore.setState({
      objects: [],
      drawingCells: [],
      selectedObjectId: null,
    });
  });

  it('should erase single cell and delete object', () => {
    // Setup: Create an object with one cell
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [[0, 0]],
          position: { x: 5, y: 5 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    act(() => {
      result.current.eraseCell(5, 5);
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(0);
  });

  it('should erase one cell from multi-cell object', () => {
    // Setup: Create an object with three horizontal cells
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          position: { x: 0, y: 0 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    // Erase middle cell
    act(() => {
      result.current.eraseCell(1, 0);
    });

    const state = useCanvasStore.getState();
    // Should split into two objects since middle was removed
    expect(state.objects).toHaveLength(2);
  });

  it('should not split when removing edge cell', () => {
    // Setup: Create an object with three horizontal cells
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          position: { x: 0, y: 0 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    // Erase edge cell
    act(() => {
      result.current.eraseCell(0, 0);
    });

    const state = useCanvasStore.getState();
    // Should remain as one object
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].cells).toHaveLength(2);
  });

  it('should normalize cells after erasing', () => {
    // Setup: Create an object at position (10, 10)
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          position: { x: 10, y: 10 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    // Erase first cell at global (10, 10)
    act(() => {
      result.current.eraseCell(10, 10);
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(1);
    // Position should be updated to (11, 10) since first cell was removed
    expect(state.objects[0].position).toEqual({ x: 11, y: 10 });
    // Cells should be normalized to start from 0
    expect(state.objects[0].cells).toContainEqual([0, 0]);
    expect(state.objects[0].cells).toContainEqual([1, 0]);
  });

  it('should preserve color and rotation when splitting', () => {
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          position: { x: 0, y: 0 },
          rotation: 90,
          color: '#ff0000',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    // Erase middle cell to cause split
    act(() => {
      result.current.eraseCell(1, 0);
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(2);
    // Both objects should inherit color and rotation
    expect(state.objects[0].color).toBe('#ff0000');
    expect(state.objects[0].rotation).toBe(90);
    expect(state.objects[1].color).toBe('#ff0000');
    expect(state.objects[1].rotation).toBe(90);
  });

  it('should start and continue erasing', () => {
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          position: { x: 0, y: 0 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    act(() => {
      result.current.startErasing([0, 0]);
      result.current.continueErasing([1, 0]);
      result.current.continueErasing([2, 0]);
      result.current.endErasing();
    });

    const state = useCanvasStore.getState();
    // All cells should be erased, object deleted
    expect(state.objects).toHaveLength(0);
  });

  it('should do nothing when erasing non-existent cell', () => {
    useCanvasStore.setState({
      objects: [
        {
          id: 'obj-1',
          cells: [[0, 0]],
          position: { x: 0, y: 0 },
          rotation: 0,
          color: '#333',
        },
      ],
    });

    const { result } = renderHook(() => useEraser());

    act(() => {
      result.current.eraseCell(100, 100);
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].cells).toHaveLength(1);
  });
});
