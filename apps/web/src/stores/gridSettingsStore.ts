import { create } from 'zustand';
import type { Unit } from '../types';
import {
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  VIEWPORT_ZOOM_FACTOR,
  useViewportStore,
} from './viewportStore';

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

  // TODO(#59): viewportStore への移行完了後に読み取り互換フィールドを削除する。
  zoom: useViewportStore.getState().scale,
  setZoom: (zoom) => useViewportStore.getState().setScale(zoom),
  zoomIn: () => {
    const { scale, setScale } = useViewportStore.getState();
    setScale(Math.min(MAX_VIEWPORT_SCALE, scale * VIEWPORT_ZOOM_FACTOR));
  },
  zoomOut: () => {
    const { scale, setScale } = useViewportStore.getState();
    setScale(Math.max(MIN_VIEWPORT_SCALE, scale / VIEWPORT_ZOOM_FACTOR));
  },
  resetZoom: () => useViewportStore.getState().setScale(1),

  // グリッド表示用ピクセルサイズ（デフォルト: 20px）
  basePixelSize: 20,
  setBasePixelSize: (size) => set({ basePixelSize: Math.max(10, size) }),

  // 計算されたピクセルサイズ
  getPixelSize: () => {
    const { basePixelSize } = get();
    return basePixelSize * useViewportStore.getState().scale;
  },
}));

// TODO(#59): Toolbar/StatusBar の移行後に互換同期を削除する。
useViewportStore.subscribe((state, previousState) => {
  if (state.scale !== previousState.scale) {
    useGridSettingsStore.setState({ zoom: state.scale });
  }
});
