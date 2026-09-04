import { create } from 'zustand';
import type { Position } from '@/types';
import { zoomViewportAtPoint } from '@/features/viewport/coordinates';

export const MIN_VIEWPORT_SCALE = 0.1;
export const MAX_VIEWPORT_SCALE = 3;
export const VIEWPORT_ZOOM_FACTOR = 1.1;

const clampScale = (scale: number): number =>
  Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, scale));

interface ViewportState {
  scale: number;
  offset: Position;
  setScale: (scale: number) => void;
  setOffset: (offset: Position) => void;
  panBy: (delta: Position) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomAtPoint: (point: Position, scale: number) => void;
  resetViewport: () => void;
}

export const useViewportStore = create<ViewportState>(set => ({
  scale: 1,
  offset: { x: 0, y: 0 },
  setScale: scale => set({ scale: clampScale(scale) }),
  setOffset: offset => set({ offset }),
  panBy: delta =>
    set(state => ({
      offset: {
        x: state.offset.x + delta.x,
        y: state.offset.y + delta.y,
      },
    })),
  zoomIn: () =>
    set(state => ({
      scale: clampScale(state.scale * VIEWPORT_ZOOM_FACTOR),
    })),
  zoomOut: () =>
    set(state => ({
      scale: clampScale(state.scale / VIEWPORT_ZOOM_FACTOR),
    })),
  zoomAtPoint: (point, scale) => set(state => zoomViewportAtPoint(state, point, clampScale(scale))),
  resetViewport: () => set({ scale: 1, offset: { x: 0, y: 0 } }),
}));

if (import.meta.env.DEV) {
  (
    window as unknown as {
      __GRIDDER_VIEWPORT_STORE__: typeof useViewportStore;
    }
  ).__GRIDDER_VIEWPORT_STORE__ = useViewportStore;
}
