/**
 * セル座標関連のユーティリティ関数
 *
 * グリッドセル座標の操作・変換を行うヘルパー関数を提供します。
 */

import type { CellCoordinate, Position } from '@/types';

/**
 * 正規化されたセルと位置の結果
 */
export interface NormalizedCellsResult {
  /** 正規化されたセル配列（左上が原点） */
  normalizedCells: CellCoordinate[];
  /** 正規化前の最小座標（オブジェクトの位置） */
  position: Position;
}

/**
 * セル座標を正規化する
 *
 * セル配列の最小座標（バウンディングボックスの左上）を原点(0,0)に
 * 移動させた新しい配列と、元の最小座標（オブジェクトの位置）を返します。
 *
 * @param cells - 正規化するセル座標の配列
 * @returns 正規化されたセル配列と位置情報
 *
 * @example
 * ```typescript
 * const cells: CellCoordinate[] = [[5, 10], [6, 10], [5, 11]];
 * const result = normalizeCells(cells);
 * // result.normalizedCells = [[0, 0], [1, 0], [0, 1]]
 * // result.position = { x: 5, y: 10 }
 * ```
 */
export const normalizeCells = (
  cells: CellCoordinate[]
): NormalizedCellsResult => {
  if (cells.length === 0) {
    return { normalizedCells: [], position: { x: 0, y: 0 } };
  }

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  const normalizedCells = cells.map(
    ([x, y]) => [x - minX, y - minY] as CellCoordinate
  );

  return {
    normalizedCells,
    position: { x: minX, y: minY },
  };
};

/**
 * セル座標のセットを作成する
 *
 * セル座標の配列から、重複チェック用のSetを作成します。
 * キーは "x,y" 形式の文字列です。
 *
 * @param cells - セル座標の配列
 * @returns セル座標のキーを含むSet
 *
 * @example
 * ```typescript
 * const cells: CellCoordinate[] = [[0, 0], [1, 0]];
 * const cellSet = createCellSet(cells);
 * cellSet.has('0,0'); // true
 * cellSet.has('2,0'); // false
 * ```
 */
export const createCellSet = (cells: CellCoordinate[]): Set<string> => {
  return new Set(cells.map(([x, y]) => `${x},${y}`));
};

/**
 * セルキーを座標に変換する
 *
 * "x,y" 形式の文字列キーをCellCoordinateに変換します。
 *
 * @param key - "x,y" 形式のキー
 * @returns セル座標
 *
 * @example
 * ```typescript
 * const coord = cellKeyToCoordinate('5,10');
 * // coord = [5, 10]
 * ```
 */
export const cellKeyToCoordinate = (key: string): CellCoordinate => {
  const [x, y] = key.split(',').map(Number);
  return [x, y];
};

/**
 * 座標をセルキーに変換する
 *
 * @param x - X座標
 * @param y - Y座標
 * @returns "x,y" 形式のキー
 *
 * @example
 * ```typescript
 * const key = coordinateToCellKey(5, 10);
 * // key = '5,10'
 * ```
 */
export const coordinateToCellKey = (x: number, y: number): string => {
  return `${x},${y}`;
};
