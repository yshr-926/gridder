import { create } from 'zustand';
import type { GridObject, ToolMode, Position, CellCoordinate, ObjectDecoration, SelectionState } from '../types';
import { getNextObjectColor, colorPaletteManager, OBJECT_COLOR_PALETTE } from '../utils/colorPalette';

/**
 * 選択状態と selectedObjectId を同時に更新するヘルパー
 */
const updateSelection = (
  selection: SelectionState
): { selection: SelectionState; selectedObjectId: string | null } => ({
  selection,
  selectedObjectId: selection.primaryId,
});

/**
 * キャンバス状態ストア
 */
interface CanvasState {
  // ツールモード
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // オブジェクト管理
  objects: GridObject[];
  addObject: (obj: GridObject) => void;
  removeObject: (id: string) => void;
  updateObject: (id: string, updates: Partial<GridObject>) => void;
  duplicateObject: (id: string) => void;
  clearObjects: () => void;
  setObjects: (objects: GridObject[]) => void;

  // 選択状態（複数選択対応）
  selection: SelectionState;
  /** @deprecated selection.primaryId を使用してください */
  selectedObjectId: string | null;
  selectObject: (id: string | null, additive?: boolean) => void;
  selectObjects: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // 描画中の一時データ
  drawingCells: CellCoordinate[];
  addDrawingCell: (cell: CellCoordinate) => void;
  clearDrawingCells: () => void;
  commitDrawing: (color?: string) => void;

  // パン位置
  panPosition: Position;
  setPanPosition: (position: Position) => void;

  // グローバル装飾設定（新規オブジェクトに適用）
  defaultDecoration: ObjectDecoration;
  setDefaultDecoration: (decoration: Partial<ObjectDecoration>) => void;
}

/**
 * ユニークIDを生成
 */
