import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasZoom, MIN_ZOOM, MAX_ZOOM } from './useCanvasZoom';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useCanvasStore } from '@/stores/canvasStore';

describe('useCanvasZoom', () => {
  beforeEach(() => {
    // Reset stores
    useGridSettingsStore.setState({
      zoom: 1,
      basePixelSize: 20,
      cellSize: 10,
      unit: 'cm',
    });
    useCanvasStore.setState({
      panPosition: { x: 0, y: 0 },
    });
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
    // Pan position should be adjusted based on zoom point
    const store = useCanvasStore.getState();
    expect(store.panPosition).not.toEqual({ x: 0, y: 0 });
  });

  it('exports zoom constants', () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(MAX_ZOOM).toBe(3);
  });
});
