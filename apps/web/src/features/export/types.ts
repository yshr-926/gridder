import type { GridObject, Unit, CellCoordinate, Position } from '@/types';
import type { ObjectGroup } from '@/types/group';

/**
 * プロジェクトデータのバージョン
 * - 1.0: 初期バージョン（グループ非対応）
 * - 1.1: グループ対応版
 */
export const PROJECT_DATA_VERSION = '1.1';

/**
 * レガシーバージョン（グループ非対応）
 */
export const LEGACY_VERSION = '1.0';

/**
 * サポートされるバージョン一覧
 */
export const SUPPORTED_VERSIONS = [LEGACY_VERSION, PROJECT_DATA_VERSION] as const;

/**
 * サポートされている回転角度
 */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * グリッド設定（エクスポート用）
 */
export interface ExportGridSettings {
  /** 1マスのサイズ（実寸） */
  cellSize: number;
  /** 単位 */
  unit: Unit;
}

/**
 * メタデータ
 */
export interface ProjectMetadata {
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
  /** エクスポート元アプリケーション */
  exportedFrom: string;
}

/**
 * プロジェクトデータ（JSON エクスポート形式） v1.1
 */
export interface ProjectData {
  /** データフォーマットバージョン */
  version: string;
  /** プロジェクト名 */
  name: string;
  /** グリッド設定 */
  gridSettings: ExportGridSettings;
  /** 配置されたオブジェクト */
  objects: GridObject[];
  /** グループ情報（v1.1以降、オプション） */
  groups?: ObjectGroup[];
  /** メタデータ */
  metadata: ProjectMetadata;
}

/**
 * エクスポートオプション（JSON）
 */
export interface ExportOptions {
  /** ファイル名（省略時は自動生成） */
  filename?: string;
  /** プロジェクト名 */
  projectName?: string;
  /** 整形出力（デフォルト: true） */
  pretty?: boolean;
}

/**
 * 画像フォーマット
 */
export type ImageFormat = 'png' | 'jpeg';

/**
 * 画像エクスポートオプション
 */
export interface ImageExportOptions {
  /** 画像フォーマット */
  format: ImageFormat;
  /** JPEG品質（0-1、デフォルト: 0.92） */
  quality?: number;
  /** 背景色を含めるか（デフォルト: true） */
  includeBackground?: boolean;
  /** ピクセル比（デフォルト: 2） */
  pixelRatio?: number;
  /** ファイル名（省略時は自動生成） */
  filename?: string;
  /** 背景色（デフォルト: 'white'） */
  backgroundColor?: string;
}

/**
 * GridObject のエクスポート可能なフィールド
 * （id は必須、name はオプション）
 */
export interface ExportableGridObject {
  id: string;
  cells: CellCoordinate[];
  position: Position;
  rotation: Rotation;
  color: string;
  name?: string;
}
