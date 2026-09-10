import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import type { EditorDocument } from '@gridder/editor-core';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useViewportStore } from '@/stores/viewportStore';
import {
  readViewportTransform,
  screenToWorld,
  useStageViewport,
  useViewportPan,
} from '@/features/viewport';
import { useCanvasZoom } from '@/hooks/useCanvasZoom';
import { useSelectionStore } from '@/stores/selectionStore';
import { useMovePreviewStore } from '@/stores/movePreviewStore';
import { useResizePreviewStore } from '@/stores/resizePreviewStore';
import { useVertexPreviewStore } from '@/stores/vertexPreviewStore';
import { ViewportGridBackground } from './ViewportGridBackground';
import { ShapesLayer } from './ShapesLayer';
import {
  EditorInteractionLayer,
  type EditorInteractionCursor,
  type EditorInteractionLayerHandle,
  type VertexInsertGhost,
} from './EditorInteractionLayer';
import { SelectionOverlay } from './SelectionOverlay';
import { VertexEditOverlay } from './VertexEditOverlay';
import { DrawingRangeLayer } from './DrawingRangeLayer';
import { DimensionLayer } from './DimensionLayer';
import { debounceResize } from '@/utils/performance';

/**
 * GridCanvas の公開メソッド
 */
export interface GridCanvasRef {
  /** Konva Stage への参照を取得 */
  getStage: () => Konva.Stage | null;
  /**
   * ポリゴン作成モードへ入る（#48）。`P` ショートカットと上部バーのボタンから
   * 呼ばれる。通常状態（idle）以外では何もしない。
   */
  startPolygonCreation: () => void;
}

/**
 * GridCanvas Props
 */
interface GridCanvasProps {
  /** カーソル位置変更時のコールバック */
  onCursorPositionChange?: (position: { x: number; y: number } | null) => void;
  /** editor-core の文書スナップショット。ポリゴンレンダラー Adapter（{@link ShapesLayer}）で描画する。 */
  editorDocument: EditorDocument;
  /** ポリゴン作成モード（#48）の入り／切り変化を通知するコールバック。 */
  onCreatingPolygonChange?: (isCreatingPolygon: boolean) => void;
}

/**
 * GridCanvas コンポーネント
 * Konva.js を使用したメインキャンバス
 */
