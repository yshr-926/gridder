import { create } from 'zustand';

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
}));
