import { create } from 'zustand';
import type { Unit } from '../types';

/**
 * ズーム倍率の制限値
 */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/**
 * グリッド設定ストア
 */
interface GridSettingsState {
  // セルサイズ（実寸）
  cellSize: number;
  setCellSize: (size: number) => void;

  // 単位
  unit: Unit;
  setUnit: (unit: Unit) => void;

  // ズーム倍率
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // グリッド表示用ピクセルサイズ（基本値）
  basePixelSize: number;
  setBasePixelSize: (size: number) => void;

  // 計算されたピクセルサイズ（zoom適用後）
  getPixelSize: () => number;
}

export const useGridSettingsStore = create<GridSettingsState>((set, get) => ({
  // セルサイズ（デフォルト: 10cm）
  cellSize: 10,
  setCellSize: (size) => set({ cellSize: Math.max(1, size) }),

  // 単位（デフォルト: cm）
  unit: 'cm',
  setUnit: (unit) => set({ unit }),

  // ズーム倍率（デフォルト: 1 = 100%）
  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => {
    const { zoom } = get();
    set({ zoom: Math.min(MAX_ZOOM, zoom + ZOOM_STEP) });
  },
  zoomOut: () => {
    const { zoom } = get();
    set({ zoom: Math.max(MIN_ZOOM, zoom - ZOOM_STEP) });
  },
  resetZoom: () => set({ zoom: 1 }),

  // グリッド表示用ピクセルサイズ（デフォルト: 20px）
  basePixelSize: 20,
  setBasePixelSize: (size) => set({ basePixelSize: Math.max(10, size) }),

  // 計算されたピクセルサイズ
  getPixelSize: () => {
    const { basePixelSize, zoom } = get();
    return basePixelSize * zoom;
  },
}));
