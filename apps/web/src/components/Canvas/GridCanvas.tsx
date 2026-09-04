import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import type { EditorDocument } from '@gridder/editor-core';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useViewportStore } from '@/stores/viewportStore';
import { screenToWorld, useViewportPan } from '@/features/viewport';
import { useCanvasZoom } from '@/hooks/useCanvasZoom';
import { useSelectionStore } from '@/stores/selectionStore';
import { GridBackground } from './GridBackground';
import { ObjectsLayer } from './ObjectsLayer';
import { ShapesLayer } from './ShapesLayer';
import { InteractionLayer } from './InteractionLayer';
import { EditorInteractionLayer } from './EditorInteractionLayer';
import { SelectionOverlay } from './SelectionOverlay';
import { debounceResize } from '@/utils/performance';

/**
 * GridCanvas の公開メソッド
 */
export interface GridCanvasRef {
  /** Konva Stage への参照を取得 */
  getStage: () => Konva.Stage | null;
}

/**
 * GridCanvas Props
 */
interface GridCanvasProps {
  /** カーソル位置変更時のコールバック */
  onCursorPositionChange?: (position: { x: number; y: number } | null) => void;
  /**
   * editor-core の文書スナップショット。
   * 渡された場合はポリゴンレンダラー Adapter（{@link ShapesLayer}）で描画し、
   * 渡されない場合は既存のセルベース {@link ObjectsLayer} をそのまま使う。
   */
  editorDocument?: EditorDocument;
}

/**
 * GridCanvas コンポーネント
 * Konva.js を使用したメインキャンバス
 */
export const GridCanvas = forwardRef<GridCanvasRef, GridCanvasProps>(
  ({ onCursorPositionChange, editorDocument }, ref) => {
  // Stage への参照
  const stageRef = useRef<Konva.Stage>(null);

  // 親コンポーネントへ公開するメソッド
  useImperativeHandle(ref, () => ({
    getStage: () => stageRef.current,
  }), []);

  // キャンバスサイズ
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // コンテナへの参照
  const containerRef = useRef<HTMLDivElement>(null);

  // ストアから状態取得
  const basePixelSize = useGridSettingsStore((state) => state.basePixelSize);
  const scale = useViewportStore((state) => state.scale);
  const offset = useViewportStore((state) => state.offset);
  const { handleZoom } = useCanvasZoom();
  const viewportPan = useViewportPan();

  // 新しいポリゴン文書経路での選択図形（#42）
  const selectedIds = useSelectionStore((state) => state.selectedIds);

  // グリッドサイズ（ピクセル）
  const gridSize = basePixelSize;

  const isEditorDocumentMode = editorDocument !== undefined;

  /**
   * デバウンスされたリサイズハンドラ
   */
  const debouncedUpdateDimensions = useMemo(
    () =>
      debounceResize((rect: DOMRectReadOnly) => {
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }),
    []
  );

  /**
   * コンテナサイズを監視してキャンバスサイズを更新
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: rect.height,
      });
    };

    // 初期サイズ設定
    updateDimensions();

    // ResizeObserver でサイズ変更を監視（デバウンス適用）
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        debouncedUpdateDimensions(entry.contentRect);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      debouncedUpdateDimensions.cancel();
    };
  }, [debouncedUpdateDimensions]);

  /**
   * マウス移動時のカーソル位置更新
   * スロットリング済み（60fps）
   */
  const handleMouseMove = useCallback(
    () => {
      const stage = stageRef.current;
      if (!stage || !onCursorPositionChange) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPoint = screenToWorld(pointer, { scale, offset });

      onCursorPositionChange({
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
      });
    },
    [scale, offset, onCursorPositionChange]
  );

  /**
   * マウスがキャンバスから離れた時
   */
  const handleMouseLeave = useCallback(() => {
    onCursorPositionChange?.(null);
  }, [onCursorPositionChange]);

  return (
    <div
      ref={containerRef}
      data-testid="grid-canvas-container"
      className="w-full h-full overflow-hidden"
      style={{
        cursor: viewportPan.isPanning
          ? 'grabbing'
          : viewportPan.isSpacePressed
            ? 'grab'
            : 'default',
      }}
      onPointerDownCapture={viewportPan.handlePointerDownCapture}
      onPointerMoveCapture={viewportPan.handlePointerMoveCapture}
      onPointerUpCapture={viewportPan.handlePointerUpCapture}
      onPointerCancelCapture={viewportPan.handlePointerCancelCapture}
      onMouseDownCapture={viewportPan.handleMouseDownCapture}
      onAuxClick={viewportPan.handleAuxClick}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={offset.x}
        y={offset.y}
        scaleX={scale}
        scaleY={scale}
        onWheel={(event) => handleZoom(event, stageRef.current)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid Background Layer - listening=false for performance */}
        <Layer listening={false}>
          <GridBackground
            width={dimensions.width}
            height={dimensions.height}
            gridSize={gridSize}
            panX={offset.x}
            panY={offset.y}
            zoom={scale}
          />
        </Layer>

        {/* Objects Layer: 文書が渡されたら新しいポリゴンレンダラー、なければ従来のセルレンダラー */}
        <Layer>
          {isEditorDocumentMode ? (
            <ShapesLayer document={editorDocument} gridSize={gridSize} scale={scale} />
          ) : (
            <ObjectsLayer />
          )}
        </Layer>

        {/* Interaction Layer: 文書経路は新しい interaction controller（#42）、
            旧経路はセルベースの InteractionLayer（削除は #59） */}
        <Layer>
          {isEditorDocumentMode ? (
            <EditorInteractionLayer
              panPosition={offset}
              zoom={scale}
              gridSize={gridSize}
              isViewportInteracting={viewportPan.isViewportInteracting}
            />
          ) : (
            <InteractionLayer
              panPosition={offset}
              zoom={scale}
              isViewportInteracting={viewportPan.isViewportInteracting}
            />
          )}
        </Layer>

        {/* Selection Overlay: 選択枠のみ（ハンドルは #44）。ズームに依らず画面上の線幅を保つ */}
        {isEditorDocumentMode && (
          <Layer listening={false}>
            <SelectionOverlay
              document={editorDocument}
              selectedIds={selectedIds}
              gridSize={gridSize}
              scale={scale}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
});

// displayName を設定（forwardRef を使う場合のベストプラクティス）
GridCanvas.displayName = 'GridCanvas';
