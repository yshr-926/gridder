import { useCallback, useMemo, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateId } from '@/utils/id';
import { getNextObjectColor } from '@/utils/colorPalette';
import type { Position, GridObject } from '@/types';

/**
 * バウンディングボックスの型
 */
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 複数選択の操作を管理するフック
 *
 * 機能:
 * - 選択中のオブジェクト一覧取得
 * - 相対位置を維持した一括移動
 * - 一括削除
 * - 一括複製（新しい色を自動割り当て）
 * - バウンディングボックス計算
 */
export const useMultiSelection = () => {
  const {
    objects,
    selection,
    updateObject,
    removeObject,
    addObject,
    clearSelection,
    selectObjects,
  } = useCanvasStore();

  /**
   * 選択オブジェクトIDセットをメモ化（Set は includes より高速）
   */
  const selectedIdSet = useMemo(
    () => new Set(selection.selectedIds),
    [selection.selectedIds]
  );

  /**
   * 選択中のオブジェクトを取得
   * Set を使用して O(1) ルックアップを実現
   */
  const selectedObjects = useMemo(() => {
    // selectedIds が空の場合は早期リターン
    if (selectedIdSet.size === 0) return [];

    return objects.filter((obj) => selectedIdSet.has(obj.id));
  }, [objects, selectedIdSet]);

  /**
   * 相対位置はドラッグ開始時に一度だけ計算し、ref で保持
   */
  const relativePositionsRef = useRef<Map<string, Position>>(new Map());

  /**
   * 相対位置を計算してキャッシュ
   * ドラッグ開始時に呼び出す
   */
  const cacheRelativePositions = useCallback(() => {
    const relativePositions = new Map<string, Position>();

    if (selectedObjects.length === 0) {
      relativePositionsRef.current = relativePositions;
      return;
    }

    const anchor = selectedObjects[0];

    for (const obj of selectedObjects) {
      relativePositions.set(obj.id, {
        x: obj.position.x - anchor.position.x,
        y: obj.position.y - anchor.position.y,
      });
    }

    relativePositionsRef.current = relativePositions;
  }, [selectedObjects]);

  /**
   * キャッシュされた相対位置を取得
   */
  const getRelativePositions = useCallback(() => {
    return relativePositionsRef.current;
  }, []);

  /**
   * 選択オブジェクトの相対位置を計算
   * アンカーオブジェクト（最初に選択されたオブジェクト）からの相対位置を返す
   * @deprecated cacheRelativePositions と getRelativePositions を使用してください
   */
  const calculateRelativePositions = useCallback((): Map<string, Position> => {
    const relativePositions = new Map<string, Position>();

    if (selectedObjects.length === 0) return relativePositions;

    // 最初のオブジェクトを基準（アンカー）とする
    const anchor = selectedObjects[0];

    for (const obj of selectedObjects) {
      relativePositions.set(obj.id, {
        x: obj.position.x - anchor.position.x,
        y: obj.position.y - anchor.position.y,
      });
    }

    return relativePositions;
  }, [selectedObjects]);

  /**
   * 選択オブジェクトを一括移動（相対移動）
   * 全オブジェクトを同じ距離だけ移動する
   *
   * @param deltaX - X方向の移動量（グリッド単位）
   * @param deltaY - Y方向の移動量（グリッド単位）
   */
  const moveSelectedObjects = useCallback(
    (deltaX: number, deltaY: number) => {
      for (const obj of selectedObjects) {
        updateObject(obj.id, {
          position: {
            x: obj.position.x + deltaX,
            y: obj.position.y + deltaY,
          },
        });
      }
    },
    [selectedObjects, updateObject]
  );

  /**
   * 選択オブジェクトを一括移動（絶対位置指定）
   * アンカーオブジェクトを指定位置に移動し、他のオブジェクトは相対位置を維持
   *
   * @param newAnchorPosition - アンカーオブジェクトの新しい位置
   */
  const moveSelectedObjectsTo = useCallback(
    (newAnchorPosition: Position) => {
      if (selectedObjects.length === 0) return;

      const relativePositions = calculateRelativePositions();

      for (const obj of selectedObjects) {
        const relative = relativePositions.get(obj.id) ?? { x: 0, y: 0 };
        updateObject(obj.id, {
          position: {
            x: newAnchorPosition.x + relative.x,
            y: newAnchorPosition.y + relative.y,
          },
        });
      }
    },
    [selectedObjects, calculateRelativePositions, updateObject]
  );

  /**
   * 選択オブジェクトを一括削除
   */
  const deleteSelectedObjects = useCallback(() => {
    // 逆順で削除（選択状態の更新と競合を避けるため）
    const idsToDelete = [...selectedObjects.map((obj) => obj.id)];
    for (const id of idsToDelete) {
      removeObject(id);
    }
    // 選択解除はremoveObject内で自動的に行われる
  }, [selectedObjects, removeObject]);

  /**
   * 選択オブジェクトを一括複製
   * 各オブジェクトに新しい色を自動割り当て（Phase 12 ColorPaletteManager と連携）
   * 複製されたオブジェクトは元の位置から1グリッドずらして配置
   */
  const duplicateSelectedObjects = useCallback(() => {
    if (selectedObjects.length === 0) return;

    const newIds: string[] = [];

    // オフセット（複製後の位置ずらし）
    const offset = { x: 1, y: 1 };

    for (const obj of selectedObjects) {
      // 新しい色を割り当て（getNextObjectColor は使用回数も自動記録）
      const newColor = getNextObjectColor();

      const newObject: GridObject = {
        ...obj,
        id: generateId('obj'),
        color: newColor,
        position: {
          x: obj.position.x + offset.x,
          y: obj.position.y + offset.y,
        },
        // 名前がある場合はコピーであることを明示
        name: obj.name ? `${obj.name} (コピー)` : undefined,
      };

      addObject(newObject);
      newIds.push(newObject.id);
    }

    // 複製したオブジェクトを選択
    selectObjects(newIds);
  }, [selectedObjects, addObject, selectObjects]);

  /**
   * 選択オブジェクトのバウンディングボックスを計算
   * 全選択オブジェクトを囲む最小の矩形を返す
   */
  const getSelectionBoundingBox = useCallback((): BoundingBox | null => {
    if (selectedObjects.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of selectedObjects) {
      for (const [cx, cy] of obj.cells) {
        const globalX = cx + obj.position.x;
        const globalY = cy + obj.position.y;
        minX = Math.min(minX, globalX);
        minY = Math.min(minY, globalY);
        maxX = Math.max(maxX, globalX + 1);
        maxY = Math.max(maxY, globalY + 1);
      }
    }

    return { minX, minY, maxX, maxY };
  }, [selectedObjects]);

  /**
   * 選択オブジェクトのセンター位置を取得
   */
  const getSelectionCenter = useCallback((): Position | null => {
    const box = getSelectionBoundingBox();
    if (!box) return null;

    return {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY + box.maxY) / 2,
    };
  }, [getSelectionBoundingBox]);

  return {
    // 状態
    selectedObjects,
    selectedCount: selectedObjects.length,
    hasMultipleSelection: selectedObjects.length > 1,
    hasSelection: selectedObjects.length > 0,

    // 操作
    moveSelectedObjects,
    moveSelectedObjectsTo,
    deleteSelectedObjects,
    duplicateSelectedObjects,
    getSelectionBoundingBox,
    getSelectionCenter,
    /** @deprecated cacheRelativePositions と getRelativePositions を使用してください */
    calculateRelativePositions,
    cacheRelativePositions,
    getRelativePositions,
    clearSelection,
  };
};
