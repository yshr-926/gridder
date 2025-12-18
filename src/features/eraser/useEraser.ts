import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateId } from '@/utils/id';
import type { CellCoordinate, GridObject } from '@/types';

/**
 * 4方向の隣接セル（消しゴム分割検出用）
 * 消しゴムではより厳密な4方向接続を使用
 */
const DIRECTIONS_4: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * セルのキー文字列を生成（重複検出用）
 */
const cellKey = (x: number, y: number): string => `${x},${y}`;

/**
 * セル座標配列をキーセットに変換
 */
const cellsToSet = (cells: CellCoordinate[]): Set<string> => {
  return new Set(cells.map(([x, y]) => cellKey(x, y)));
};

/**
 * 連続領域をグループ化（4方向接続）
 * 消しゴムでの分割判定に使用
 */
export const groupConnectedCells4Direction = (
  cells: CellCoordinate[]
): CellCoordinate[][] => {
  if (cells.length === 0) return [];

  const cellSet = cellsToSet(cells);
  const visited = new Set<string>();
  const groups: CellCoordinate[][] = [];

  /**
   * 深さ優先探索で接続セルを収集
   */
  const dfs = (x: number, y: number, group: CellCoordinate[]): void => {
    const key = cellKey(x, y);
    if (visited.has(key) || !cellSet.has(key)) return;

    visited.add(key);
    group.push([x, y]);

    for (const [dx, dy] of DIRECTIONS_4) {
      dfs(x + dx, y + dy, group);
    }
  };

  for (const [x, y] of cells) {
    const key = cellKey(x, y);
    if (!visited.has(key)) {
      const group: CellCoordinate[] = [];
      dfs(x, y, group);
      if (group.length > 0) {
        groups.push(group);
      }
    }
  }

  return groups;
};

/**
 * セル座標を正規化（バウンディングボックスの左上を原点に）
 */
const normalizeCells = (
  cells: CellCoordinate[]
): { normalizedCells: CellCoordinate[]; minX: number; minY: number } => {
  if (cells.length === 0) {
    return { normalizedCells: [], minX: 0, minY: 0 };
  }

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  const normalizedCells = cells.map(
    ([x, y]) => [x - minX, y - minY] as CellCoordinate
  );

  return { normalizedCells, minX, minY };
};

/**
 * オブジェクト内のセルをグローバル座標に変換
 */
const getGlobalCells = (obj: GridObject): CellCoordinate[] => {
  return obj.cells.map(
    ([cx, cy]) => [cx + obj.position.x, cy + obj.position.y] as CellCoordinate
  );
};

/**
 * 座標にあるセルを含むオブジェクトを検索
 */
export const findCellInObjects = (
  targetX: number,
  targetY: number,
  objects: GridObject[]
): { object: GridObject; cellIndex: number } | null => {
  for (const obj of objects) {
    const globalCells = getGlobalCells(obj);
    const cellIndex = globalCells.findIndex(
      ([gx, gy]) => gx === targetX && gy === targetY
    );
    if (cellIndex !== -1) {
      return { object: obj, cellIndex };
    }
  }
  return null;
};

/**
 * useEraser - 消しゴムモードの操作を管理するフック
 *
 * 機能:
 * - クリック/ドラッグによるセル消去
 * - 空になったオブジェクトの自動削除
 * - 消去によるオブジェクト分割
 */
export const useEraser = () => {
  const { objects, updateObject, removeObject, addObject } = useCanvasStore();

  const isErasingRef = useRef(false);

  /**
   * 指定座標のセルを消去
   */
  const eraseCell = useCallback(
    (targetX: number, targetY: number) => {
      const currentObjects = useCanvasStore.getState().objects;
      const found = findCellInObjects(targetX, targetY, currentObjects);

      if (!found) return;

      const { object: obj, cellIndex } = found;
      const globalCells = getGlobalCells(obj);

      // 最後のセルの場合、オブジェクト全体を削除
      if (obj.cells.length === 1) {
        removeObject(obj.id);
        return;
      }

      // セルを削除
      const remainingGlobalCells = globalCells.filter(
        (_, i) => i !== cellIndex
      );

      // 分割チェック: 4方向接続でグループ化
      const groups = groupConnectedCells4Direction(remainingGlobalCells);

      if (groups.length === 1) {
        // 分離していない場合: 単純に更新
        const { normalizedCells, minX, minY } = normalizeCells(groups[0]);
        updateObject(obj.id, {
          cells: normalizedCells,
          position: { x: minX, y: minY },
        });
      } else {
        // 分離した場合: 元のオブジェクトを削除し、各グループを新オブジェクトとして作成
        removeObject(obj.id);

        for (const group of groups) {
          const { normalizedCells, minX, minY } = normalizeCells(group);

          const newObject: GridObject = {
            id: generateId('obj'),
            cells: normalizedCells,
            position: { x: minX, y: minY },
            rotation: obj.rotation,
            color: obj.color,
          };

          addObject(newObject);
        }
      }
    },
    [updateObject, removeObject, addObject]
  );

  /**
   * 消しゴム開始
   */
  const startErasing = useCallback(
    (cell: CellCoordinate) => {
      isErasingRef.current = true;
      eraseCell(cell[0], cell[1]);
    },
    [eraseCell]
  );

  /**
   * 消しゴム継続（ドラッグ中）
   */
  const continueErasing = useCallback(
    (cell: CellCoordinate) => {
      if (!isErasingRef.current) return;
      eraseCell(cell[0], cell[1]);
    },
    [eraseCell]
  );

  /**
   * 消しゴム終了
   */
  const endErasing = useCallback(() => {
    isErasingRef.current = false;
  }, []);

  /**
   * 消しゴム中かどうかを取得
   */
  const getIsErasing = useCallback((): boolean => {
    return isErasingRef.current;
  }, []);

  return {
    // アクション
    startErasing,
    continueErasing,
    endErasing,
    eraseCell,
    getIsErasing,
    findCellInObjects: (targetX: number, targetY: number) =>
      findCellInObjects(targetX, targetY, objects),
  };
};
