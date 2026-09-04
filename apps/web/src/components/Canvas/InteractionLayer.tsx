import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useDrawing } from '@/features/drawing';
import { useEraser } from '@/features/eraser';
import { useSelection } from '@/features/selection';
import { usePolygonDrawing } from '@/features/polygon';
import { useSubtractionDrawing } from '@/features/drawing/useSubtractionDrawing';
import { screenToGrid } from '@/features/viewport';
import type { CellCoordinate, Position } from '@/types';
import { PolygonPreview } from './PolygonPreview';
import { CursorOverlay } from './CursorOverlay';
import type { Vertex } from '@/features/polygon/types';

/**
 * InteractionLayer Props
 */
interface InteractionLayerProps {
  /** パン位置 */
  panPosition: Position;
  /** ズーム */
  zoom: number;
  /** ビューポート操作が図形操作より優先されているか */
  isViewportInteracting?: boolean;
}

/**
 * 描画中セルの色
 */
const DRAWING_PREVIEW_COLOR = 'rgba(51, 51, 51, 0.7)';

/**
 * 減算モードのプレビュー色
 */
const SUBTRACTION_PREVIEW_COLOR = 'rgba(239, 68, 68, 0.3)';
const SUBTRACTION_PREVIEW_STROKE = '#ef4444';

/**
 * InteractionLayer コンポーネント
 * 描画・消しゴム・選択の各モード操作を統合し、
 * マウスイベントを適切にルーティングする
 */
