import { create } from 'zustand';

/**
 * グリッド設定ストア
 *
 * 表示用ピクセルサイズ（`basePixelSize`）だけを保持する。実寸スケール
 * （cellSize/unit）は editor-core の `EditorDocument.physicalScale` に、
 * 表示倍率（zoom/offset）は `viewportStore` に、それぞれ移行済み（#53, #42）。
 */
interface GridSettingsState {
  // グリッド表示用ピクセルサイズ（基本値）
  basePixelSize: number;
  setBasePixelSize: (size: number) => void;
}

export const useGridSettingsStore = create<GridSettingsState>((set) => ({
  // グリッド表示用ピクセルサイズ（デフォルト: 20px）
  basePixelSize: 20,
  setBasePixelSize: (size) => set({ basePixelSize: Math.max(10, size) }),
}));