const generateId = (): string => {
  return `obj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * セル座標を正規化（バウンディングボックスの左上を原点に）
 */
const normalizeCells = (
  cells: CellCoordinate[]
): { normalizedCells: CellCoordinate[]; position: Position } => {
  if (cells.length === 0) {
    return { normalizedCells: [], position: { x: 0, y: 0 } };
  }

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  const normalizedCells = cells.map(
    ([x, y]) => [x - minX, y - minY] as CellCoordinate
  );

  return {
    normalizedCells,
    position: { x: minX, y: minY },
  };
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // ツールモード
  toolMode: 'draw',
  setToolMode: (mode) => set({ toolMode: mode }),

  // オブジェクト管理
  objects: [],
  addObject: (obj) => set((state) => ({ objects: [...state.objects, obj] })),
  removeObject: (id) =>
    set((state) => {
      const obj = state.objects.find((o) => o.id === id);
      if (obj) {
        colorPaletteManager.releaseColor(obj.color);
      }
      // 選択状態から削除されたオブジェクトを除去
      const newSelectedIds = state.selection.selectedIds.filter((sid) => sid !== id);
      const newPrimaryId = state.selection.primaryId === id
        ? (newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null)
        : state.selection.primaryId;

      return {
        objects: state.objects.filter((o) => o.id !== id),
        ...updateSelection({
          selectedIds: newSelectedIds,
          primaryId: newPrimaryId,
          mode: newSelectedIds.length > 1 ? 'multiple' : 'single',
        }),
      };
    }),
  updateObject: (id, updates) =>
    set((state) => {
      const objects = state.objects.map((o) => {
        if (o.id !== id) return o;

        // 色が変更される場合はパレット使用回数を更新
        if (updates.color && updates.color !== o.color) {
          colorPaletteManager.releaseColor(o.color);
          // パレット内の色の場合のみ記録
          if ((OBJECT_COLOR_PALETTE as readonly string[]).includes(updates.color)) {
            colorPaletteManager.recordColorUsage(updates.color);
          }
        }

        return { ...o, ...updates };
      });
      return { objects };
    }),
  duplicateObject: (id) => {
    const state = get();
    const obj = state.objects.find((o) => o.id === id);
    if (!obj) return;

    // 複製時は新しい色を自動割り当て
    const newColor = getNextObjectColor();

    const newObj: GridObject = {
      ...obj,
      id: generateId(),
      position: {
        x: obj.position.x + 1,
        y: obj.position.y + 1,
      },
      color: newColor,
    };

    set({
      objects: [...state.objects, newObj],
      ...updateSelection({
        selectedIds: [newObj.id],
        primaryId: newObj.id,
        mode: 'single',
      }),
    });
  },
  clearObjects: () => {
    colorPaletteManager.reset();
    set({
      objects: [],
      ...updateSelection({
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      }),
    });
  },
  setObjects: (objects) => {
    // インポート/復元時にパレット使用状況を再構築
    colorPaletteManager.initializeFromObjects(objects);
    set({
      objects,
      ...updateSelection({
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      }),
    });
  },

  // 選択状態（複数選択対応）
  selection: {
    selectedIds: [],
    primaryId: null,
    mode: 'single',
  },
  selectedObjectId: null, // 後方互換性のため維持

  selectObject: (id, additive = false) => {
    if (id === null) {
      // 選択解除
      set(
        updateSelection({
          selectedIds: [],
          primaryId: null,
          mode: 'single',
        })
      );
      return;
    }

    set((state) => {
      if (additive) {
        // Shift+クリック: 追加選択/トグル
        const selectedIds = state.selection.selectedIds.includes(id)
          ? state.selection.selectedIds.filter((sid) => sid !== id)
          : [...state.selection.selectedIds, id];

        return updateSelection({
          selectedIds,
          primaryId: selectedIds.length > 0 ? id : null,
          mode: selectedIds.length > 1 ? 'multiple' : 'single',
        });
      } else {
        // 通常クリック: 単一選択
        return updateSelection({
          selectedIds: [id],
          primaryId: id,
          mode: 'single',
        });
      }
    });
  },

  selectObjects: (ids) => {
    set(
      updateSelection({
        selectedIds: ids,
        primaryId: ids[0] ?? null,
        mode: ids.length > 1 ? 'multiple' : 'single',
      })
    );
  },

  toggleSelection: (id) => {
    set((state) => {
      const selectedIds = state.selection.selectedIds.includes(id)
        ? state.selection.selectedIds.filter((sid) => sid !== id)
        : [...state.selection.selectedIds, id];

      return updateSelection({
        selectedIds,
        primaryId:
          selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null,
        mode: selectedIds.length > 1 ? 'multiple' : 'single',
      });
    });
  },

  clearSelection: () => {
    set(
      updateSelection({
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      })
    );
  },

  selectAll: () => {
    set((state) =>
      updateSelection({
        selectedIds: state.objects.map((o) => o.id),
        primaryId: state.objects[0]?.id ?? null,
        mode: state.objects.length > 1 ? 'multiple' : 'single',
      })
    );
  },

  // 描画中の一時データ
  drawingCells: [],
  addDrawingCell: (cell) => {
    const state = get();
    // 重複チェック
    const exists = state.drawingCells.some(
      ([x, y]) => x === cell[0] && y === cell[1]
    );
    if (!exists) {
      set({ drawingCells: [...state.drawingCells, cell] });
    }
  },
  clearDrawingCells: () => set({ drawingCells: [] }),
  commitDrawing: () => {
    const state = get();
    if (state.drawingCells.length === 0) return;

    const { normalizedCells, position } = normalizeCells(state.drawingCells);

    // 自動カラー割り当て
    const color = getNextObjectColor();

    const newObject: GridObject = {
      id: generateId(),
      cells: normalizedCells,
      position,
      rotation: 0,
      color,
      decoration: { ...state.defaultDecoration },
    };

    set({
      objects: [...state.objects, newObject],
      drawingCells: [],
    });
  },

  // パン位置
  panPosition: { x: 0, y: 0 },
  setPanPosition: (position) => set({ panPosition: position }),

  // グローバル装飾設定
  defaultDecoration: {
    showBorder: true,
    borderWidth: 1,
    opacity: 0.8,
  },
  setDefaultDecoration: (decoration) =>
    set((state) => ({
      defaultDecoration: { ...state.defaultDecoration, ...decoration },
    })),
}));

// 開発モードでストアを公開（E2Eテスト用）
if (import.meta.env.DEV) {
  (window as unknown as { __GRIDDER_STORE__: typeof useCanvasStore }).__GRIDDER_STORE__ = useCanvasStore;
}
