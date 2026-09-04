import { memo, useMemo } from 'react';
import { Group, Rect, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { GridObject, ObjectDecoration } from '@/types';
import { DEFAULT_DECORATION } from '@/types';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useUIStore } from '@/stores/uiStore';
import { ObjectTextLabel } from './ObjectTextLabel';
import { DimensionLabel } from './DimensionLabel';
import { getObjectOutline } from '@/utils/outline';

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
  /** ドラッグ中かどうか */
  isDragging?: boolean;
  /** ドラッグ可能かどうか */
  draggable: boolean;
  /** クリック時のコールバック（Konvaイベントを受け取る） */
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
  /** ドラッグ開始時のコールバック */
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  /** ドラッグ移動時のコールバック */
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  /** ドラッグ終了時のコールバック（Konvaイベント版） */
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  /** ドラッグ終了時のコールバック（単一オブジェクト用、グリッド座標） */
  onSingleDragEnd?: (newPosition: { x: number; y: number }) => void;
}

/**
 * オブジェクトから完全な装飾設定を取得
 * DEFAULT_DECORATION と object.decoration をマージ
 */
const getDecoration = (object: GridObject): ObjectDecoration => {
  return {
    ...DEFAULT_DECORATION,
    ...object.decoration,
  };
};

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
 * メモ化の比較関数（パフォーマンス最適化版）
 *
 * パフォーマンス最適化ポイント:
 * - ドラッグ中は位置情報の変更を無視（Konva がネイティブで管理）
 * - オブジェクトIDと形状（cells）のみを比較
 * - 不要な再レンダリングを防止して60fpsを維持
 */
const arePropsEqual = (
  prevProps: GridObjectShapeProps,
  nextProps: GridObjectShapeProps
): boolean => {
  // ドラッグ中は最小限の比較で再レンダリングを抑制
  if (nextProps.isDragging) {
    // ドラッグ中は形状・色・選択状態のみを比較
    // 位置はKonvaのネイティブ管理を使用するため無視
    return (
      prevProps.object.id === nextProps.object.id &&
      prevProps.object.cells === nextProps.object.cells &&
      prevProps.object.color === nextProps.object.color &&
      prevProps.gridSize === nextProps.gridSize &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDragging === nextProps.isDragging
    );
  }

  // 通常時（非ドラッグ中）は全プロパティを比較
  // Check if object reference changed
  if (prevProps.object !== nextProps.object) return false;

  // Check scalar props
  if (prevProps.gridSize !== nextProps.gridSize) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isDragging !== nextProps.isDragging) return false;
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
    isDragging = false,
    draggable,
    onClick,
    onDragStart,
    onDragMove,
    onDragEnd,
    onSingleDragEnd,
  }: GridObjectShapeProps) => {
    const { id, cells, position, rotation, color } = object;

    // グリッド設定を取得
    const { cellSize, unit } = useGridSettingsStore();

    // UI設定を取得
    const { showObjectNames, showDimensions, textSettings, dimensionSettings } =
      useUIStore();

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
     * 装飾設定を取得
     */
    const decoration = useMemo(() => getDecoration(object), [object]);

    /**
     * セルの描画（枠線なし - 輪郭は別途描画）
     */
    const cellRects = useMemo(() => {
      const { opacity } = decoration;

      return cells.map(([x, y], index) => (
        <Rect
          key={`${id}-cell-${index}`}
          x={x * gridSize}
          y={y * gridSize}
          width={gridSize}
          height={gridSize}
          fill={color}
          opacity={opacity}
        />
      ));
    }, [cells, id, gridSize, color, decoration]);

    /**
     * 輪郭線のポイント配列
     */
    const outlinePoints = useMemo(() => {
      if (!decoration.showBorder) return null;
      return getObjectOutline(cells, gridSize);
    }, [cells, gridSize, decoration.showBorder]);

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
     * 複数選択時はonDragEnd、単一選択時はonSingleDragEndを呼び出す
     */
    const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
      // onDragEnd（Konvaイベント版）が提供されている場合はそちらを使用
      if (onDragEnd) {
        onDragEnd(e);
        return;
      }

      // 単一選択用のハンドラを使用
      if (onSingleDragEnd) {
        const node = e.target;
        const newX = node.x();
        const newY = node.y();

        // グリッドにスナップ
        const snappedX = Math.round(newX / gridSize) * gridSize;
        const snappedY = Math.round(newY / gridSize) * gridSize;

        // グリッド座標に変換
        const gridX = snappedX / gridSize;
        const gridY = snappedY / gridSize;

        onSingleDragEnd({ x: gridX, y: gridY });
      }
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

    // ドラッグ中の視覚フィードバック用opacity
    const groupOpacity = isDragging ? 0.7 : 1;

    return (
      <Group
        x={position.x * gridSize}
        y={position.y * gridSize}
        rotation={rotation}
        offsetX={rotationOffset.x}
        offsetY={rotationOffset.y}
        draggable={draggable}
        opacity={groupOpacity}
        onClick={(e) => onClick?.(e as KonvaEventObject<MouseEvent>)}
        onTap={(e) => {
          // Touch events don't have shiftKey, so treat as normal click
          const mockEvent = {
            ...e,
            evt: { ...e.evt, shiftKey: false } as unknown as MouseEvent,
          } as KonvaEventObject<MouseEvent>;
          onClick?.(mockEvent);
        }}
        onDragStart={(e) => onDragStart?.(e as KonvaEventObject<DragEvent>)}
        onDragMove={(e) => onDragMove?.(e as KonvaEventObject<DragEvent>)}
        onDragEnd={handleDragEnd}
      >
        {/* 回転オフセットを補正するための内部グループ */}
        <Group x={rotationOffset.x} y={rotationOffset.y}>
          {cellRects}

          {/* 輪郭線（枠線ON時のみ描画） */}
          {outlinePoints && outlinePoints.length > 0 && (
            <Line
              points={outlinePoints}
              stroke={decoration.borderColor ?? color}
              strokeWidth={decoration.borderWidth}
              closed={true}
              listening={false}
            />
          )}

          {selectionHighlight}

          {/* オブジェクト名表示 */}
          {showObjectNames && (
            <ObjectTextLabel
              object={object}
              gridSize={gridSize}
              settings={textSettings}
            />
          )}

          {/* 寸法表示 */}
          {(showDimensions || isSelected) && (
            <DimensionLabel
              object={object}
              gridSize={gridSize}
              cellSize={cellSize}
              unit={unit}
              settings={dimensionSettings}
            />
          )}
        </Group>
      </Group>
    );
  },
  arePropsEqual
);

GridObjectShape.displayName = 'GridObjectShape';
