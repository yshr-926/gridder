import { describe, it, expect } from 'vitest';
import type { CellCoordinate } from '@/types';
import {
  collectOuterEdges,
  sortEdgesToPath,
  mergeContiguousEdges,
  getObjectOutline,
} from '../outline';

describe('collectOuterEdges', () => {
  it('should return empty array for empty cells', () => {
    const edges = collectOuterEdges([]);
    expect(edges).toEqual([]);
  });

  it('should return 4 edges for a single cell', () => {
    const cells: CellCoordinate[] = [[0, 0]];
    const edges = collectOuterEdges(cells);
    expect(edges).toHaveLength(4);
    // 上、下、左、右の4辺
    expect(edges).toContainEqual({ x1: 0, y1: 0, x2: 1, y2: 0 }); // 上
    expect(edges).toContainEqual({ x1: 0, y1: 1, x2: 1, y2: 1 }); // 下
    expect(edges).toContainEqual({ x1: 0, y1: 0, x2: 0, y2: 1 }); // 左
    expect(edges).toContainEqual({ x1: 1, y1: 0, x2: 1, y2: 1 }); // 右
  });

  it('should return correct edges for 2x1 horizontal cells', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
    ];
    const edges = collectOuterEdges(cells);
    // 外周は6辺（上2、下2、左1、右1）
    expect(edges).toHaveLength(6);
    // 内部のエッジは含まれない
    expect(edges).not.toContainEqual({ x1: 1, y1: 0, x2: 1, y2: 1 });
  });

  it('should return correct edges for 2x2 square', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const edges = collectOuterEdges(cells);
    // 2x2正方形の外周は8辺
    expect(edges).toHaveLength(8);
  });

  it('should return correct edges for L-shape', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    const edges = collectOuterEdges(cells);
    // L字型の外周は10辺
    expect(edges).toHaveLength(10);
  });
});

describe('sortEdgesToPath', () => {
  it('should return empty array for empty edges', () => {
    const sorted = sortEdgesToPath([]);
    expect(sorted).toEqual([]);
  });

  it('should return sorted edges forming a closed path for a single cell', () => {
    const edges = [
      { x1: 0, y1: 0, x2: 1, y2: 0 }, // 上
      { x1: 1, y1: 0, x2: 1, y2: 1 }, // 右
      { x1: 0, y1: 1, x2: 1, y2: 1 }, // 下
      { x1: 0, y1: 0, x2: 0, y2: 1 }, // 左
    ];
    const sorted = sortEdgesToPath(edges);
    expect(sorted).toHaveLength(4);

    // 連続したパスになっているか確認
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].x2).toBe(sorted[i + 1].x1);
      expect(sorted[i].y2).toBe(sorted[i + 1].y1);
    }
  });

  it('should handle edges in random order', () => {
    // ランダムな順序のエッジ
    const edges = [
      { x1: 0, y1: 1, x2: 1, y2: 1 }, // 下
      { x1: 0, y1: 0, x2: 0, y2: 1 }, // 左
      { x1: 1, y1: 0, x2: 1, y2: 1 }, // 右
      { x1: 0, y1: 0, x2: 1, y2: 0 }, // 上
    ];
    const sorted = sortEdgesToPath(edges);
    expect(sorted).toHaveLength(4);

    // 連続したパスになっているか確認
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].x2).toBe(sorted[i + 1].x1);
      expect(sorted[i].y2).toBe(sorted[i + 1].y1);
    }
  });
});

