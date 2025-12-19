import { describe, it, expect } from 'vitest';
import type { CellCoordinate } from '@/types';
import {
  calculateBoundingBox,
  calculateDimensions,
  formatDimension,
  formatSizeLabel,
  formatAreaLabel,
  calculateOuterEdges,
  mergeEdges,
  type EdgeInfo,
} from './dimension';

describe('calculateBoundingBox', () => {
  it('矩形の境界を正しく計算する', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const result = calculateBoundingBox(cells);

    expect(result).toEqual({
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      width: 2,
      height: 2,
    });
  });

  it('空配列で0を返す', () => {
    const cells: CellCoordinate[] = [];
    const result = calculateBoundingBox(cells);

    expect(result).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    });
  });

  it('L字形状の境界を正しく計算する', () => {
    // L字形状
    // ##
    // #
    // #
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ];
    const result = calculateBoundingBox(cells);

    expect(result).toEqual({
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 2,
      width: 2,
      height: 3,
    });
  });

  it('単一セルの境界を正しく計算する', () => {
    const cells: CellCoordinate[] = [[5, 10]];
    const result = calculateBoundingBox(cells);

    expect(result).toEqual({
      minX: 5,
      minY: 10,
      maxX: 5,
      maxY: 10,
      width: 1,
      height: 1,
    });
  });

  it('負の座標を含むセルの境界を正しく計算する', () => {
    const cells: CellCoordinate[] = [
      [-2, -1],
      [-1, -1],
      [-2, 0],
      [-1, 0],
    ];
    const result = calculateBoundingBox(cells);

    expect(result).toEqual({
      minX: -2,
      minY: -1,
      maxX: -1,
      maxY: 0,
      width: 2,
      height: 2,
    });
  });
});

describe('calculateDimensions', () => {
  it('実寸への変換が正しい（cm）', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const cellSize = 10; // 10cm per cell
    const result = calculateDimensions(cells, cellSize);

    expect(result.widthCells).toBe(3);
    expect(result.heightCells).toBe(1);
    expect(result.widthReal).toBe(30); // 3 cells * 10cm
    expect(result.heightReal).toBe(10); // 1 cell * 10cm
  });

  it('実寸への変換が正しい（m）', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const cellSize = 1; // 1m per cell
    const result = calculateDimensions(cells, cellSize);

    expect(result.widthReal).toBe(2); // 2 cells * 1m
    expect(result.heightReal).toBe(2); // 2 cells * 1m
  });

  it('実寸への変換が正しい（mm）', () => {
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
    ];
    const cellSize = 100; // 100mm per cell
    const result = calculateDimensions(cells, cellSize);

    expect(result.widthReal).toBe(200); // 2 cells * 100mm
    expect(result.heightReal).toBe(100); // 1 cell * 100mm
  });

  it('面積計算が正しい', () => {
    // 2x2の正方形
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const cellSize = 10; // 10cm per cell
    const result = calculateDimensions(cells, cellSize);

    expect(result.areaCells).toBe(4); // 4 cells
    expect(result.areaReal).toBe(400); // 4 * 10 * 10 = 400 cm^2
  });

  it('L字形状の面積計算が正しい', () => {
    // L字形状（3セル）
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    const cellSize = 10;
    const result = calculateDimensions(cells, cellSize);

    expect(result.areaCells).toBe(3);
    expect(result.areaReal).toBe(300); // 3 * 10 * 10 = 300 cm^2
  });

  it('空配列で0を返す', () => {
    const cells: CellCoordinate[] = [];
    const result = calculateDimensions(cells, 10);

    expect(result.widthCells).toBe(0);
    expect(result.heightCells).toBe(0);
    expect(result.widthReal).toBe(0);
    expect(result.heightReal).toBe(0);
    expect(result.areaCells).toBe(0);
    expect(result.areaReal).toBe(0);
  });
});

describe('formatDimension', () => {
  it('整数値を小数なしでフォーマット', () => {
    expect(formatDimension(100, 'cm')).toBe('100cm');
    expect(formatDimension(50, 'm')).toBe('50m');
    expect(formatDimension(1000, 'mm')).toBe('1000mm');
  });

  it('小数値を1桁でフォーマット', () => {
    expect(formatDimension(10.5, 'cm')).toBe('10.5cm');
    expect(formatDimension(2.3, 'm')).toBe('2.3m');
    expect(formatDimension(150.7, 'mm')).toBe('150.7mm');
  });

  it('0をフォーマット', () => {
    expect(formatDimension(0, 'cm')).toBe('0cm');
  });

  it('長い小数を1桁に丸める', () => {
    expect(formatDimension(10.567, 'cm')).toBe('10.6cm');
    expect(formatDimension(10.123, 'cm')).toBe('10.1cm');
  });
});

describe('formatSizeLabel', () => {
  it('幅×高さ形式でフォーマット', () => {
    expect(formatSizeLabel(100, 50, 'cm')).toBe('100cm x 50cm');
    expect(formatSizeLabel(2, 3, 'm')).toBe('2m x 3m');
    expect(formatSizeLabel(500, 300, 'mm')).toBe('500mm x 300mm');
  });

  it('小数値を含む場合', () => {
    expect(formatSizeLabel(10.5, 20.3, 'cm')).toBe('10.5cm x 20.3cm');
  });
});

