import { useCallback } from 'react';
import { Group } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { GridObjectShape } from './GridObjectShape';

/**
 * ObjectsLayer コンポーネント
 * 作成済みのグリッドオブジェクトを描画する
 */
export const ObjectsLayer = () => {
  // ストアから状態取得
  const {
    objects,
    selectedObjectId,
    toolMode,
    selectObject,
    updateObject,
  } = useCanvasStore();

  const { basePixelSize } = useGridSettingsStore();
  const gridSize = basePixelSize;

  /**
   * オブジェクトクリック時の処理
   */
  const handleObjectClick = useCallback(
    (objectId: string) => {
      if (toolMode === 'select') {
        selectObject(objectId);
      }
    },
    [toolMode, selectObject]
  );

  /**
   * オブジェクトドラッグ終了時の処理
   */
  const handleDragEnd = useCallback(
    (objectId: string, newPosition: { x: number; y: number }) => {
      updateObject(objectId, { position: newPosition });
    },
    [updateObject]
  );

  return (
    <Group>
      {objects.map((obj) => (
        <GridObjectShape
          key={obj.id}
          object={obj}
          gridSize={gridSize}
          isSelected={obj.id === selectedObjectId}
          draggable={toolMode === 'select'}
          onClick={() => handleObjectClick(obj.id)}
          onDragEnd={(newPosition) => handleDragEnd(obj.id, newPosition)}
        />
      ))}
    </Group>
  );
};
