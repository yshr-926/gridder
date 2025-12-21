/**
 * usePolygonDrawing フックのユニットテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolygonDrawing } from '../usePolygonDrawing';
import { useCanvasStore } from '@/stores/canvasStore';

// モック
vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: vi.fn(),
}));

vi.mock('@/utils/colorPalette', () => ({
  getNextObjectColor: vi.fn(() => '#3b82f6'),
}));

vi.mock('@/utils/id', () => ({
  generateId: vi.fn(() => 'obj-test-123'),
}));

describe('usePolygonDrawing', () => {
  let mockAddObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAddObject = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        addObject: mockAddObject,
        defaultDecoration: {
          showBorder: true,
          borderWidth: 1,
          opacity: 0.8,
        },
      };
      return selector(state);
    });
  });

  describe('初期状態', () => {
    it('should have empty vertices initially', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      expect(result.current.vertices).toEqual([]);
      expect(result.current.isDrawing).toBe(false);
      expect(result.current.canClose).toBe(false);
    });
  });

  describe('addVertex', () => {
    it('should add a vertex and set isDrawing to true', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
      });

      expect(result.current.vertices).toEqual([{ x: 0, y: 0 }]);
      expect(result.current.isDrawing).toBe(true);
      expect(result.current.canClose).toBe(false);
    });

    it('should add multiple vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      expect(result.current.vertices).toHaveLength(3);
      expect(result.current.canClose).toBe(true);
    });
  });

  describe('removeLastVertex', () => {
    it('should remove the last vertex', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      act(() => {
        result.current.removeLastVertex();
      });

      expect(result.current.vertices).toHaveLength(2);
      expect(result.current.vertices).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]);
    });

    it('should set isDrawing to false when all vertices are removed', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
      });

      act(() => {
        result.current.removeLastVertex();
      });

      expect(result.current.vertices).toEqual([]);
      expect(result.current.isDrawing).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should clear all vertices and reset state', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      act(() => {
        result.current.cancel();
      });

      expect(result.current.vertices).toEqual([]);
      expect(result.current.isDrawing).toBe(false);
      expect(result.current.canClose).toBe(false);
    });
  });

  describe('canClose', () => {
    it('should be false with less than 3 vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      expect(result.current.canClose).toBe(false);

      act(() => {
        result.current.addVertex(0, 0);
      });
      expect(result.current.canClose).toBe(false);

      act(() => {
        result.current.addVertex(4, 0);
      });
      expect(result.current.canClose).toBe(false);
    });

    it('should be true with 3 or more vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      expect(result.current.canClose).toBe(true);

      act(() => {
        result.current.addVertex(1, 2);
      });

      expect(result.current.canClose).toBe(true);
    });
  });

  describe('completePolygon', () => {
    it('should return null with less than 3 vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
      });

      let obj: ReturnType<typeof result.current.completePolygon> = null;
      act(() => {
        obj = result.current.completePolygon();
      });

      expect(obj).toBeNull();
      expect(mockAddObject).not.toHaveBeenCalled();
    });

    it('should create a filled polygon object with 3+ vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      let obj: ReturnType<typeof result.current.completePolygon>;
      act(() => {
        obj = result.current.completePolygon(true);
      });

      expect(obj!).not.toBeNull();
      expect(obj!.id).toBe('obj-test-123');
      expect(obj!.color).toBe('#3b82f6');
      expect(obj!.rotation).toBe(0);
      expect(mockAddObject).toHaveBeenCalledTimes(1);
    });

    it('should create an outline-only polygon when filled is false', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      let obj: ReturnType<typeof result.current.completePolygon>;
      act(() => {
        obj = result.current.completePolygon(false);
      });

      expect(obj!).not.toBeNull();
      expect(mockAddObject).toHaveBeenCalledTimes(1);
    });

    it('should reset state after completing polygon', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
        result.current.addVertex(2, 3);
      });

      act(() => {
        result.current.completePolygon();
      });

      expect(result.current.vertices).toEqual([]);
      expect(result.current.isDrawing).toBe(false);
      expect(result.current.canClose).toBe(false);
    });
  });

  describe('previewCells', () => {
    it('should return empty array with no vertices', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      const cells = result.current.previewCells({ x: 5, y: 5 });

      expect(cells).toEqual([]);
    });

    it('should return empty array with null cursor', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
      });

      const cells = result.current.previewCells(null);

      expect(cells).toEqual([]);
    });

    it('should return preview cells with one vertex and cursor', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
      });

      const cells = result.current.previewCells({ x: 5, y: 0 });

      // 頂点からカーソルへの線を表示
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should return preview cells with multiple vertices and cursor', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(0, 0);
        result.current.addVertex(4, 0);
      });

      const cells = result.current.previewCells({ x: 2, y: 3 });

      // 閉じた形状のプレビューを表示
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should return cells in grid coordinates', () => {
      const { result } = renderHook(() => usePolygonDrawing());

      act(() => {
        result.current.addVertex(5, 5);
        result.current.addVertex(10, 5);
      });

      const cells = result.current.previewCells({ x: 7, y: 10 });

      // グリッド座標で返される（ローカル座標ではない）
      const hasOffsetCells = cells.some(([x, y]) => x >= 5 && y >= 5);
      expect(hasOffsetCells).toBe(true);
    });
  });
});
