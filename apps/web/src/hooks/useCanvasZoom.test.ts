import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type Konva from 'konva';
import { useCanvasZoom, MIN_ZOOM, MAX_ZOOM } from './useCanvasZoom';
import { screenToWorld } from '@/features/viewport';
import { useViewportStore } from '@/stores/viewportStore';

describe('useCanvasZoom', () => {
  beforeEach(() => {
    useViewportStore.getState().resetViewport();
  });

  it('returns initial zoom value', () => {
    const { result } = renderHook(() => useCanvasZoom());

    expect(result.current.zoom).toBe(1);
    expect(result.current.zoomPercentage).toBe(100);
  });

  it('zooms in correctly', () => {
    const { result } = renderHook(() => useCanvasZoom());

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoom).toBeGreaterThan(1);
    expect(result.current.zoomPercentage).toBeGreaterThan(100);
  });

  it('zooms out correctly', () => {
    const { result } = renderHook(() => useCanvasZoom());

    act(() => {
      result.current.zoomOut();
    });

    expect(result.current.zoom).toBeLessThan(1);
    expect(result.current.zoomPercentage).toBeLessThan(100);
  });

  it('resets zoom to default', () => {
    const { result } = renderHook(() => useCanvasZoom());

    // First zoom in
    act(() => {
      result.current.zoomIn();
      result.current.zoomIn();
    });

    expect(result.current.zoom).toBeGreaterThan(1);

    // Then reset
    act(() => {
      result.current.resetZoom();
    });

    expect(result.current.zoom).toBe(1);
  });

  it('respects minimum zoom limit', () => {
    const { result } = renderHook(() => useCanvasZoom());

    // Zoom out many times
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.zoomOut();
      }
    });

    expect(result.current.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it('respects maximum zoom limit', () => {
    const { result } = renderHook(() => useCanvasZoom());

    // Zoom in many times
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.zoomIn();
      }
    });

    expect(result.current.zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it('zooms to specific point', () => {
    const { result } = renderHook(() => useCanvasZoom());

    act(() => {
      result.current.zoomToPoint({ x: 100, y: 100 }, 2);
    });

    expect(result.current.zoom).toBe(2);
    expect(useViewportStore.getState().offset).not.toEqual({ x: 0, y: 0 });
  });

  it('preserves the world position under the zoom point', () => {
    useViewportStore.getState().setOffset({ x: 40, y: -20 });
    const point = { x: 175, y: 90 };
    const worldBefore = screenToWorld(point, useViewportStore.getState());
    const { result } = renderHook(() => useCanvasZoom());

    act(() => {
      result.current.zoomToPoint(point, 2.5);
    });

    expect(screenToWorld(point, useViewportStore.getState())).toEqual(worldBefore);
  });

  it('keeps the cursor world position stable for a wheel zoom', () => {
    useViewportStore.getState().setOffset({ x: -25, y: 30 });
    const cursor = { x: 260, y: 140 };
    const worldBefore = screenToWorld(cursor, useViewportStore.getState());
    const preventDefault = vi.fn();
    const event = {
      evt: { deltaY: -1, ctrlKey: false, preventDefault },
    } as unknown as Konva.KonvaEventObject<WheelEvent>;
    const stage = {
      getPointerPosition: () => cursor,
    } as unknown as Konva.Stage;
    const { result } = renderHook(() => useCanvasZoom());

    act(() => {
      result.current.handleZoom(event, stage);
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(screenToWorld(cursor, useViewportStore.getState())).toEqual(worldBefore);
  });

  it('exports zoom constants', () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(MAX_ZOOM).toBe(3);
  });
});
