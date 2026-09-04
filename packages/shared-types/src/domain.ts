/**
 * ドメイン型定義
 *
 * グリッドオブジェクト、プロジェクトデータ等の共有型
 */

// ============================================================
// 座標・位置
// ============================================================

/** 2D 座標 */
export interface Position {
  x: number;
  y: number;
}

/** セル座標（グリッド単位） */
export type CellCoordinate = [number, number];

/** 回転角度 */
export type Rotation = 0 | 90 | 180 | 270;

// ============================================================
// グリッドオブジェクト
// ============================================================

/** オブジェクト装飾設定 */
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

/** グリッドオブジェクト */
export interface GridObject {
  /** オブジェクト ID */
  id: string;
  /** 構成セル座標配列 */
  cells: CellCoordinate[];
  /** グリッド上の位置 */
  position: Position;
  /** 回転角度 (0, 90, 180, 270) */
  rotation: Rotation;
  /** 塗りつぶし色 */
  color: string;
  /** オブジェクト名 */
  name?: string;
  /** 説明 */
  description?: string;
  /** 装飾設定（未指定値にはアプリケーション既定値を使用） */
  decoration?: Partial<ObjectDecoration>;
}

// ============================================================
// プロジェクトデータ
// ============================================================

/** 長さ単位 */
export type Unit = 'mm' | 'cm' | 'm';

/** @deprecated Unit を使用してください */
export type LengthUnit = Unit;

/** グリッド設定 */
export interface GridSettings {
  /** 1セルのサイズ（指定単位） */
  cellSize: number;
  /** 長さ単位 */
  unit: Unit;
  /** 表示倍率（UIセッション値） */
  zoom: number;
}

/** プロジェクトデータ形式 */
export interface ProjectData {
  /** データ形式バージョン */
  version: string;
  /** グリッド設定 */
  gridSettings: Omit<GridSettings, 'zoom'>;
  /** オブジェクト配列 */
  objects: GridObject[];
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 更新日時（ISO 8601） */
  updatedAt: string;
}
