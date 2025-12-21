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

/** セル座標 (グリッド位置) */
export type CellCoordinate = [number, number];

// ============================================================
// グリッドオブジェクト
// ============================================================

/** オブジェクト装飾情報 */
export interface ObjectDecoration {
  /** ラベルテキスト */
  label?: string;
  /** アイコン識別子 */
  icon?: string;
  /** 背景パターン */
  pattern?: 'solid' | 'striped' | 'dotted';
  /** 境界線スタイル */
  borderStyle?: 'solid' | 'dashed' | 'none';
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
  rotation: 0 | 90 | 180 | 270;
  /** 塗りつぶし色 */
  color: string;
  /** 装飾情報 */
  decoration?: ObjectDecoration;
  /** グループ ID */
  groupId?: string;
  /** Z-Index (重なり順) */
  zIndex?: number;
  /** ロック状態 */
  locked?: boolean;
}

// ============================================================
// プロジェクトデータ
// ============================================================

/** 長さ単位 */
export type LengthUnit = 'mm' | 'cm' | 'm';

/** グリッド設定 */
export interface GridSettings {
  /** 1セルのサイズ（指定単位） */
  cellSize: number;
  /** 長さ単位 */
  unit: LengthUnit;
  /** 表示倍率 */
  scale?: number;
}

/** プロジェクトデータ形式 */
export interface ProjectData {
  /** データ形式バージョン */
  version: string;
  /** プロジェクト名 */
  name?: string;
  /** グリッド設定 */
  gridSettings: GridSettings;
  /** オブジェクト配列 */
  objects: GridObject[];
  /** メタデータ */
  metadata?: {
    createdAt: string;
    updatedAt: string;
    author?: string;
  };
}
