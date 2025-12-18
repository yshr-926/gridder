/**
 * グリッド上の座標を表す型
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * グリッドセルの座標（グリッド単位）
 */
export type CellCoordinate = [number, number];

/**
 * ツールモード
 */
export type ToolMode = 'draw' | 'select' | 'eraser';

/**
 * 単位
 */
export type Unit = 'mm' | 'cm' | 'm';

/**
 * グリッド設定
 */
export interface GridSettings {
  /** 1マスのサイズ（実寸） */
  cellSize: number;
  /** 単位 */
  unit: Unit;
  /** 表示倍率（ズーム） */
  zoom: number;
}

/**
 * グリッドオブジェクト（塗りつぶしで作成された図形）
 */
export interface GridObject {
  /** 一意の識別子 */
  id: string;
  /** 塗りつぶされたセルの座標配列 */
  cells: CellCoordinate[];
  /** オブジェクトの基準位置（グリッド単位） */
  position: Position;
  /** 回転角度（0, 90, 180, 270） */
  rotation: 0 | 90 | 180 | 270;
  /** 塗りつぶし色 */
  color: string;
  /** オブジェクト名（任意） */
  name?: string;
}

/**
 * プロジェクトデータ（JSON エクスポート形式）
 */
export interface ProjectData {
  /** データフォーマットバージョン */
  version: string;
  /** グリッド設定 */
  gridSettings: Omit<GridSettings, 'zoom'>;
  /** 配置されたオブジェクト */
  objects: GridObject[];
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * キャンバスの状態
 */
export interface CanvasState {
  /** キャンバスの幅（ピクセル） */
  width: number;
  /** キャンバスの高さ（ピクセル） */
  height: number;
  /** パン位置 */
  panPosition: Position;
}
