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
 * テキスト表示位置
 */
export type TextPosition = 'center' | 'top' | 'bottom' | 'inside';

/**
 * 寸法表示モード
 */
export type DimensionDisplayMode = 'none' | 'size' | 'edges' | 'both';

/**
 * 単位
 */
export type Unit = 'mm' | 'cm' | 'm';

/**
 * オブジェクト装飾設定
 */
export interface ObjectDecoration {
  /** 枠線を表示するか */
  showBorder: boolean;
  /** 枠線の色（省略時はオブジェクト色を使用） */
  borderColor?: string;
  /** 枠線の太さ（ピクセル） */
  borderWidth: number;
  /** 塗りつぶしの透明度（0.0-1.0） */
  opacity: number;
}

/**
 * デフォルト装飾設定
 */
export const DEFAULT_DECORATION: ObjectDecoration = {
  showBorder: true,
  borderWidth: 1,
  opacity: 0.8,
};

/**
 * オブジェクトテキスト設定（スタイルのみ、表示/非表示はUIストアで管理）
 */
export interface ObjectTextSettings {
  /** テキスト表示位置 */
  textPosition: TextPosition;
  /** フォントサイズ（ピクセル） */
  fontSize: number;
  /** テキスト色 */
  textColor: string;
}

/**
 * 寸法表示設定
 */
export interface DimensionSettings {
  /** 寸法表示モード */
  displayMode: DimensionDisplayMode;
  /** 寸法線を表示するか */
  showDimensionLines: boolean;
  /** フォントサイズ（ピクセル） */
  fontSize: number;
  /** 寸法テキスト色 */
  textColor: string;
}

/**
 * デフォルトテキスト設定
 */
export const DEFAULT_TEXT_SETTINGS: ObjectTextSettings = {
  textPosition: 'center',
  fontSize: 12,
  textColor: '#1f2937',
};

/**
 * デフォルト寸法表示設定
 */
export const DEFAULT_DIMENSION_SETTINGS: DimensionSettings = {
  displayMode: 'size',
  showDimensionLines: false,
  fontSize: 10,
  textColor: '#6b7280',
};

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
  /** 説明（任意） */
  description?: string;
  /** 装飾設定（省略時はデフォルト値を使用） */
  decoration?: Partial<ObjectDecoration>;
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

// グループ関連型
export type {
  ObjectGroup,
  RelativePosition,
  SelectionState,
  GroupOperationResult,
} from './group';
