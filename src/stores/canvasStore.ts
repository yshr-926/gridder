import { create } from 'zustand';
import type { GridObject, ToolMode, Position, CellCoordinate } from '../types';

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

  // 選択状態
  selectedObjectId: string | null;
  selectObject: (id: string | null) => void;

  // 描画中の一時データ
  drawingCells: CellCoordinate[];
  addDrawingCell: (cell: CellCoordinate) => void;
  clearDrawingCells: () => void;
  commitDrawing: (color?: string) => void;

  // パン位置
  panPosition: Position;
  setPanPosition: (position: Position) => void;
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
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    })),
  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),
  duplicateObject: (id) => {
    const state = get();
    const obj = state.objects.find((o) => o.id === id);
    if (!obj) return;

    const newObj: GridObject = {
      ...obj,
      id: generateId(),
      position: {
        x: obj.position.x + 1,
        y: obj.position.y + 1,
      },
    };

    set({ objects: [...state.objects, newObj] });
  },
  clearObjects: () => set({ objects: [], selectedObjectId: null }),
  setObjects: (objects) => set({ objects, selectedObjectId: null }),

  // 選択状態
  selectedObjectId: null,
  selectObject: (id) => set({ selectedObjectId: id }),

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
  commitDrawing: (color = '#333333') => {
    const state = get();
    if (state.drawingCells.length === 0) return;

    const { normalizedCells, position } = normalizeCells(state.drawingCells);

    const newObject: GridObject = {
      id: generateId(),
      cells: normalizedCells,
      position,
      rotation: 0,
      color,
    };

    set({
      objects: [...state.objects, newObject],
      drawingCells: [],
    });
  },

  // パン位置
  panPosition: { x: 0, y: 0 },
  setPanPosition: (position) => set({ panPosition: position }),
}));
