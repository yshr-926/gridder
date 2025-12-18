import { useCallback } from 'react';
import type Konva from 'konva';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useCanvasStore } from '@/stores/canvasStore';

/**
 * ズーム制限定数
 */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;
export const ZOOM_SENSITIVITY = 1.1;

/**
 * useCanvasZoom - キャンバスのズーム操作を管理するフック
 */
export const useCanvasZoom = () => {
  const { zoom, setZoom } = useGridSettingsStore();
  const { panPosition, setPanPosition } = useCanvasStore();

  /**
   * マウスホイールによるズーム
   */
  const handleZoom = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>, stage: Konva.Stage | null) => {
      e.evt.preventDefault();

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
   * 指定座標を中心にズーム
   */
  const zoomToPoint = useCallback(
    (point: { x: number; y: number }, newZoom: number) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      const mousePointTo = {
        x: (point.x - panPosition.x) / zoom,
        y: (point.y - panPosition.y) / zoom,
      };

      const newPanPosition = {
        x: point.x - mousePointTo.x * clampedZoom,
        y: point.y - mousePointTo.y * clampedZoom,
      };

      setZoom(clampedZoom);
      setPanPosition(newPanPosition);
    },
    [zoom, panPosition, setZoom, setPanPosition]
  );

  /**
   * ズームリセット
   */
  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  }, [setZoom, setPanPosition]);

  /**
   * ズームイン（+10%）
   */
  const zoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom * ZOOM_SENSITIVITY);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  /**
   * ズームアウト（-10%）
   */
  const zoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom / ZOOM_SENSITIVITY);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  /**
   * ズームパーセンテージ
   */
  const zoomPercentage = Math.round(zoom * 100);

  return {
    zoom,
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