export const InteractionLayer = ({
  panPosition,
  zoom,
  isViewportInteracting = false,
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
  const polygonDrawing = usePolygonDrawing();
  const subtractionDrawing = useSubtractionDrawing();

  // ドラッグ状態の追跡
  const isDraggingRef = useRef(false);
  // 選択モードでのドラッグ移動用
  const dragStartCellRef = useRef<CellCoordinate | null>(null);
  const dragObjectIdRef = useRef<string | null>(null);

  // ポリゴンモードのカーソル位置
  const [polygonCursorPosition, setPolygonCursorPosition] = useState<Vertex | null>(null);

  // 全ツールモードのカーソル位置
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  // 減算モードのドラッグ中セル
  const [subtractionDragCells, setSubtractionDragCells] = useState<{ x: number; y: number }[]>([]);

  /**
   * ポインタ位置からグリッドセル座標を取得
   */
  const getGridCellFromPointer = useCallback(
    (stage: Konva.Stage): CellCoordinate | null => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;

      const cell = screenToGrid(
        pointer,
        { scale: zoom, offset: panPosition },
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
   * 最初の頂点付近かチェック（1.5グリッド以内）
   */
  const isNearFirstVertex = useCallback(
    (x: number, y: number): boolean => {
      if (polygonDrawing.vertices.length === 0) return false;
      const first = polygonDrawing.vertices[0];
      const distance = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
      return distance < 1.5;
    },
    [polygonDrawing.vertices]
  );

  /**
   * ポリゴンモードのクリック処理
   */
  const handlePolygonClick = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (!cell) return;

      const [gridX, gridY] = cell;

      // 最初の頂点付近をクリックした場合は閉じる（3頂点以上の場合）
      if (polygonDrawing.canClose && isNearFirstVertex(gridX, gridY)) {
        polygonDrawing.completePolygon(true);
      } else {
        polygonDrawing.addVertex(gridX, gridY);
      }
    },
    [getGridCellFromPointer, polygonDrawing, isNearFirstVertex]
  );

  /**
   * 減算モードのマウスダウン処理
   */
  const handleSubtractMouseDown = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (!cell) return;

      const [gridX, gridY] = cell;
      setSubtractionDragCells([{ x: gridX, y: gridY }]);
    },
    [getGridCellFromPointer]
  );

  /**
   * 減算モードのマウス移動処理（ドラッグ中）
   */
  const handleSubtractMouseMove = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (!cell) return;

      const [gridX, gridY] = cell;

      // 既に追加されていなければ追加
      setSubtractionDragCells((prev) => {
        const lastCell = prev[prev.length - 1];
        if (!lastCell || lastCell.x !== gridX || lastCell.y !== gridY) {
          return [...prev, { x: gridX, y: gridY }];
        }
        return prev;
      });
    },
    [getGridCellFromPointer]
  );

  /**
   * マウスダウンハンドラ
   */
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (isViewportInteracting) {
        e.cancelBubble = true;
        return;
      }

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
        case 'polygon':
          handlePolygonClick(stage);
          break;
        case 'subtract':
          handleSubtractMouseDown(stage);
          break;
        case 'line':
          // 線モードは将来実装予定
          break;
      }
    },
    [
      isViewportInteracting,
      toolMode,
      handleDrawMouseDown,
      handleEraserMouseDown,
      handleSelectMouseDown,
      handlePolygonClick,
      handleSubtractMouseDown,
    ]
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
   * ポリゴンモードのマウス移動処理（カーソル追跡）
   */
  const handlePolygonMouseMove = useCallback(
    (stage: Konva.Stage) => {
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        setPolygonCursorPosition({ x: cell[0], y: cell[1] });
      }
    },
    [getGridCellFromPointer]
  );

  /**
   * マウス移動ハンドラ（ドラッグ中およびポリゴンモード）
   */
  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // 全モードでカーソル位置を追跡
      const cell = getGridCellFromPointer(stage);
      if (cell) {
        setCursorPosition({ x: cell[0], y: cell[1] });
      }

      // ポリゴンモードはドラッグ中でなくてもカーソル位置を追跡
      if (toolMode === 'polygon') {
        handlePolygonMouseMove(stage);
        return;
      }

      // マウスボタンが押されている場合のみ
      if (e.evt.buttons !== 1 || !isDraggingRef.current) return;

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
        case 'subtract':
          handleSubtractMouseMove(stage);
          break;
      }
    },
    [
      toolMode,
      getGridCellFromPointer,
      handleDrawMouseMove,
      handleEraserMouseMove,
      handleSelectMouseMove,
      handlePolygonMouseMove,
      handleSubtractMouseMove,
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
      case 'subtract':
        if (subtractionDragCells.length > 0) {
          subtractionDrawing.subtractDrag(subtractionDragCells);
          setSubtractionDragCells([]);
        }
        break;
    }
  }, [toolMode, endDrawing, endErasing, subtractionDragCells, subtractionDrawing]);

  /**
   * マウスがレイヤーから離れた
   */
  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setCursorPosition(null);

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
      case 'subtract':
        // ドラッグ中にマウスが離れた場合は減算をキャンセル
        setSubtractionDragCells([]);
        break;
    }
  }, [toolMode, cancelDrawing, endErasing]);

  /**
   * ポリゴンモードのキーボードハンドラ
   */
  useEffect(() => {
    if (toolMode !== 'polygon') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter キーでポリゴンを完成
      if (e.key === 'Enter' && polygonDrawing.canClose) {
        e.preventDefault();
        polygonDrawing.completePolygon(true);
      }
      // Backspace で最後の頂点を削除
      else if (e.key === 'Backspace') {
        e.preventDefault();
        polygonDrawing.removeLastVertex();
      }
      // Escape でキャンセル
      else if (e.key === 'Escape') {
        e.preventDefault();
        polygonDrawing.cancel();
        setPolygonCursorPosition(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode, polygonDrawing]);

  /**
   * ツールモード変更時にポリゴン描画をリセット
   */
  const prevToolModeRef = useRef(toolMode);
  useEffect(() => {
    const prevToolMode = prevToolModeRef.current;
    prevToolModeRef.current = toolMode;

    // ポリゴンモードから別のモードに切り替えた場合にリセット
    if (prevToolMode === 'polygon' && toolMode !== 'polygon') {
      if (polygonDrawing.isDrawing) {
        polygonDrawing.cancel();
      }
    }
  }, [toolMode, polygonDrawing]);

  /**
   * ポリゴンモードでない場合のカーソル位置（常にnull）
   * ポリゴンモードでのみ実際のカーソル位置を使用する
   */
  const effectivePolygonCursorPosition =
    toolMode === 'polygon' ? polygonCursorPosition : null;

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

  /**
   * 最初の頂点クリックハンドラ（ポリゴンを閉じる）
   */
  const handleFirstVertexClick = useCallback(() => {
    if (polygonDrawing.canClose) {
      polygonDrawing.completePolygon(true);
    }
  }, [polygonDrawing]);

  return (
    <Group listening={!isViewportInteracting}>
      {interactionArea}
      {drawingPreview}

      {/* ポリゴンプレビュー */}
      {toolMode === 'polygon' && (polygonDrawing.isDrawing || polygonDrawing.vertices.length > 0) && (
        <PolygonPreview
          vertices={polygonDrawing.vertices}
          cursorPosition={effectivePolygonCursorPosition}
          gridSize={gridSize}
          onFirstVertexClick={handleFirstVertexClick}
        />
      )}

      {/* 減算モードのプレビュー */}
      {toolMode === 'subtract' && subtractionDragCells.length > 0 && (
        <Group>
          {subtractionDragCells.map((cell, index) => (
            <Rect
              key={`subtract-${index}`}
              x={cell.x * gridSize}
              y={cell.y * gridSize}
              width={gridSize}
              height={gridSize}
              fill={SUBTRACTION_PREVIEW_COLOR}
              stroke={SUBTRACTION_PREVIEW_STROKE}
              strokeWidth={1}
              listening={false}
            />
          ))}
        </Group>
      )}

      {/* カーソルオーバーレイ */}
      <CursorOverlay
        position={cursorPosition}
        toolMode={toolMode}
        gridSize={gridSize}
      />
    </Group>
  );
};
