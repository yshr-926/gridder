import { create } from 'zustand';
import type { DimensionSettings, ObjectTextSettings } from '@/types';
import { DEFAULT_DIMENSION_SETTINGS, DEFAULT_TEXT_SETTINGS } from '@/types';

/**
 * UI状態ストア
 */
interface UIState {
  // プロパティパネルの開閉状態
  isPropertyPanelOpen: boolean;
  togglePropertyPanel: () => void;
  setPropertyPanelOpen: (open: boolean) => void;

  // ツールバーの開閉状態
  isToolbarOpen: boolean;
  toggleToolbar: () => void;
  setToolbarOpen: (open: boolean) => void;

  // Phase 13: テキスト・寸法表示設定
  /** オブジェクト名の表示/非表示 */
  showObjectNames: boolean;
  setShowObjectNames: (show: boolean) => void;

  /** 寸法の表示/非表示 */
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;

  /** 寸法表示設定 */
  dimensionSettings: DimensionSettings;
  setDimensionSettings: (settings: Partial<DimensionSettings>) => void;

  /** テキスト表示設定 */
  textSettings: ObjectTextSettings;
  setTextSettings: (settings: Partial<ObjectTextSettings>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // プロパティパネル（デフォルト: 開いている）
  isPropertyPanelOpen: true,
  togglePropertyPanel: () =>
    set((state) => ({ isPropertyPanelOpen: !state.isPropertyPanelOpen })),
  setPropertyPanelOpen: (open) => set({ isPropertyPanelOpen: open }),

  // ツールバー（デフォルト: 開いている）
  isToolbarOpen: true,
  toggleToolbar: () => set((state) => ({ isToolbarOpen: !state.isToolbarOpen })),
  setToolbarOpen: (open) => set({ isToolbarOpen: open }),

  // Phase 13: テキスト・寸法表示設定
  showObjectNames: true,
  setShowObjectNames: (show) => set({ showObjectNames: show }),

  showDimensions: false,
  setShowDimensions: (show) => set({ showDimensions: show }),

  dimensionSettings: DEFAULT_DIMENSION_SETTINGS,
  setDimensionSettings: (settings) =>
    set((state) => ({
      dimensionSettings: { ...state.dimensionSettings, ...settings },
    })),

  textSettings: DEFAULT_TEXT_SETTINGS,
  setTextSettings: (settings) =>
    set((state) => ({
      textSettings: { ...state.textSettings, ...settings },
    })),
}));