describe('formatAreaLabel', () => {
  it('面積を正しくフォーマット（cm2）', () => {
    expect(formatAreaLabel(100, 'cm')).toBe('100cm\u00B2');
  });

  it('面積を正しくフォーマット（m2）', () => {
    expect(formatAreaLabel(50, 'm')).toBe('50m\u00B2');
  });

  it('面積を正しくフォーマット（mm2）', () => {
    expect(formatAreaLabel(1000, 'mm')).toBe('1000mm\u00B2');
  });

  it('小数値の面積をフォーマット', () => {
    expect(formatAreaLabel(10.5, 'cm')).toBe('10.5cm\u00B2');
  });
});

describe('calculateOuterEdges', () => {
  it('単一セルで4辺を返す', () => {
    const cells: CellCoordinate[] = [[0, 0]];
    const cellSize = 10;
    const edges = calculateOuterEdges(cells, cellSize);

    // 単一セルは4つの辺を持つ
    expect(edges.length).toBe(4);

    // 各辺の長さは1セル分（10cm）
    edges.forEach((edge) => {
      expect(edge.lengthCells).toBe(1);
      expect(edge.lengthReal).toBe(10);
    });

    // 水平辺2つ、垂直辺2つ
    const horizontalEdges = edges.filter((e) => e.direction === 'horizontal');
    const verticalEdges = edges.filter((e) => e.direction === 'vertical');
    expect(horizontalEdges.length).toBe(2);
    expect(verticalEdges.length).toBe(2);
  });

  it('矩形で4辺を返す（結合確認）', () => {
    // 2x2の矩形
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const cellSize = 10;
    const edges = calculateOuterEdges(cells, cellSize);

    // 結合後は4辺（上、下、左、右）
    expect(edges.length).toBe(4);

    // 辺の長さを確認
    const horizontalEdges = edges.filter((e) => e.direction === 'horizontal');
    const verticalEdges = edges.filter((e) => e.direction === 'vertical');

    // 水平辺は長さ2（2セル分）
    horizontalEdges.forEach((edge) => {
      expect(edge.lengthCells).toBe(2);
      expect(edge.lengthReal).toBe(20);
    });

    // 垂直辺は長さ2（2セル分）
    verticalEdges.forEach((edge) => {
      expect(edge.lengthCells).toBe(2);
      expect(edge.lengthReal).toBe(20);
    });
  });

  it('L字形状で正しい辺数を返す', () => {
    // L字形状
    // ##
    // #
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    const cellSize = 10;
    const edges = calculateOuterEdges(cells, cellSize);

    // L字形状は6辺を持つ
    expect(edges.length).toBe(6);
  });

  it('各辺の長さが正しい', () => {
    // 横3セルの棒状
    const cells: CellCoordinate[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const cellSize = 10;
    const edges = calculateOuterEdges(cells, cellSize);

    // 4辺（上、下が長さ3、左、右が長さ1）
    expect(edges.length).toBe(4);

    const horizontalEdges = edges.filter((e) => e.direction === 'horizontal');
    const verticalEdges = edges.filter((e) => e.direction === 'vertical');

    // 水平辺は長さ3
    horizontalEdges.forEach((edge) => {
      expect(edge.lengthCells).toBe(3);
      expect(edge.lengthReal).toBe(30);
    });

    // 垂直辺は長さ1
    verticalEdges.forEach((edge) => {
      expect(edge.lengthCells).toBe(1);
      expect(edge.lengthReal).toBe(10);
    });
  });

  it('空配列で空配列を返す', () => {
    const cells: CellCoordinate[] = [];
    const edges = calculateOuterEdges(cells, 10);
    expect(edges.length).toBe(0);
  });

  it('凹形状で正しい辺を計算する', () => {
    // 凹形状（コの字）
    // # #
    // ###
    const cells: CellCoordinate[] = [
      [0, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ];
    const cellSize = 10;
    const edges = calculateOuterEdges(cells, cellSize);

    // 凹形状の辺の数を確認
    expect(edges.length).toBe(8);
  });
});

describe('mergeEdges', () => {
  it('連続する水平辺を結合する', () => {
    const edges: EdgeInfo[] = [
      {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'horizontal',
      },
      {
        start: { x: 1, y: 0 },
        end: { x: 2, y: 0 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'horizontal',
      },
    ];
    const cellSize = 10;
    const merged = mergeEdges(edges, cellSize);

    expect(merged.length).toBe(1);
    expect(merged[0].lengthCells).toBe(2);
    expect(merged[0].lengthReal).toBe(20);
    expect(merged[0].start).toEqual({ x: 0, y: 0 });
    expect(merged[0].end).toEqual({ x: 2, y: 0 });
  });

  it('連続する垂直辺を結合する', () => {
    const edges: EdgeInfo[] = [
      {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'vertical',
      },
      {
        start: { x: 0, y: 1 },
        end: { x: 0, y: 2 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'vertical',
      },
    ];
    const cellSize = 10;
    const merged = mergeEdges(edges, cellSize);

    expect(merged.length).toBe(1);
    expect(merged[0].lengthCells).toBe(2);
    expect(merged[0].lengthReal).toBe(20);
    expect(merged[0].start).toEqual({ x: 0, y: 0 });
    expect(merged[0].end).toEqual({ x: 0, y: 2 });
  });

  it('連続しない辺は結合しない', () => {
    const edges: EdgeInfo[] = [
      {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'horizontal',
      },
      {
        start: { x: 2, y: 0 },
        end: { x: 3, y: 0 },
        lengthCells: 1,
        lengthReal: 10,
        direction: 'horizontal',
      },
    ];
    const cellSize = 10;
    const merged = mergeEdges(edges, cellSize);

    expect(merged.length).toBe(2);
  });

  it('空配列で空配列を返す', () => {
    const merged = mergeEdges([], 10);
    expect(merged.length).toBe(0);
  });
});
