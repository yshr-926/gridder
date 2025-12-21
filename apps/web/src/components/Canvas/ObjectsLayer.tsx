import { useCallback, useMemo, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useMultiSelection } from '@/features/selection/useMultiSelection';
import { GridObjectShape } from './GridObjectShape';
import type { Position } from '@/types';

// パフォーマンス最適化: 個別セレクタを定義
const selectObjects = (state: ReturnType<typeof useCanvasStore.getState>) => state.objects;
const selectSelection = (state: ReturnType<typeof useCanvasStore.getState>) => state.selection;
const selectToolMode = (state: ReturnType<typeof useCanvasStore.getState>) => state.toolMode;
const selectSelectObject = (state: ReturnType<typeof useCanvasStore.getState>) => state.selectObject;
const selectUpdateObject = (state: ReturnType<typeof useCanvasStore.getState>) => state.updateObject;

/**
 * ドラッグ開始時の状態を記録する型
 */
interface DragStartState {
  /** ドラッグ開始時のアンカーオブジェクトの位置 */
  anchorPosition: Position;
  /** 各オブジェクトの相対位置 */
  relativePositions: Map<string, Position>;
}

/**
 * ObjectsLayer コンポーネント
 * 作成済みのグリッドオブジェクトを描画する
 * 複数選択時のドラッグ操作をサポート
 */
