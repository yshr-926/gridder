import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateId } from '@/utils/id';
import type { CellCoordinate, GridObject, Position } from '@/types';

/**
 * セル座標を正規化（バウンディングボックスの左上を原点に）
 */
const normalizeCells = (
  cells: CellCoordinate[]
): { normalizedCells: CellCoordinate[]; offsetX: number; offsetY: number } => {
  if (cells.length === 0) {
    return { normalizedCells: [], offsetX: 0, offsetY: 0 };
  }

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  const normalizedCells = cells.map(
    ([x, y]) => [x - minX, y - minY] as CellCoordinate
  );

  return { normalizedCells, offsetX: minX, offsetY: minY };
};

/**
 * セルを90度時計回りに回転
 */
const rotateCells90 = (cells: CellCoordinate[]): CellCoordinate[] => {
  if (cells.length === 0) return [];

  // バウンディングボックスの高さを計算（回転に使用）
  const maxY = Math.max(...cells.map(([, y]) => y));

  // 90度時計回り回転: (x, y) -> (maxY - y, x)
  const rotatedCells = cells.map(
    ([x, y]) => [maxY - y, x] as CellCoordinate
  );

  return rotatedCells;
};

/**
 * 座標にあるオブジェクトを検索
 */
export const findObjectAtCell = (
  targetX: number,
  targetY: number,
  objects: GridObject[]
): GridObject | null => {
  for (const obj of objects) {
    const hasCell = obj.cells.some(([cx, cy]) => {
      const globalX = cx + obj.position.x;
      const globalY = cy + obj.position.y;
      return globalX === targetX && globalY === targetY;
    });
    if (hasCell) {
      return obj;
    }
  }
  return null;
};

/**
 * useSelection - 選択・移動モードの操作を管理するフック
 *
 * 機能:
 * - オブジェクトの選択/選択解除
 * - オブジェクトの移動（グリッドスナップ）
 * - 90度回転
 * - 削除
 * - 複製
 */
export const useSelection = () => {
  const {
    objects,
    selectedObjectId,
    selectObject,
    updateObject,
    removeObject,
    addObject,
  } = useCanvasStore();

  /**
   * オブジェクトを選択
   */
  const select = useCallback(
    (id: string) => {
      selectObject(id);
    },
    [selectObject]
  );

  /**
   * 選択解除
   */
  const deselect = useCallback(() => {
    selectObject(null);
  }, [selectObject]);

  /**
   * 選択中のオブジェクトを取得
   */
  const getSelectedObject = useCallback((): GridObject | null => {
    if (!selectedObjectId) return null;
    return objects.find((obj) => obj.id === selectedObjectId) || null;
  }, [selectedObjectId, objects]);

  /**
   * オブジェクトを移動
   */
  const moveObject = useCallback(
    (id: string, newPosition: Position) => {
      updateObject(id, { position: newPosition });
    },
    [updateObject]
  );

  /**
   * 選択中のオブジェクトを相対移動
   */
  const moveSelectedObject = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!selectedObjectId) return;

      const obj = useCanvasStore.getState().objects.find((o) => o.id === selectedObjectId);
      if (!obj) return;

      const newPosition = {
        x: obj.position.x + deltaX,
        y: obj.position.y + deltaY,
      };

      updateObject(selectedObjectId, { position: newPosition });
    },
    [selectedObjectId, updateObject]
  );

  /**
   * 選択中のオブジェクトを90度時計回りに回転
   */
  const rotateSelectedObject = useCallback(() => {
    if (!selectedObjectId) return;

    const obj = useCanvasStore.getState().objects.find((o) => o.id === selectedObjectId);
    if (!obj) return;

    // セルを90度回転
    const rotatedCells = rotateCells90(obj.cells);

    // 回転後のセルを正規化
    const { normalizedCells, offsetX, offsetY } = normalizeCells(rotatedCells);

    // 回転角度を更新（0 -> 90 -> 180 -> 270 -> 0）
    const newRotation = ((obj.rotation + 90) % 360) as 0 | 90 | 180 | 270;

    // 位置を調整（回転による位置ズレを補正）
    const newPosition = {
      x: obj.position.x + offsetX,
      y: obj.position.y + offsetY,
    };

    updateObject(selectedObjectId, {
      cells: normalizedCells,
      rotation: newRotation,
      position: newPosition,
    });
  }, [selectedObjectId, updateObject]);

  /**
   * 選択中のオブジェクトを削除
   */
  const deleteSelectedObject = useCallback(() => {
    if (selectedObjectId) {
      removeObject(selectedObjectId);
    }
  }, [selectedObjectId, removeObject]);

  /**
   * 選択中のオブジェクトを複製
   * 複製したオブジェクトを新しく選択状態にする
   */
  const duplicateSelectedObject = useCallback(() => {
    if (!selectedObjectId) return null;

    const obj = useCanvasStore.getState().objects.find((o) => o.id === selectedObjectId);
    if (!obj) return null;

    const newObject: GridObject = {
      ...obj,
      id: generateId('obj'),
      position: {
        x: obj.position.x + 1,
        y: obj.position.y + 1,
      },
    };

    addObject(newObject);
    selectObject(newObject.id);

    return newObject;
  }, [selectedObjectId, addObject, selectObject]);

  /**
   * 座標からオブジェクトを検索（公開ヘルパー）
   */
  const findObjectAt = useCallback(
    (targetX: number, targetY: number): GridObject | null => {
      return findObjectAtCell(targetX, targetY, objects);
    },
    [objects]
  );

  return {
    // 状態
    selectedObjectId,
    selectedObject: getSelectedObject(),

    // 選択操作
    select,
    deselect,
    getSelectedObject,
    findObjectAtCell: findObjectAt,

    // 変形操作
    moveObject,
    moveSelectedObject,
    rotateSelectedObject,
    deleteSelectedObject,
    duplicateSelectedObject,
  };
};
