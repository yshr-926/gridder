import type { ObjectDecoration, Position } from '@gridder/shared-types/domain';

export type {
  CellCoordinate,
  GridObject,
  GridSettings,
  ObjectDecoration,
  Position,
  ProjectData,
  Rotation,
  Unit,
} from '@gridder/shared-types/domain';

/**
 * ツールモード
 *
 * - draw: グリッド塗りつぶし
 * - select: 選択・移動
 * - eraser: 消しゴム
 * - polygon: 頂点描画（多角形作成）
 * - line: 線描画
 * - subtract: 減算モード（選択中のオブジェクトから領域を削除）
 */
export type ToolMode = 'draw' | 'select' | 'eraser' | 'polygon' | 'line' | 'subtract';

/**
 * テキスト表示位置
 */
export type TextPosition = 'center' | 'top' | 'bottom' | 'inside';

/**
 * 寸法表示モード
 */
export type DimensionDisplayMode = 'none' | 'size' | 'edges' | 'both';

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
export type { ObjectGroup, RelativePosition, SelectionState, GroupOperationResult } from './group';