export const ObjectsLayer = () => {
  // ストアから状態取得（個別セレクタで必要な状態のみ購読）
  const objects = useCanvasStore(selectObjects);
  const selection = useCanvasStore(selectSelection);
  const toolMode = useCanvasStore(selectToolMode);
  const selectObject = useCanvasStore(selectSelectObject);
  const updateObject = useCanvasStore(selectUpdateObject);

  const { basePixelSize } = useGridSettingsStore();
  const gridSize = basePixelSize;

  const {
    selectedObjects,
    hasMultipleSelection,
    moveSelectedObjectsTo,
    cacheRelativePositions,
    getRelativePositions,
  } = useMultiSelection();

  // 複数選択時のドラッグ状態を管理
  const dragStartRef = useRef<DragStartState | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);

  /**
   * オブジェクトクリック時の処理
   * Shift+クリックで複数選択
   */
  const handleObjectClick = useCallback(
    (objectId: string, event: KonvaEventObject<MouseEvent>) => {
      if (toolMode === 'select') {
        const isShiftPressed = event.evt.shiftKey;
        selectObject(objectId, isShiftPressed);
      }
    },
    [toolMode, selectObject]
  );

  /**
   * ドラッグ開始ハンドラ
   * 最適化: 相対位置をキャッシュし、ドラッグ中の再計算を防止
   */
  const handleDragStart = useCallback(
    (objectId: string, e: KonvaEventObject<DragEvent>) => {
      if (toolMode !== 'select') {
        e.target.stopDrag();
        return;
      }

      const isAlreadySelected = selection.selectedIds.includes(objectId);

      // 選択されていないオブジェクトをドラッグした場合は選択
      if (!isAlreadySelected) {
        selectObject(objectId);
      }

      // 相対位置をキャッシュ（ドラッグ開始時のみ）
      cacheRelativePositions();

      // 複数選択時: キャッシュした相対位置を使用
      if (hasMultipleSelection && isAlreadySelected) {
        const anchor = selectedObjects.find((o) => o.id === objectId);
        if (anchor) {
          dragStartRef.current = {
            anchorPosition: { ...anchor.position },
            relativePositions: getRelativePositions(),
          };
        }
      }

      setDraggingObjectId(objectId);
    },
    [
      toolMode,
      hasMultipleSelection,
      selection.selectedIds,
      selectedObjects,
      cacheRelativePositions,
      getRelativePositions,
      selectObject,
    ]
  );

  /**
   * ドラッグ移動ハンドラ
   * 複数選択時はグリッドスナップを適用
   */
  const handleDragMove = useCallback(
    (objectId: string, e: KonvaEventObject<DragEvent>) => {
      if (hasMultipleSelection && selection.selectedIds.includes(objectId)) {
        // 複数選択時: グリッドスナップ処理
        const target = e.target;
        const snappedX = Math.round(target.x() / gridSize) * gridSize;
        const snappedY = Math.round(target.y() / gridSize) * gridSize;
        target.x(snappedX);
        target.y(snappedY);
      }
    },
    [hasMultipleSelection, selection.selectedIds, gridSize]
  );

  /**
   * ドラッグ終了ハンドラ
   */
  const handleDragEnd = useCallback(
    (objectId: string, e: KonvaEventObject<DragEvent>) => {
      const target = e.target;

      // グリッド座標に変換
      const gridX = Math.round(target.x() / gridSize);
      const gridY = Math.round(target.y() / gridSize);
      const newPosition: Position = { x: gridX, y: gridY };

      if (hasMultipleSelection && selection.selectedIds.includes(objectId) && dragStartRef.current) {
        // 複数選択時: 全オブジェクトを相対位置を維持したまま移動
        moveSelectedObjectsTo(newPosition);
        dragStartRef.current = null;
      } else {
        // 単一選択時: そのオブジェクトのみ移動
        updateObject(objectId, { position: newPosition });
      }

      setDraggingObjectId(null);

      // ドラッグ後の位置をリセット（state で管理するため）
      target.x(newPosition.x * gridSize);
      target.y(newPosition.y * gridSize);
    },
    [
      hasMultipleSelection,
      selection.selectedIds,
      moveSelectedObjectsTo,
      updateObject,
      gridSize,
    ]
  );

  /**
   * 単一オブジェクトのドラッグ終了（GridObjectShape から呼ばれる形式）
   */
  const handleSingleDragEnd = useCallback(
    (objectId: string, newPosition: { x: number; y: number }) => {
      // hasMultipleSelection が false の場合のみ単一更新
      if (!hasMultipleSelection) {
        updateObject(objectId, { position: newPosition });
      }
      // 複数選択時は handleDragEnd で処理されるため何もしない
    },
    [hasMultipleSelection, updateObject]
  );

  /**
   * 選択インジケータ用のバウンディングボックスをメモ化
   * selectedObjects/gridSize/primaryId 変更時のみ再計算
   */
  const selectionIndicators = useMemo(() => {
    if (selectedObjects.length === 0) return null;

    return selectedObjects.map((obj) => {
      if (obj.cells.length === 0) return null;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [cx, cy] of obj.cells) {
        const globalX = cx + obj.position.x;
        const globalY = cy + obj.position.y;
        minX = Math.min(minX, globalX);
        minY = Math.min(minY, globalY);
        maxX = Math.max(maxX, globalX + 1);
        maxY = Math.max(maxY, globalY + 1);
      }

      const isPrimary = obj.id === selection.primaryId;

      return (
        <Rect
          key={`selection-${obj.id}`}
          x={minX * gridSize}
          y={minY * gridSize}
          width={(maxX - minX) * gridSize}
          height={(maxY - minY) * gridSize}
          stroke={isPrimary ? '#0066cc' : '#66aaff'}
          strokeWidth={2}
          dash={[4, 4]}
          listening={false}
        />
      );
    });
  }, [selectedObjects, selection.primaryId, gridSize]);

  return (
    <Group>
      {objects.map((obj) => {
        const isSelected = selection.selectedIds.includes(obj.id);
        const isDragging = draggingObjectId !== null && isSelected;

        return (
          <GridObjectShape
            key={obj.id}
            object={obj}
            gridSize={gridSize}
            isSelected={isSelected}
            isDragging={isDragging}
            draggable={toolMode === 'select'}
            onClick={(e) => handleObjectClick(obj.id, e)}
            onDragStart={(e) => handleDragStart(obj.id, e)}
            onDragMove={(e) => handleDragMove(obj.id, e)}
            onDragEnd={(e) => handleDragEnd(obj.id, e)}
            onSingleDragEnd={(newPosition) => handleSingleDragEnd(obj.id, newPosition)}
          />
        );
      })}

      {/* 複数選択時のインジケータ（メモ化済み） */}
      {selectionIndicators}
    </Group>
  );
};
