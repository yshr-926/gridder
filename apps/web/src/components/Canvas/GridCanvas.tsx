import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { GridBackground } from './GridBackground';
import { ObjectsLayer } from './ObjectsLayer';
import { InteractionLayer } from './InteractionLayer';
import { debounceResize } from '@/utils/performance';

/**
 * ズーム制限定数
 */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 1.1;

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
}

/**
 * GridCanvas コンポーネント
 * Konva.js を使用したメインキャンバス
 */
export const GridCanvas = forwardRef<GridCanvasRef, GridCanvasProps>(
  ({ onCursorPositionChange }, ref) => {
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

  // Space キーによるパンモード
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // ストアから状態取得
  const { zoom, setZoom, basePixelSize } = useGridSettingsStore();
  const { panPosition, setPanPosition } = useCanvasStore();

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
   * Space キーの監視
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /**
   * マウスホイールによるズーム
   */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // ズーム方向を判定
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newZoom = direction > 0 ? zoom * ZOOM_SENSITIVITY : zoom / ZOOM_SENSITIVITY;

      // ズーム制限
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      // マウス位置を中心にズーム
      const mousePointTo = {
        x: (pointer.x - panPosition.x) / zoom,
        y: (pointer.y - panPosition.y) / zoom,
      };

      const newPanPosition = {
        x: pointer.x - mousePointTo.x * clampedZoom,
        y: pointer.y - mousePointTo.y * clampedZoom,
      };

      setZoom(clampedZoom);
      setPanPosition(newPanPosition);
    },
    [zoom, panPosition, setZoom, setPanPosition]
  );

  /**
   * ドラッグ終了時にパン位置を更新
   */
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target as Konva.Stage;
      setPanPosition({
        x: stage.x(),
        y: stage.y(),
      });
    },
    [setPanPosition]
  );

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

      // ズームとパンを考慮した実座標
      const x = (pointer.x - panPosition.x) / zoom;
      const y = (pointer.y - panPosition.y) / zoom;

      onCursorPositionChange({ x: Math.round(x), y: Math.round(y) });
    },
    [zoom, panPosition, onCursorPositionChange]
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
      className="w-full h-full overflow-hidden"
      style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={panPosition.x}
        y={panPosition.y}
        scaleX={zoom}
        scaleY={zoom}
        draggable={isSpacePressed}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid Background Layer - listening=false for performance */}
        <Layer listening={false}>
          <GridBackground
            width={dimensions.width}
            height={dimensions.height}
            gridSize={gridSize}
            panX={panPosition.x}
            panY={panPosition.y}
            zoom={zoom}
          />
        </Layer>

        {/* Objects Layer */}
        <Layer>
          <ObjectsLayer />
        </Layer>

        {/* Interaction Layer */}
        <Layer>
          <InteractionLayer
            panPosition={panPosition}
            zoom={zoom}
          />
        </Layer>
      </Stage>
    </div>
  );
});

// displayName を設定（forwardRef を使う場合のベストプラクティス）
GridCanvas.displayName = 'GridCanvas';
