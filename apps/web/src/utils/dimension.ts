import type { CellCoordinate, Unit } from '@/types';

/**
 * 寸法情報
 */
export interface DimensionInfo {
  /** 幅（グリッド単位） */
  widthCells: number;
  /** 高さ（グリッド単位） */
  heightCells: number;
  /** 幅（実寸） */
  widthReal: number;
  /** 高さ（実寸） */
  heightReal: number;
  /** 面積（グリッド単位） */
  areaCells: number;
  /** 面積（実寸、平方単位） */
  areaReal: number;
}

/**
 * 辺の情報
 */
export interface EdgeInfo {
  /** 開始点 */
  start: { x: number; y: number };
  /** 終了点 */
  end: { x: number; y: number };
  /** 長さ（グリッド単位） */
  lengthCells: number;
  /** 長さ（実寸） */
  lengthReal: number;
  /** 方向（horizontal | vertical） */
  direction: 'horizontal' | 'vertical';
}

/**
 * バウンディングボックスの結果
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * セル配列からバウンディングボックスを計算
 */
export const calculateBoundingBox = (cells: CellCoordinate[]): BoundingBox => {
  if (cells.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

/**
 * 寸法情報を計算
 */
export const calculateDimensions = (
  cells: CellCoordinate[],
  cellSize: number
): DimensionInfo => {
  const bbox = calculateBoundingBox(cells);

  const widthCells = bbox.width;
  const heightCells = bbox.height;
  const areaCells = cells.length;

  // 実寸計算
  const widthReal = widthCells * cellSize;
  const heightReal = heightCells * cellSize;
  const areaReal = areaCells * cellSize * cellSize;

  return {
    widthCells,
    heightCells,
    widthReal,
    heightReal,
    areaCells,
    areaReal,
  };
};

/**
 * 単位付き文字列にフォーマット
 */
export const formatDimension = (value: number, unit: Unit): string => {
  // 小数点以下が不要な場合は整数表示
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${formatted}${unit}`;
};

/**
 * 寸法ラベルを生成（幅 x 高さ 形式）
 */
export const formatSizeLabel = (
  widthReal: number,
  heightReal: number,
  unit: Unit
): string => {
  return `${formatDimension(widthReal, unit)} x ${formatDimension(heightReal, unit)}`;
};

/**
 * 面積ラベルを生成
 */
export const formatAreaLabel = (areaReal: number, unit: Unit): string => {
  const unitSquare = unit === 'm' ? 'm\u00B2' : unit === 'cm' ? 'cm\u00B2' : 'mm\u00B2';
  const formatted = Number.isInteger(areaReal) ? areaReal.toString() : areaReal.toFixed(1);
  return `${formatted}${unitSquare}`;
};

/**
 * 辺をキーでグループ化するためのヘルパー型
 */
interface RawEdge {
  start: { x: number; y: number };
  end: { x: number; y: number };
  direction: 'horizontal' | 'vertical';
}

/**
 * 連続する辺を結合する
 * 水平辺は同一Y座標、垂直辺は同一X座標でグループ化し、
 * 連続する辺を1つの長い辺として結合する
 */
export const mergeEdges = (edges: EdgeInfo[], cellSize: number): EdgeInfo[] => {
  if (edges.length === 0) return [];

  // 水平辺と垂直辺を分離
  const horizontalEdges = edges.filter((e) => e.direction === 'horizontal');
  const verticalEdges = edges.filter((e) => e.direction === 'vertical');

  const mergedEdges: EdgeInfo[] = [];

  // 水平辺をY座標でグループ化して結合
  const horizontalGroups = new Map<number, RawEdge[]>();
  for (const edge of horizontalEdges) {
    const key = edge.start.y;
    if (!horizontalGroups.has(key)) {
      horizontalGroups.set(key, []);
    }
    horizontalGroups.get(key)!.push(edge);
  }

  for (const [, group] of horizontalGroups) {
    // X座標でソート
    group.sort((a, b) => a.start.x - b.start.x);

    let currentEdge = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const nextEdge = group[i];
      // 連続しているかチェック
      if (currentEdge.end.x === nextEdge.start.x) {
        // 結合
        currentEdge.end = nextEdge.end;
      } else {
        // 保存して新しい辺を開始
        const lengthCells = currentEdge.end.x - currentEdge.start.x;
        mergedEdges.push({
          ...currentEdge,
          lengthCells,
          lengthReal: lengthCells * cellSize,
        });
        currentEdge = { ...nextEdge };
      }
    }
    // 最後の辺を保存
    const lengthCells = currentEdge.end.x - currentEdge.start.x;
    mergedEdges.push({
      ...currentEdge,
      lengthCells,
      lengthReal: lengthCells * cellSize,
    });
  }

  // 垂直辺をX座標でグループ化して結合
  const verticalGroups = new Map<number, RawEdge[]>();
  for (const edge of verticalEdges) {
    const key = edge.start.x;
    if (!verticalGroups.has(key)) {
      verticalGroups.set(key, []);
    }
    verticalGroups.get(key)!.push(edge);
  }

  for (const [, group] of verticalGroups) {
    // Y座標でソート
    group.sort((a, b) => a.start.y - b.start.y);

    let currentEdge = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const nextEdge = group[i];
      // 連続しているかチェック
      if (currentEdge.end.y === nextEdge.start.y) {
        // 結合
        currentEdge.end = nextEdge.end;
      } else {
        // 保存して新しい辺を開始
        const lengthCells = currentEdge.end.y - currentEdge.start.y;
        mergedEdges.push({
          ...currentEdge,
          lengthCells,
          lengthReal: lengthCells * cellSize,
        });
        currentEdge = { ...nextEdge };
      }
    }
    // 最後の辺を保存
    const lengthCells = currentEdge.end.y - currentEdge.start.y;
    mergedEdges.push({
      ...currentEdge,
      lengthCells,
      lengthReal: lengthCells * cellSize,
    });
  }

  return mergedEdges;
};

/**
 * 外周の辺を計算（凹凸形状対応）
 * 注: シンプルな矩形の場合は4辺、凹凸がある場合はより多くの辺を返す
 */
export const calculateOuterEdges = (
  cells: CellCoordinate[],
  cellSize: number
): EdgeInfo[] => {
  if (cells.length === 0) return [];

  // セルのセットを作成（高速検索用）
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));

  const edges: EdgeInfo[] = [];

  // 各セルの各辺をチェック
  for (const [x, y] of cells) {
    // 上辺
    if (!cellSet.has(`${x},${y - 1}`)) {
      edges.push({
        start: { x, y },
        end: { x: x + 1, y },
        lengthCells: 1,
        lengthReal: cellSize,
        direction: 'horizontal',
      });
    }
    // 下辺
    if (!cellSet.has(`${x},${y + 1}`)) {
      edges.push({
        start: { x, y: y + 1 },
        end: { x: x + 1, y: y + 1 },
        lengthCells: 1,
        lengthReal: cellSize,
        direction: 'horizontal',
      });
    }
    // 左辺
    if (!cellSet.has(`${x - 1},${y}`)) {
      edges.push({
        start: { x, y },
        end: { x, y: y + 1 },
        lengthCells: 1,
        lengthReal: cellSize,
        direction: 'vertical',
      });
    }
    // 右辺
    if (!cellSet.has(`${x + 1},${y}`)) {
      edges.push({
        start: { x: x + 1, y },
        end: { x: x + 1, y: y + 1 },
        lengthCells: 1,
        lengthReal: cellSize,
        direction: 'vertical',
      });
    }
  }

  // 連続する辺を結合
  return mergeEdges(edges, cellSize);
};
