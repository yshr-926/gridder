import { useCallback, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useMultiSelection } from '@/features/selection/useMultiSelection';
import { GridObjectShape } from './GridObjectShape';
import type { Position } from '@/types';

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
  // ストアから状態取得
  const {
    objects,
    selection,
    toolMode,
    selectObject,
    updateObject,
  } = useCanvasStore();

  const { basePixelSize } = useGridSettingsStore();
  const gridSize = basePixelSize;

  const {
    selectedObjects,
    hasMultipleSelection,
    moveSelectedObjectsTo,
    calculateRelativePositions,
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
   */
  const handleDragStart = useCallback(
    (objectId: string, e: KonvaEventObject<DragEvent>) => {
      if (toolMode !== 'select') {
        e.target.stopDrag();
        return;
      }

      // 選択されていないオブジェクトをドラッグした場合は選択
      if (!selection.selectedIds.includes(objectId)) {
        selectObject(objectId);
      }

      // 複数選択時: 相対位置を記録
      if (hasMultipleSelection && selection.selectedIds.includes(objectId)) {
        const anchor = selectedObjects.find((o) => o.id === objectId);
        if (anchor) {
          dragStartRef.current = {
            anchorPosition: { ...anchor.position },
            relativePositions: calculateRelativePositions(),
          };
          setDraggingObjectId(objectId);
        }
      } else {
        setDraggingObjectId(objectId);
      }
    },
    [
      toolMode,
      hasMultipleSelection,
      selection.selectedIds,
      selectedObjects,
      calculateRelativePositions,
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
   * 選択インジケータのバウンディングボックスを計算
   */
  const calculateBoundingBox = (obj: typeof objects[number]) => {
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

    return {
      x: minX * gridSize,
      y: minY * gridSize,
      width: (maxX - minX) * gridSize,
      height: (maxY - minY) * gridSize,
    };
  };

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

      {/* 複数選択時のインジケータ */}
      {selectedObjects.length > 0 &&
        selectedObjects.map((obj) => {
          const box = calculateBoundingBox(obj);
          if (!box) return null;

          const isPrimary = obj.id === selection.primaryId;

          return (
            <Rect
              key={`selection-${obj.id}`}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              stroke={isPrimary ? '#0066cc' : '#66aaff'}
              strokeWidth={2}
              dash={[4, 4]}
              listening={false}
            />
          );
        })}
    </Group>
  );
};
