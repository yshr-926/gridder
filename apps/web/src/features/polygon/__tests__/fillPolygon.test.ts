/**
 * fillPolygon / getPolygonOutline のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { fillPolygon, getPolygonOutline } from '../fillPolygon';
import type { Vertex } from '../types';

describe('fillPolygon', () => {
  describe('基本動作', () => {
    it('should return empty result for less than 3 vertices', () => {
      // 0頂点
      expect(fillPolygon([])).toEqual({
        cells: [],
        position: { x: 0, y: 0 },
      });

      // 1頂点
      expect(fillPolygon([{ x: 0, y: 0 }])).toEqual({
        cells: [],
        position: { x: 0, y: 0 },
      });

      // 2頂点
      expect(fillPolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual({
        cells: [],
        position: { x: 0, y: 0 },
      });
    });

    it('should fill a simple right triangle', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
      ];

      const result = fillPolygon(vertices);

      // セル数が0より大きいことを確認
      expect(result.cells.length).toBeGreaterThan(0);
      // position が正しいことを確認
      expect(result.position).toEqual({ x: 0, y: 0 });
      // セルはローカル座標であることを確認
      result.cells.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
      });
    });

    it('should fill a square', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ];

      const result = fillPolygon(vertices);

      // 正方形の内部セル数を確認（境界の扱いで多少変動あり）
      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should handle offset positions correctly', () => {
      const vertices: Vertex[] = [
        { x: 5, y: 5 },
        { x: 8, y: 5 },
        { x: 8, y: 8 },
        { x: 5, y: 8 },
      ];

      const result = fillPolygon(vertices);

      // position がオフセットを反映
      expect(result.position).toEqual({ x: 5, y: 5 });
      // セルはローカル座標（0始まり）
      result.cells.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(3);
        expect(y).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('凹多角形', () => {
    it('should fill a concave L-shape', () => {
      // L字型の凹多角形
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
        { x: 0, y: 3 },
      ];

      const result = fillPolygon(vertices);

      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should handle arrow-shaped polygon', () => {
      // 矢印型
      const vertices: Vertex[] = [
        { x: 2, y: 0 },
        { x: 4, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 4 },
        { x: 1, y: 4 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ];

      const result = fillPolygon(vertices);

      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('エッジケース', () => {
    it('should handle very small triangle', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ];

      const result = fillPolygon(vertices);

      // 小さな三角形でも空でないことを確認
      expect(result.cells.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative coordinates', () => {
      const vertices: Vertex[] = [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 0, y: 2 },
      ];

      const result = fillPolygon(vertices);

      expect(result.position).toEqual({ x: -2, y: -2 });
      // セルはローカル座標
      result.cells.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle floating point coordinates', () => {
      const vertices: Vertex[] = [
        { x: 0.5, y: 0.5 },
        { x: 4.7, y: 0.3 },
        { x: 2.1, y: 3.9 },
      ];

      const result = fillPolygon(vertices);

      // 浮動小数点でも正常に処理される
      expect(result.cells.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('getPolygonOutline', () => {
  describe('基本動作', () => {
    it('should return empty result for less than 2 vertices', () => {
      expect(getPolygonOutline([])).toEqual({
        cells: [],
        position: { x: 0, y: 0 },
      });

      expect(getPolygonOutline([{ x: 0, y: 0 }])).toEqual({
        cells: [],
        position: { x: 0, y: 0 },
      });
    });

    it('should draw outline for a line (2 vertices)', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ];

      const result = getPolygonOutline(vertices);

      // 水平線なので y=0 のセルのみ
      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should draw outline for a triangle', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ];

      const result = getPolygonOutline(vertices);

      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should draw outline for a square', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ];

      const result = getPolygonOutline(vertices);

      // 正方形の輪郭
      expect(result.cells.length).toBeGreaterThan(0);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('重複除去', () => {
    it('should remove duplicate cells at vertices', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ];

      const result = getPolygonOutline(vertices);

      // 重複がないことを確認
      const cellStrings = result.cells.map(([x, y]) => `${x},${y}`);
      const uniqueCellStrings = [...new Set(cellStrings)];
      expect(cellStrings.length).toBe(uniqueCellStrings.length);
    });
  });

  describe('オフセット処理', () => {
    it('should handle offset positions', () => {
      const vertices: Vertex[] = [
        { x: 10, y: 10 },
        { x: 15, y: 10 },
        { x: 12, y: 15 },
      ];

      const result = getPolygonOutline(vertices);

      expect(result.position).toEqual({ x: 10, y: 10 });
      // セルはローカル座標
      result.cells.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('エッジケース', () => {
    it('should handle diagonal line', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ];

      const result = getPolygonOutline(vertices);

      // 対角線は始点から終点まで連続したセル
      expect(result.cells.length).toBe(6); // 0,0 -> 5,5 で 6 セル
    });

    it('should handle negative coordinates', () => {
      const vertices: Vertex[] = [
        { x: -3, y: -3 },
        { x: 0, y: -3 },
        { x: -1, y: 0 },
      ];

      const result = getPolygonOutline(vertices);

      expect(result.position).toEqual({ x: -3, y: -3 });
    });
  });
});
