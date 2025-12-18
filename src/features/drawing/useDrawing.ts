import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateId } from '@/utils/id';
import type { CellCoordinate, GridObject } from '@/types';

/**
 * 8方向の隣接セル（連続領域検出用）
 */
const DIRECTIONS_8: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
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
 * 連続領域をグループ化（8方向接続）
 * 深さ優先探索で接続されたセルをグループ化
 */
export const groupConnectedCells = (
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

    for (const [dx, dy] of DIRECTIONS_8) {
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
export const normalizeCells = (
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
 * 描画モードの状態
 */
interface DrawingState {
  /** 描画中かどうか */
  isDrawing: boolean;
  /** 描画中のセル座標 */
  drawingCells: CellCoordinate[];
}

/**
 * useDrawing - 描画モードの操作を管理するフック
 *
 * 機能:
 * - クリック/ドラッグによる描画
 * - 連続領域の検出とオブジェクト生成
 * - 描画中のリアルタイムプレビュー
 */
export const useDrawing = () => {
  const {
    drawingCells,
    addDrawingCell,
    clearDrawingCells,
    addObject,
  } = useCanvasStore();

  const isDrawingRef = useRef(false);

  /**
   * 描画を開始
   */
  const startDrawing = useCallback(
    (cell: CellCoordinate) => {
      isDrawingRef.current = true;
      addDrawingCell(cell);
    },
    [addDrawingCell]
  );

  /**
   * 描画を継続（ドラッグ中）
   */
  const continueDrawing = useCallback(
    (cell: CellCoordinate) => {
      if (!isDrawingRef.current) return;
      addDrawingCell(cell);
    },
    [addDrawingCell]
  );

  /**
   * 描画を終了・確定
   * 連続領域を検出し、各グループを別オブジェクトとして生成
   */
  const endDrawing = useCallback(
    (color: string = '#333333') => {
      isDrawingRef.current = false;

      // Get current drawing cells from store
      const currentDrawingCells = useCanvasStore.getState().drawingCells;

      if (currentDrawingCells.length === 0) return;

      // 連続領域をグループ化
      const groups = groupConnectedCells(currentDrawingCells);

      // 各グループをオブジェクトとして生成
      for (const group of groups) {
        const { normalizedCells, minX, minY } = normalizeCells(group);

        const newObject: GridObject = {
          id: generateId('obj'),
          cells: normalizedCells,
          position: { x: minX, y: minY },
          rotation: 0,
          color,
        };

        addObject(newObject);
      }

      clearDrawingCells();
    },
    [addObject, clearDrawingCells]
  );

  /**
   * 描画をキャンセル
   */
  const cancelDrawing = useCallback(() => {
    isDrawingRef.current = false;
    clearDrawingCells();
  }, [clearDrawingCells]);

  /**
   * 現在の描画状態を取得
   */
  const getDrawingState = useCallback((): DrawingState => {
    return {
      isDrawing: isDrawingRef.current,
      drawingCells,
    };
  }, [drawingCells]);

  /**
   * 描画中かどうかを取得
   */
  const getIsDrawing = useCallback((): boolean => {
    return isDrawingRef.current;
  }, []);

  return {
    // 状態
    drawingCells,

    // アクション
    startDrawing,
    continueDrawing,
    endDrawing,
    cancelDrawing,
    getDrawingState,
    getIsDrawing,
  };
};
