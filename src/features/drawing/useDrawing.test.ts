import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawing, groupConnectedCells, normalizeCells } from './useDrawing';
import { useCanvasStore } from '@/stores/canvasStore';

describe('groupConnectedCells', () => {
  it('should return empty array for empty input', () => {
    const result = groupConnectedCells([]);
    expect(result).toEqual([]);
  });

  it('should group single cell', () => {
    const result = groupConnectedCells([[0, 0]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([[0, 0]]);
  });

  it('should group horizontally connected cells', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should group vertically connected cells', () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should group diagonally connected cells (8-direction)', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should separate non-connected regions', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [5, 5],
      [6, 5],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2);
    expect(result[1]).toHaveLength(2);
  });

  it('should handle L-shaped region as one group', () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(5);
  });

  it('should handle complex shape with multiple connections', () => {
    // Square shape
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    const result = groupConnectedCells(cells);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(8);
  });
});

describe('normalizeCells', () => {
  it('should return empty for empty input', () => {
    const result = normalizeCells([]);
    expect(result.normalizedCells).toEqual([]);
    expect(result.minX).toBe(0);
    expect(result.minY).toBe(0);
  });

  it('should normalize single cell at origin', () => {
    const result = normalizeCells([[5, 3]]);
    expect(result.normalizedCells).toEqual([[0, 0]]);
    expect(result.minX).toBe(5);
    expect(result.minY).toBe(3);
  });

  it('should normalize multiple cells', () => {
    const cells: [number, number][] = [
      [5, 3],
      [6, 3],
      [5, 4],
    ];
    const result = normalizeCells(cells);

    expect(result.minX).toBe(5);
    expect(result.minY).toBe(3);
    expect(result.normalizedCells).toContainEqual([0, 0]);
    expect(result.normalizedCells).toContainEqual([1, 0]);
    expect(result.normalizedCells).toContainEqual([0, 1]);
  });

  it('should handle negative coordinates', () => {
    const cells: [number, number][] = [
      [-2, -3],
      [-1, -3],
    ];
    const result = normalizeCells(cells);

    expect(result.minX).toBe(-2);
    expect(result.minY).toBe(-3);
    expect(result.normalizedCells).toContainEqual([0, 0]);
    expect(result.normalizedCells).toContainEqual([1, 0]);
  });
});

describe('useDrawing', () => {
  beforeEach(() => {
    // Reset the store before each test
    useCanvasStore.setState({
      objects: [],
      drawingCells: [],
      selectedObjectId: null,
    });
  });

  it('should start drawing and add cell', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([5, 5]);
    });

    const state = useCanvasStore.getState();
    expect(state.drawingCells).toContainEqual([5, 5]);
  });

  it('should continue drawing and add multiple cells', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([5, 5]);
      result.current.continueDrawing([6, 5]);
      result.current.continueDrawing([7, 5]);
    });

    const state = useCanvasStore.getState();
    expect(state.drawingCells).toHaveLength(3);
  });

  it('should not add duplicate cells', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([5, 5]);
      result.current.continueDrawing([5, 5]);
      result.current.continueDrawing([5, 5]);
    });

    const state = useCanvasStore.getState();
    expect(state.drawingCells).toHaveLength(1);
  });

  it('should end drawing and create object', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([5, 5]);
      result.current.continueDrawing([6, 5]);
      result.current.endDrawing('#333333');
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].cells).toHaveLength(2);
    expect(state.objects[0].position).toEqual({ x: 5, y: 5 });
    expect(state.objects[0].color).toBe('#333333');
    expect(state.drawingCells).toHaveLength(0);
  });

  it('should create multiple objects for non-connected regions', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([0, 0]);
      result.current.continueDrawing([1, 0]);
      result.current.continueDrawing([10, 10]);
      result.current.continueDrawing([11, 10]);
      result.current.endDrawing();
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(2);
  });

  it('should cancel drawing and clear cells', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([5, 5]);
      result.current.continueDrawing([6, 5]);
      result.current.cancelDrawing();
    });

    const state = useCanvasStore.getState();
    expect(state.drawingCells).toHaveLength(0);
    expect(state.objects).toHaveLength(0);
  });

  it('should not create object when ending with no cells', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.endDrawing();
    });

    const state = useCanvasStore.getState();
    expect(state.objects).toHaveLength(0);
  });

  it('should normalize cell positions in created object', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => {
      result.current.startDrawing([10, 20]);
      result.current.continueDrawing([11, 20]);
      result.current.continueDrawing([10, 21]);
      result.current.endDrawing();
    });

    const state = useCanvasStore.getState();
    const obj = state.objects[0];

    // Position should be the minimum coordinates
    expect(obj.position).toEqual({ x: 10, y: 20 });

    // Cells should be normalized to start from 0,0
    expect(obj.cells).toContainEqual([0, 0]);
    expect(obj.cells).toContainEqual([1, 0]);
    expect(obj.cells).toContainEqual([0, 1]);
  });
});
