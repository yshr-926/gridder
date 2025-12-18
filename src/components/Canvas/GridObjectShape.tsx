import { memo, useMemo } from 'react';
import { Group, Rect, Line } from 'react-konva';
import type { GridObject } from '@/types';

/**
 * GridObjectShape Props
 */
interface GridObjectShapeProps {
  /** グリッドオブジェクト */
  object: GridObject;
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
  /** 選択状態 */
  isSelected: boolean;
  /** ドラッグ可能かどうか */
  draggable: boolean;
  /** クリック時のコールバック */
  onClick?: () => void;
  /** ドラッグ終了時のコールバック */
  onDragEnd?: (newPosition: { x: number; y: number }) => void;
}

/**
 * 選択時の色
 */
const SELECTION_BORDER_COLOR = '#3b82f6'; // Tailwind blue-500
const SELECTION_FILL_ALPHA = 0.1;
const SELECTION_BORDER_WIDTH = 2;

/**
 * GridObjectShape コンポーネント
 * 個々のグリッドオブジェクトを描画する
 */
/**
 * Custom comparison function for memo
 * Only re-render when object data or selection state changes
 */
const arePropsEqual = (
  prevProps: GridObjectShapeProps,
  nextProps: GridObjectShapeProps
): boolean => {
  // Check if object reference changed
  if (prevProps.object !== nextProps.object) return false;

  // Check scalar props
  if (prevProps.gridSize !== nextProps.gridSize) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.draggable !== nextProps.draggable) return false;

  // Callback references don't need deep comparison for memo
  // They should be stable via useCallback in parent
  return true;
};

export const GridObjectShape = memo(
  ({
    object,
    gridSize,
    isSelected,
    draggable,
    onClick,
    onDragEnd,
  }: GridObjectShapeProps) => {
    const { id, cells, position, rotation, color } = object;

    /**
     * バウンディングボックスの計算
     */
    const boundingBox = useMemo(() => {
      if (cells.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      cells.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });

      return {
        x: minX * gridSize,
        y: minY * gridSize,
        width: (maxX - minX + 1) * gridSize,
        height: (maxY - minY + 1) * gridSize,
      };
    }, [cells, gridSize]);

    /**
     * セルの描画
     */
    const cellRects = useMemo(() => {
      return cells.map(([x, y], index) => (
        <Rect
          key={`${id}-cell-${index}`}
          x={x * gridSize}
          y={y * gridSize}
          width={gridSize}
          height={gridSize}
          fill={color}
          stroke={isSelected ? SELECTION_BORDER_COLOR : undefined}
          strokeWidth={isSelected ? SELECTION_BORDER_WIDTH / 2 : 0}
        />
      ));
    }, [cells, id, gridSize, color, isSelected]);

    /**
     * 選択時のバウンディングボックス
     */
    const selectionHighlight = useMemo(() => {
      if (!isSelected) return null;

      return (
        <>
          {/* 半透明の塗りつぶし */}
          <Rect
            x={boundingBox.x}
            y={boundingBox.y}
            width={boundingBox.width}
            height={boundingBox.height}
            fill={`rgba(59, 130, 246, ${SELECTION_FILL_ALPHA})`}
            listening={false}
          />
          {/* 破線の枠 */}
          <Line
            points={[
              boundingBox.x,
              boundingBox.y,
              boundingBox.x + boundingBox.width,
              boundingBox.y,
              boundingBox.x + boundingBox.width,
              boundingBox.y + boundingBox.height,
              boundingBox.x,
              boundingBox.y + boundingBox.height,
              boundingBox.x,
              boundingBox.y,
            ]}
            stroke={SELECTION_BORDER_COLOR}
            strokeWidth={SELECTION_BORDER_WIDTH}
            dash={[5, 5]}
            listening={false}
          />
        </>
      );
    }, [isSelected, boundingBox]);

    /**
     * ドラッグ終了ハンドラ
     */
    const handleDragEnd = (e: { target: { x: () => number; y: () => number } }) => {
      if (!onDragEnd) return;

      const node = e.target;
      const newX = node.x();
      const newY = node.y();

      // グリッドにスナップ
      const snappedX = Math.round(newX / gridSize) * gridSize;
      const snappedY = Math.round(newY / gridSize) * gridSize;

      // グリッド座標に変換
      const gridX = snappedX / gridSize;
      const gridY = snappedY / gridSize;

      onDragEnd({ x: gridX, y: gridY });
    };

    /**
     * 回転のオフセット計算
     * 回転はバウンディングボックスの中心を軸に行う
     */
    const rotationOffset = useMemo(() => {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;
      return { x: centerX, y: centerY };
    }, [boundingBox]);

    return (
      <Group
        x={position.x * gridSize}
        y={position.y * gridSize}
        rotation={rotation}
        offsetX={rotationOffset.x}
        offsetY={rotationOffset.y}
        draggable={draggable}
        onClick={onClick}
        onTap={onClick}
        onDragEnd={handleDragEnd}
      >
        {/* 回転オフセットを補正するための内部グループ */}
        <Group x={rotationOffset.x} y={rotationOffset.y}>
          {cellRects}
          {selectionHighlight}
        </Group>
      </Group>
    );
  },
  arePropsEqual
);

GridObjectShape.displayName = 'GridObjectShape';