export const GridCanvas = forwardRef<GridCanvasRef, GridCanvasProps>(
  ({ onCursorPositionChange, editorDocument, onCreatingPolygonChange }, ref) => {
    // Stage への参照
    const stageRef = useRef<Konva.Stage>(null);
    // ポリゴン作成モード（#48）を開始するための EditorInteractionLayer への参照
    const interactionLayerRef = useRef<EditorInteractionLayerHandle>(null);

    // 親コンポーネントへ公開するメソッド
    useImperativeHandle(
      ref,
      () => ({
        getStage: () => stageRef.current,
        startPolygonCreation: () => interactionLayerRef.current?.startPolygon(),
      }),
      []
    );

    // キャンバスサイズ
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // コンテナへの参照
    const containerRef = useRef<HTMLDivElement>(null);

    // ストアから状態取得。`offset` はここでは購読しない（#61）: パンは Stage の
    // 変換だけで表現でき、`useStageViewport` がストアから直接 Stage に適用する。
    // `scale` はズーム不変のオーバーレイと注釈が必要とするので購読する。
    const basePixelSize = useGridSettingsStore((state) => state.basePixelSize);
    const scale = useViewportStore((state) => state.scale);
    const { handleZoom } = useCanvasZoom();
    const viewportPan = useViewportPan();
    useStageViewport(stageRef);

    // 新しいポリゴン文書経路での選択図形（#42）
    const selectedIds = useSelectionStore((state) => state.selectedIds);
    // 図形ドラッグ移動中の Konva ノード限定プレビュー（#43, spec §14）
    const movePreview = useMovePreviewStore((state) => state.preview) ?? undefined;
    // 矩形ハンドル伸縮中の Konva ノード限定プレビュー（#44, spec §14）
    const resizePreview = useResizePreviewStore((state) => state.preview) ?? undefined;
    // 頂点・辺ドラッグ中の Konva ノード限定プレビュー（#50, spec §14）
    const vertexPreview = useVertexPreviewStore((state) => state.preview) ?? undefined;
    // #43 の移動ジェスチャーが要求する grab/grabbing カーソル、
    // #44 のハンドルドラッグが要求する方向別カーソル
    const [interactionCursor, setInteractionCursor] = useState<EditorInteractionCursor | null>(
      null
    );
    // #64 のゴースト頂点（辺上のグリッド点に hover 中だけ存在する）。VertexEditOverlay が描く
    const [insertGhost, setInsertGhost] = useState<VertexInsertGhost | null>(null);

    // グリッドサイズ（ピクセル）
    const gridSize = basePixelSize;

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
    const handleMouseMove = useCallback(() => {
      const stage = stageRef.current;
      if (!stage || !onCursorPositionChange) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPoint = screenToWorld(pointer, readViewportTransform());

      onCursorPositionChange({
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
      });
    }, [onCursorPositionChange]);

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
              : (interactionCursor ?? 'default'),
        }}
        onPointerDownCapture={viewportPan.handlePointerDownCapture}
        onPointerMoveCapture={viewportPan.handlePointerMoveCapture}
        onPointerUpCapture={viewportPan.handlePointerUpCapture}
        onPointerCancelCapture={viewportPan.handlePointerCancelCapture}
        onMouseDownCapture={viewportPan.handleMouseDownCapture}
        onAuxClick={viewportPan.handleAuxClick}
      >
        {/* 位置と scale は props ではなく useStageViewport が Stage へ直接適用する（#61） */}
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onWheel={(event) => handleZoom(event, stageRef.current)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid Background Layer - listening=false for performance */}
          <Layer listening={false}>
            <ViewportGridBackground
              width={dimensions.width}
              height={dimensions.height}
              gridSize={gridSize}
            />
          </Layer>

          <Layer>
            <DrawingRangeLayer gridSize={gridSize} scale={scale} />
          </Layer>

          {/* Objects Layer: editor-core の文書をポリゴンレンダラーで描画する */}
          <Layer>
            <ShapesLayer
              document={editorDocument}
              gridSize={gridSize}
              scale={scale}
              movePreview={movePreview}
              resizePreview={resizePreview}
              vertexPreview={vertexPreview}
            />
          </Layer>

          {/* Interaction Layer: editor-core の interaction controller（#42） */}
          <Layer>
            <EditorInteractionLayer
              ref={interactionLayerRef}
              zoom={scale}
              gridSize={gridSize}
              isViewportInteracting={viewportPan.isViewportInteracting}
              onCursorChange={setInteractionCursor}
              onInsertGhostChange={setInsertGhost}
              onCreatingPolygonChange={onCreatingPolygonChange}
            />
          </Layer>

          {/* Selection Overlay: 選択枠と矩形の伸縮ハンドル（#44）。ズームに依らず画面上のサイズを保つ */}
          <Layer listening={false}>
            <SelectionOverlay
              document={editorDocument}
              selectedIds={selectedIds}
              gridSize={gridSize}
              scale={scale}
              movePreview={movePreview}
              resizePreview={resizePreview}
              vertexPreview={vertexPreview}
            />
          </Layer>

          {/* Vertex Edit Overlay: 矩形以外の単一選択図形の頂点マーカーと辺の hit 領域（#50）、
            辺 hover 中のゴースト頂点（#64）。矩形のバウンディングボックスハンドルとは棲み分ける */}
          <Layer listening={false}>
            <VertexEditOverlay
              document={editorDocument}
              selectedIds={selectedIds}
              gridSize={gridSize}
              scale={scale}
              vertexPreview={vertexPreview}
              insertGhost={insertGhost ?? undefined}
            />
          </Layer>

          <Layer listening={false}>
            <DimensionLayer
              document={editorDocument}
              selectedIds={selectedIds}
              gridSize={gridSize}
              scale={scale}
            />
          </Layer>
        </Stage>
      </div>
    );
  }
);

// displayName を設定（forwardRef を使う場合のベストプラクティス）
GridCanvas.displayName = 'GridCanvas';
