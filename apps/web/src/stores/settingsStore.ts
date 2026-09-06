import { create } from 'zustand';

/**
 * Global sketch settings that live outside the document (issue #53, spec §8 /
 * §10). Unlike the real-world scale (`EditorDocument.physicalScale`, changed
 * through `SetPhysicalScaleCommand`), these two flags are export preferences,
 * not document data: they are not part of the saved `.json`, have no Undo
 * history, and only affect how the share-image export (#56) renders. They
 * live in their own store because the settings panel is the polygon-document
 * editor's own surface.
 */
interface SettingsState {
  /** Whether shape dimensions are drawn onto the exported share image. */
  readonly includeDimensionsInShareImage: boolean;
  setIncludeDimensionsInShareImage: (include: boolean) => void;

  /** Whether the grid is drawn onto the exported share image. */
  readonly includeGridInShareImage: boolean;
  setIncludeGridInShareImage: (include: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  includeDimensionsInShareImage: true,
  setIncludeDimensionsInShareImage: (include) =>
    set({ includeDimensionsInShareImage: include }),

  includeGridInShareImage: true,
  setIncludeGridInShareImage: (include) => set({ includeGridInShareImage: include }),
}));
