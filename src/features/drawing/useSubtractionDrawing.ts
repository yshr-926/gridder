import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { CellCoordinate } from '@/types';

/**
 * セルのキー文字列を生成（重複検出用）
 */
const cellKey = (x: number, y: number): string => `${x},${y}`;

/**
 * 減算描画の結果
 */
export interface SubtractionResult {
  /** 操作が成功したかどうか */
  success: boolean;
  /** 削除されたセル数 */
  removedCount: number;
  /** オブジェクトが削除されたかどうか */
  objectRemoved: boolean;
}

/**
 * useSubtractionDrawing - 減算描画モードを管理するフック
 *
 * 選択中のオブジェクトからセルを削除する機能を提供します。
 * クリックまたはドラッグで削除対象のセルを指定できます。
 *
 * @returns 減算描画の操作メソッド
 *
 * @example
 * ```tsx
 * const { subtractCell, subtractDrag } = useSubtractionDrawing();
 *
 * // 単一セルを削除
 * subtractCell(5, 10);
 *
 * // 複数セルをドラッグで削除
 * subtractDrag([{ x: 5, y: 10 }, { x: 6, y: 10 }]);
 * ```
 */
export const useSubtractionDrawing = () => {
  const objects = useCanvasStore((state) => state.objects);
  const selectedObjectId = useCanvasStore((state) => state.selectedObjectId);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const removeObject = useCanvasStore((state) => state.removeObject);

  /**
   * グローバル座標からオブジェクトのローカル座標に変換
   *
   * @param globalX - グローバルX座標（グリッド単位）
   * @param globalY - グローバルY座標（グリッド単位）
   * @returns ローカル座標、または選択オブジェクトがない場合はnull
   */
  const globalToLocal = useCallback(
    (globalX: number, globalY: number): CellCoordinate | null => {
      if (!selectedObjectId) return null;

      const object = objects.find((o) => o.id === selectedObjectId);
      if (!object) return null;

      const localX = globalX - object.position.x;
      const localY = globalY - object.position.y;

      return [localX, localY];
    },
    [objects, selectedObjectId]
  );

  /**
   * ローカル座標がオブジェクトのセルに含まれるかチェック
   *
   * @param localX - ローカルX座標
   * @param localY - ローカルY座標
   * @returns セルがオブジェクトに含まれる場合はtrue
   */
  const isLocalCellInObject = useCallback(
    (localX: number, localY: number): boolean => {
      if (!selectedObjectId) return false;

      const object = objects.find((o) => o.id === selectedObjectId);
      if (!object) return false;

      return object.cells.some(([x, y]) => x === localX && y === localY);
    },
    [objects, selectedObjectId]
  );

  /**
   * 選択中のオブジェクトからセルを削除
   *
   * @param cellsToRemove - 削除するセルのローカル座標配列
   * @returns 削除結果
   */
  const subtractCells = useCallback(
    (cellsToRemove: CellCoordinate[]): SubtractionResult => {
      if (!selectedObjectId) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      const object = objects.find((o) => o.id === selectedObjectId);
      if (!object) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      // 削除するセルをセットに変換（高速ルックアップ）
      const removeSet = new Set(
        cellsToRemove.map(([x, y]) => cellKey(x, y))
      );

      // 残るセルをフィルタリング
      const remainingCells = object.cells.filter(
        ([x, y]) => !removeSet.has(cellKey(x, y))
      );

      const removedCount = object.cells.length - remainingCells.length;

      if (removedCount === 0) {
        // 何も変わらなかった
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      if (remainingCells.length === 0) {
        // すべてのセルが削除された場合はオブジェクトを削除
        removeObject(selectedObjectId);
        return { success: true, removedCount, objectRemoved: true };
      }

      // オブジェクトを更新
      updateObject(selectedObjectId, { cells: remainingCells });
      return { success: true, removedCount, objectRemoved: false };
    },
    [objects, selectedObjectId, updateObject, removeObject]
  );

  /**
   * 単一セルを削除（グローバル座標指定）
   *
   * @param globalX - グローバルX座標（グリッド単位）
   * @param globalY - グローバルY座標（グリッド単位）
   * @returns 削除結果
   */
  const subtractCell = useCallback(
    (globalX: number, globalY: number): SubtractionResult => {
      const local = globalToLocal(globalX, globalY);
      if (!local) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      if (!isLocalCellInObject(local[0], local[1])) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      return subtractCells([local]);
    },
    [globalToLocal, isLocalCellInObject, subtractCells]
  );

  /**
   * 矩形領域のセルを削除（グローバル座標指定）
   *
   * @param x1 - 始点X座標（グリッド単位）
   * @param y1 - 始点Y座標（グリッド単位）
   * @param x2 - 終点X座標（グリッド単位）
   * @param y2 - 終点Y座標（グリッド単位）
   * @returns 削除結果
   */
  const subtractRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number): SubtractionResult => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      const cellsToRemove: CellCoordinate[] = [];

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const local = globalToLocal(x, y);
          if (local && isLocalCellInObject(local[0], local[1])) {
            cellsToRemove.push(local);
          }
        }
      }

      if (cellsToRemove.length === 0) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      return subtractCells(cellsToRemove);
    },
    [globalToLocal, isLocalCellInObject, subtractCells]
  );

  /**
   * ドラッグで複数セルを削除（グローバル座標配列）
   *
   * @param cells - 削除対象セルのグローバル座標配列
   * @returns 削除結果
   */
  const subtractDrag = useCallback(
    (cells: { x: number; y: number }[]): SubtractionResult => {
      const cellsToRemove: CellCoordinate[] = [];

      for (const { x, y } of cells) {
        const local = globalToLocal(x, y);
        if (local && isLocalCellInObject(local[0], local[1])) {
          // 重複を避ける
          const key = cellKey(local[0], local[1]);
          if (!cellsToRemove.some(([lx, ly]) => cellKey(lx, ly) === key)) {
            cellsToRemove.push(local);
          }
        }
      }

      if (cellsToRemove.length === 0) {
        return { success: false, removedCount: 0, objectRemoved: false };
      }

      return subtractCells(cellsToRemove);
    },
    [globalToLocal, isLocalCellInObject, subtractCells]
  );

  /**
   * グローバル座標がオブジェクトのセルに含まれるかチェック
   *
   * @param globalX - グローバルX座標（グリッド単位）
   * @param globalY - グローバルY座標（グリッド単位）
   * @returns セルがオブジェクトに含まれる場合はtrue
   */
  const isGlobalCellInObject = useCallback(
    (globalX: number, globalY: number): boolean => {
      const local = globalToLocal(globalX, globalY);
      if (!local) return false;
      return isLocalCellInObject(local[0], local[1]);
    },
    [globalToLocal, isLocalCellInObject]
  );

  /**
   * 減算モードが利用可能かどうか
   * （オブジェクトが選択されている場合のみ利用可能）
   */
  const isSubtractionAvailable = selectedObjectId !== null;

  return {
    // 状態
    isSubtractionAvailable,

    // アクション
    subtractCells,
    subtractCell,
    subtractRect,
    subtractDrag,

    // ユーティリティ
    globalToLocal,
    isLocalCellInObject,
    isGlobalCellInObject,
  };
};