describe('mergeContiguousEdges', () => {
  it('should return empty array for empty edges', () => {
    const merged = mergeContiguousEdges([]);
    expect(merged).toEqual([]);
  });

  it('should return single edge as-is', () => {
    const edges = [{ x1: 0, y1: 0, x2: 1, y2: 0 }];
    const merged = mergeContiguousEdges(edges);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x1: 0, y1: 0, x2: 1, y2: 0 });
  });

  it('should merge horizontal contiguous edges', () => {
    const edges = [
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 0, x2: 2, y2: 0 },
    ];
    const merged = mergeContiguousEdges(edges);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x1: 0, y1: 0, x2: 2, y2: 0 });
  });

  it('should merge vertical contiguous edges', () => {
    const edges = [
      { x1: 0, y1: 0, x2: 0, y2: 1 },
      { x1: 0, y1: 1, x2: 0, y2: 2 },
    ];
    const merged = mergeContiguousEdges(edges);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x1: 0, y1: 0, x2: 0, y2: 2 });
  });

  it('should not merge edges with different directions', () => {
    const edges = [
      { x1: 0, y1: 0, x2: 1, y2: 0 }, // 水平
      { x1: 1, y1: 0, x2: 1, y2: 1 }, // 垂直
    ];
    const merged = mergeContiguousEdges(edges);
    expect(merged).toHaveLength(2);
  });

  it('should correctly merge a 2x2 square outline', () => {
    // 2x2正方形の外周（連結順にソート済み）
    const edges = [
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 0, x2: 2, y2: 0 },
      { x1: 2, y1: 0, x2: 2, y2: 1 },
      { x1: 2, y1: 1, x2: 2, y2: 2 },
      { x1: 2, y1: 2, x2: 1, y2: 2 },
      { x1: 1, y1: 2, x2: 0, y2: 2 },
      { x1: 0, y1: 2, x2: 0, y2: 1 },
      { x1: 0, y1: 1, x2: 0, y2: 0 },
    ];
    const merged = mergeContiguousEdges(edges);
    // 4辺に統合されるはず
    expect(merged).toHaveLength(4);
  });
});

describe('getObjectOutline', () => {
  it('should return empty array for empty cells', () => {
    const points = getObjectOutline([], 10);
    expect(points).toEqual([]);
  });

  it('should return correct outline for a single cell', () => {
    const cells: CellCoordinate[] = [[0, 0]];
    const points = getObjectOutline(cells, 10);
    // 4頂点 + 閉じるための始点 = 5点 x 2座標 = 10
    expect(points.length).toBe(10);
  });

  it('should return correct outline for a 2x2 square', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const points = getObjectOutline(cells, 10);
    // 4辺の閉じたパス（始点含む） = 5点 x 2座標 = 10
    expect(points.length).toBe(10);
  });

  it('should return correct outline for L-shape', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    const points = getObjectOutline(cells, 10);
    // L字型の輪郭が正しく抽出されることを確認
    expect(points.length).toBeGreaterThan(0);
    // 偶数（x, y のペア）
    expect(points.length % 2).toBe(0);
  });

  it('should return correct outline for T-shape', () => {
    const cells: CellCoordinate[] = [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ];
    const points = getObjectOutline(cells, 10);
    expect(points.length).toBeGreaterThan(0);
    // 偶数（x, y のペア）
    expect(points.length % 2).toBe(0);
  });

  it('should scale points correctly', () => {
    const cells: CellCoordinate[] = [[0, 0]];
    const gridSize = 20;
    const points = getObjectOutline(cells, gridSize);

    // すべてのポイントがgridSizeの倍数であることを確認
    for (const point of points) {
      expect(point % gridSize).toBe(0);
    }
  });

  it('should handle 3x3 square correctly', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    const points = getObjectOutline(cells, 10);
    // 正方形なので4辺 = 5点 x 2座標 = 10
    expect(points.length).toBe(10);
  });

  it('should handle U-shape correctly', () => {
    // U字型
    const cells: CellCoordinate[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 1],
      [2, 0],
    ];
    const points = getObjectOutline(cells, 10);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length % 2).toBe(0);
  });

  it('should handle single horizontal line of cells', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const points = getObjectOutline(cells, 10);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length % 2).toBe(0);
  });

  it('should handle single vertical line of cells', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const points = getObjectOutline(cells, 10);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length % 2).toBe(0);
  });
});
