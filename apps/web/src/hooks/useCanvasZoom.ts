import { useCallback } from 'react';
import type Konva from 'konva';
import {
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  VIEWPORT_ZOOM_FACTOR,
  useViewportStore,
} from '@/stores/viewportStore';

export const MIN_ZOOM = MIN_VIEWPORT_SCALE;
export const MAX_ZOOM = MAX_VIEWPORT_SCALE;
export const ZOOM_SENSITIVITY = VIEWPORT_ZOOM_FACTOR;

/**
 * useCanvasZoom - キャンバスのズーム操作を管理するフック
 */
export const useCanvasZoom = () => {
  const scale = useViewportStore((state) => state.scale);
  const zoomAtPoint = useViewportStore((state) => state.zoomAtPoint);
  const zoomIn = useViewportStore((state) => state.zoomIn);
  const zoomOut = useViewportStore((state) => state.zoomOut);
  const resetViewport = useViewportStore((state) => state.resetViewport);

  /**
   * マウスホイールによるズーム
   */
  const handleZoom = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>, stage: Konva.Stage | null) => {
      event.evt.preventDefault();

      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      let direction = event.evt.deltaY > 0 ? -1 : 1;
      if (event.evt.ctrlKey) {
        direction = -direction;
      }

      const nextScale = direction > 0 ? scale * ZOOM_SENSITIVITY : scale / ZOOM_SENSITIVITY;

      zoomAtPoint(pointer, nextScale);
    },
    [scale, zoomAtPoint]
  );

  /**
   * 指定座標を中心にズーム
   */
  const zoomToPoint = useCallback(
    (point: { x: number; y: number }, nextScale: number) => {
      zoomAtPoint(point, nextScale);
    },
    [zoomAtPoint]
  );

  /**
   * ズームリセット
   */
  const resetZoom = useCallback(() => {
    resetViewport();
  }, [resetViewport]);

  /**
   * ズームパーセンテージ
   */
  const zoomPercentage = Math.round(scale * 100);

  return {
    zoom: scale,
    zoomPercentage,
    handleZoom,
    zoomToPoint,
    resetZoom,
    zoomIn,
    zoomOut,
    MIN_ZOOM,
    MAX_ZOOM,
  };
};
