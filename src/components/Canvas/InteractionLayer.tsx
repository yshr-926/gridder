import { useCallback, useMemo, useRef } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useDrawing } from '@/features/drawing';
import { useEraser } from '@/features/eraser';
import { useSelection } from '@/features/selection';
import { pixelToCell } from '@/utils/grid';
import type { CellCoordinate, Position } from '@/types';

/**
 * InteractionLayer Props
 */
interface InteractionLayerProps {
  /** パン位置 */
  panPosition: Position;
  /** ズーム */
  zoom: number;
}

/**
 * 描画中セルの色
 */
const DRAWING_PREVIEW_COLOR = 'rgba(51, 51, 51, 0.7)';

/**
 * InteractionLayer コンポーネント
 * 描画・消しゴム・選択の各モード操作を統合し、
 * マウスイベントを適切にルーティングする
 */
export const InteractionLayer = ({
  panPosition,
  zoom,
}: InteractionLayerProps) => {
  // ストアから状態取得
  const { toolMode, drawingCells } = useCanvasStore();

  const { basePixelSize } = useGridSettingsStore();
  const gridSize = basePixelSize;

  // 各モードのフック
  const { startDrawing, continueDrawing, endDrawing, cancelDrawing } =
    useDrawing();
  const { startErasing, continueErasing, endErasing } = useEraser();
  const { select, deselect, findObjectAtCell } = useSelection();

  // ドラッグ状態の追跡
  const isDraggingRef = useRef(false);
  // 選択モードでのドラッグ移動用
  const dragStartCellRef = useRef<CellCoordinate | null>(null);
  const dragObjectIdRef = useRef<string | null>(null);

  /**
   * ポインタ位置からグリッドセル座標を取得
   */
  const getGridCellFromPointer = useCallback(
    (stage: Konva.Stage): CellCoordinate | null => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;

      const cell = pixelToCell(
        {
          x: (pointer.x - panPosition.x) / zoom,
          y: (pointer.y - panPosition.y) / zoom,
        },
        gridSize
      );

      return [cell.x, cell.y];
    },
    [panPosition, zoom, gridSize]
  );

  /**
   * 描画モードのマウスダウン処理
   */
  const handleDrawMouseDown = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        startDrawing(cell);
      }
    },
    [getGridCellFromPointer, startDrawing]
  );

  /**
   * 消しゴムモードのマウスダウン処理
   */
  const handleEraserMouseDown = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        startErasing(cell);
      }
    },
    [getGridCellFromPointer, startErasing]
  );

  /**
   * 選択モードのマウスダウン処理
   */
  const handleSelectMouseDown = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (!cell) return;

      const obj = findObjectAtCell(cell[0], cell[1]);
      if (obj) {
        select(obj.id);
        dragStartCellRef.current = cell;
        dragObjectIdRef.current = obj.id;
      } else {
        deselect();
        dragStartCellRef.current = null;
        dragObjectIdRef.current = null;
      }
    },
    [getGridCellFromPointer, findObjectAtCell, select, deselect]
  );

  /**
   * マウスダウンハンドラ
   */
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      isDraggingRef.current = true;

      switch (toolMode) {
        case 'draw':
          handleDrawMouseDown(stage);
          break;
        case 'eraser':
          handleEraserMouseDown(stage);
          break;
        case 'select':
          handleSelectMouseDown(stage);
          break;
      }
    },
    [toolMode, handleDrawMouseDown, handleEraserMouseDown, handleSelectMouseDown]
  );

  /**
   * 描画モードのマウス移動処理
   */
  const handleDrawMouseMove = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        continueDrawing(cell);
      }
    },
    [getGridCellFromPointer, continueDrawing]
  );

  /**
   * 消しゴムモードのマウス移動処理
   */
  const handleEraserMouseMove = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        continueErasing(cell);
      }
    },
    [getGridCellFromPointer, continueErasing]
  );

  /**
   * 選択モードのマウス移動処理（ドラッグ移動）
   */
  const handleSelectMouseMove = useCallback(
    (stage: Konva.Stage) => {
      if (!dragStartCellRef.current || !dragObjectIdRef.current) return;

      const cell = getGridCellFromPointer(stage);
      if (!cell) return;

      const [startX, startY] = dragStartCellRef.current;
      const [currentX, currentY] = cell;

      // 移動量を計算
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      if (deltaX !== 0 || deltaY !== 0) {
        // オブジェクトを移動
        const { objects, updateObject } = useCanvasStore.getState();
        const obj = objects.find((o) => o.id === dragObjectIdRef.current);
        if (obj) {
          updateObject(obj.id, {
            position: {
              x: obj.position.x + deltaX,
              y: obj.position.y + deltaY,
            },
          });
        }
        // ドラッグ開始位置を更新
        dragStartCellRef.current = cell;
      }
    },
    [getGridCellFromPointer]
  );

  /**
   * マウス移動ハンドラ（ドラッグ中）
   */
  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // マウスボタンが押されている場合のみ
      if (e.evt.buttons !== 1 || !isDraggingRef.current) return;

      const stage = e.target.getStage();
      if (!stage) return;

      switch (toolMode) {
        case 'draw':
          handleDrawMouseMove(stage);
          break;
        case 'eraser':
          handleEraserMouseMove(stage);
          break;
        case 'select':
          handleSelectMouseMove(stage);
          break;
      }
    },
    [
      toolMode,
      handleDrawMouseMove,
      handleEraserMouseMove,
      handleSelectMouseMove,
    ]
  );

  /**
   * マウスアップハンドラ
   */
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;

    switch (toolMode) {
      case 'draw':
        endDrawing();
        break;
      case 'eraser':
        endErasing();
        break;
      case 'select':
        dragStartCellRef.current = null;
        dragObjectIdRef.current = null;
        break;
    }
  }, [toolMode, endDrawing, endErasing]);

  /**
   * マウスがレイヤーから離れた
   */
  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;

    switch (toolMode) {
      case 'draw':
        cancelDrawing();
        break;
      case 'eraser':
        endErasing();
        break;
      case 'select':
        dragStartCellRef.current = null;
        dragObjectIdRef.current = null;
        break;
    }
  }, [toolMode, cancelDrawing, endErasing]);

  /**
   * 描画中セルのプレビュー
   */
  const drawingPreview = useMemo(() => {
    if (toolMode !== 'draw' || drawingCells.length === 0) return null;

    return drawingCells.map(([x, y], index) => (
      <Rect
        key={`drawing-${index}`}
        x={x * gridSize}
        y={y * gridSize}
        width={gridSize}
        height={gridSize}
        fill={DRAWING_PREVIEW_COLOR}
        stroke="#333"
        strokeWidth={1}
        listening={false}
      />
    ));
  }, [toolMode, drawingCells, gridSize]);

  /**
   * 透明な操作領域
   * マウスイベントを受け取るための大きな透明レイヤー
   */
  const interactionArea = useMemo(() => {
    // 十分に大きなエリア
    const size = 20000;
    const offset = -10000;

    return (
      <Rect
        x={offset}
        y={offset}
        width={size}
        height={size}
        fill="transparent"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    );
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  return (
    <Group>
      {interactionArea}
      {drawingPreview}
    </Group>
  );
};
