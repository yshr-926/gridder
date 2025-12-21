import type { ProjectData, Rotation } from './types';
import { PROJECT_DATA_VERSION, LEGACY_VERSION } from './types';
import type { GridObject, Unit, CellCoordinate, Position, ObjectDecoration } from '@/types';
import { DEFAULT_DECORATION } from '@/types';
import { colorPaletteManager } from '@/utils/colorPalette';

/**
 * バージョンチェック結果
 */
export interface VersionCheckResult {
  /** 互換性があるか */
  compatible: boolean;
  /** 警告メッセージ（後方互換モード時など） */
  warning?: string;
  /** エラーメッセージ（互換性がない場合） */
  error?: string;
}

/**
 * バージョンをチェック
 */
export const checkVersion = (version: string): VersionCheckResult => {
  if (version === PROJECT_DATA_VERSION) {
    return { compatible: true };
  }

  if (version === LEGACY_VERSION) {
    return {
      compatible: true,
      warning: '古いバージョン（v1.0）のファイルです。グループ情報は含まれていません。',
    };
  }

  // 未来のバージョン
  if (version > PROJECT_DATA_VERSION) {
    return {
      compatible: false,
      error: 'このファイルは新しいバージョンで作成されています。アプリを更新してください。',
    };
  }

  // 不明なバージョン
  return {
    compatible: false,
    error: `サポートされていないバージョン（${version}）です。`,
  };
};

/**
 * バリデーションエラーのパス情報
 */
export interface ValidationErrorPath {
  /** エラーが発生したフィールドのパス */
  path: string;
  /** エラーメッセージ */
  message: string;
}

/**
 * プロジェクトバリデーションエラー
 */
export class ProjectValidationError extends Error {
  public readonly errors: ValidationErrorPath[];

  constructor(message: string, errors: ValidationErrorPath[] = []) {
    super(message);
    this.name = 'ProjectValidationError';
    this.errors = errors;
  }

  /**
   * エラー詳細を日本語で取得
   */
  getDetailedMessage(): string {
    if (this.errors.length === 0) {
      return this.message;
    }
    const details = this.errors
      .map((e) => `  - ${e.path}: ${e.message}`)
      .join('\n');
    return `${this.message}\n${details}`;
  }
}

/**
 * 有効な単位かどうかをチェック
 */
const isValidUnit = (value: unknown): value is Unit => {
  return value === 'mm' || value === 'cm' || value === 'm';
};

/**
 * 有効な回転角度かどうかをチェック
 */
const isValidRotation = (value: unknown): value is Rotation => {
  return value === 0 || value === 90 || value === 180 || value === 270;
};

/**
 * Position オブジェクトのバリデーション
 */
const validatePosition = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push({ path, message: 'オブジェクトである必要があります' });
    return { valid: false, errors };
  }

  const pos = value as Record<string, unknown>;

  if (typeof pos.x !== 'number' || !Number.isFinite(pos.x)) {
    errors.push({ path: `${path}.x`, message: '有限の数値である必要があります' });
  }

  if (typeof pos.y !== 'number' || !Number.isFinite(pos.y)) {
    errors.push({ path: `${path}.y`, message: '有限の数値である必要があります' });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * CellCoordinate 配列のバリデーション
 */
const validateCells = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (!Array.isArray(value)) {
    errors.push({ path, message: '配列である必要があります' });
    return { valid: false, errors };
  }

  value.forEach((cell, index) => {
    if (!Array.isArray(cell) || cell.length !== 2) {
      errors.push({
        path: `${path}[${index}]`,
        message: '[x, y] の形式である必要があります',
      });
      return;
    }

    const [x, y] = cell;
    if (typeof x !== 'number' || !Number.isInteger(x)) {
      errors.push({
        path: `${path}[${index}][0]`,
        message: '整数である必要があります',
      });
    }
    if (typeof y !== 'number' || !Number.isInteger(y)) {
      errors.push({
        path: `${path}[${index}][1]`,
        message: '整数である必要があります',
      });
    }
  });

  return { valid: errors.length === 0, errors };
};

/**
 * GridObject のバリデーション
 */
export const validateGridObject = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push({ path, message: 'オブジェクトである必要があります' });
    return { valid: false, errors };
  }

  const obj = value as Record<string, unknown>;

  // id
  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    errors.push({ path: `${path}.id`, message: '空でない文字列である必要があります' });
  }

  // cells
  const cellsResult = validateCells(obj.cells, `${path}.cells`);
  errors.push(...cellsResult.errors);

  // position
  const positionResult = validatePosition(obj.position, `${path}.position`);
  errors.push(...positionResult.errors);

  // rotation
  if (!isValidRotation(obj.rotation)) {
    errors.push({
      path: `${path}.rotation`,
      message: '0, 90, 180, 270 のいずれかである必要があります',
    });
  }

  // color
  if (typeof obj.color !== 'string' || obj.color.trim() === '') {
    errors.push({ path: `${path}.color`, message: '空でない文字列である必要があります' });
  }

  // name (optional)
  if (obj.name !== undefined && typeof obj.name !== 'string') {
    errors.push({ path: `${path}.name`, message: '文字列である必要があります' });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * GridSettings のバリデーション
 */
const validateGridSettings = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push({ path, message: 'オブジェクトである必要があります' });
    return { valid: false, errors };
  }

  const settings = value as Record<string, unknown>;

  // cellSize
  if (typeof settings.cellSize !== 'number' || settings.cellSize <= 0) {
    errors.push({
      path: `${path}.cellSize`,
      message: '正の数値である必要があります',
    });
  }

  // unit
  if (!isValidUnit(settings.unit)) {
    errors.push({
      path: `${path}.unit`,
      message: '"mm", "cm", "m" のいずれかである必要があります',
    });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * ISO 8601 形式の日時文字列かどうかをチェック
 */
const isValidISODateString = (value: string): boolean => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

/**
 * ObjectGroup のバリデーション
 */
export const validateObjectGroup = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push({ path, message: 'オブジェクトである必要があります' });
    return { valid: false, errors };
  }

  const group = value as Record<string, unknown>;

  // id
  if (typeof group.id !== 'string' || group.id.trim() === '') {
    errors.push({ path: `${path}.id`, message: '空でない文字列である必要があります' });
  }

  // objectIds
  if (!Array.isArray(group.objectIds)) {
    errors.push({ path: `${path}.objectIds`, message: '配列である必要があります' });
  } else {
    group.objectIds.forEach((objId, index) => {
      if (typeof objId !== 'string' || objId.trim() === '') {
        errors.push({
          path: `${path}.objectIds[${index}]`,
          message: '空でない文字列である必要があります',
        });
      }
    });
  }

  // anchorObjectId
  if (typeof group.anchorObjectId !== 'string' || group.anchorObjectId.trim() === '') {
    errors.push({
      path: `${path}.anchorObjectId`,
      message: '空でない文字列である必要があります',
    });
  }

  // name (optional)
  if (group.name !== undefined && typeof group.name !== 'string') {
    errors.push({ path: `${path}.name`, message: '文字列である必要があります' });
  }

  // createdAt
  if (typeof group.createdAt !== 'string') {
    errors.push({
      path: `${path}.createdAt`,
      message: '文字列である必要があります',
    });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Metadata のバリデーション
 */
export const validateMetadata = (
  value: unknown,
  path: string
): { valid: boolean; errors: ValidationErrorPath[] } => {
  const errors: ValidationErrorPath[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push({ path, message: 'オブジェクトである必要があります' });
    return { valid: false, errors };
  }

  const metadata = value as Record<string, unknown>;

  // createdAt
  if (typeof metadata.createdAt !== 'string' || !isValidISODateString(metadata.createdAt)) {
    errors.push({
      path: `${path}.createdAt`,
      message: '有効な日時文字列（ISO 8601形式）である必要があります',
    });
  }

  // updatedAt
  if (typeof metadata.updatedAt !== 'string' || !isValidISODateString(metadata.updatedAt)) {
    errors.push({
      path: `${path}.updatedAt`,
      message: '有効な日時文字列（ISO 8601形式）である必要があります',
    });
  }

  // exportedFrom
  if (typeof metadata.exportedFrom !== 'string' || metadata.exportedFrom.trim() === '') {
    errors.push({
      path: `${path}.exportedFrom`,
      message: '空でない文字列である必要があります',
    });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * プロジェクトデータのバリデーション
 * @param data 検証対象データ
 * @returns 検証済みのProjectData
 * @throws {ProjectValidationError} バリデーションエラー
 */
export const validateProjectData = (data: unknown): ProjectData => {
  const errors: ValidationErrorPath[] = [];

  if (typeof data !== 'object' || data === null) {
    throw new ProjectValidationError('プロジェクトデータはオブジェクトである必要があります');
  }

  const obj = data as Record<string, unknown>;

  // version - まずバージョンチェック
  if (typeof obj.version !== 'string') {
    errors.push({
      path: 'version',
      message: '文字列である必要があります',
    });
  } else {
    const versionCheck = checkVersion(obj.version);
    if (!versionCheck.compatible) {
      throw new ProjectValidationError(
        versionCheck.error || 'バージョンが互換性がありません'
      );
    }
  }

  // name
  if (typeof obj.name !== 'string') {
    errors.push({
      path: 'name',
      message: '文字列である必要があります',
    });
  }

  // gridSettings
  const gridSettingsResult = validateGridSettings(obj.gridSettings, 'gridSettings');
  errors.push(...gridSettingsResult.errors);

  // objects
  if (!Array.isArray(obj.objects)) {
    errors.push({
      path: 'objects',
      message: '配列である必要があります',
    });
  } else {
    obj.objects.forEach((object, index) => {
      const objectResult = validateGridObject(object, `objects[${index}]`);
      errors.push(...objectResult.errors);
    });
  }

  // groups (optional, v1.1+)
  if (obj.groups !== undefined) {
    if (!Array.isArray(obj.groups)) {
      errors.push({
        path: 'groups',
        message: '配列である必要があります',
      });
    } else {
      obj.groups.forEach((group, index) => {
        const groupResult = validateObjectGroup(group, `groups[${index}]`);
        errors.push(...groupResult.errors);
      });
    }
  }

  // metadata
  const metadataResult = validateMetadata(obj.metadata, 'metadata');
  errors.push(...metadataResult.errors);

  if (errors.length > 0) {
    throw new ProjectValidationError(
      'プロジェクトデータの形式が不正です',
      errors
    );
  }

  return data as ProjectData;
};

/**
 * 型ガード: ProjectData かどうかをチェック
 */
export const isProjectData = (data: unknown): data is ProjectData => {
  try {
    validateProjectData(data);
    return true;
  } catch {
    return false;
  }
};

/**
 * 型ガード: GridObject かどうかをチェック
 */
export const isGridObject = (value: unknown): value is GridObject => {
  const result = validateGridObject(value, 'object');
  return result.valid;
};

/**
 * 型ガード: Position かどうかをチェック
 */
export const isPosition = (value: unknown): value is Position => {
  const result = validatePosition(value, 'position');
  return result.valid;
};

/**
 * 型ガード: CellCoordinate かどうかをチェック
 */
export const isCellCoordinate = (value: unknown): value is CellCoordinate => {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }
  const [x, y] = value;
  return (
    typeof x === 'number' &&
    Number.isInteger(x) &&
    typeof y === 'number' &&
    Number.isInteger(y)
  );
};

/**
 * オブジェクトにデフォルト装飾を適用（互換性維持用）
 * 既存データにデフォルト値をマージして完全な ObjectDecoration を保証する
 */
export const applyDefaultDecoration = (obj: GridObject): GridObject => {
  // decoration が未定義または部分的な場合、DEFAULT_DECORATION とマージ
  const mergedDecoration: ObjectDecoration = {
    ...DEFAULT_DECORATION,
    ...(obj.decoration ?? {}),
  };

  return {
    ...obj,
    decoration: mergedDecoration,
  };
};

/**
 * プロジェクトデータを最新フォーマットに変換
 */
export const migrateProjectData = (data: ProjectData): ProjectData => {
  return {
    ...data,
    objects: data.objects.map(applyDefaultDecoration),
  };
};

/**
 * インポート時のパレット初期化を含む完全なマイグレーション
 */
export const importAndMigrateProject = (data: ProjectData): ProjectData => {
  const migratedData = migrateProjectData(data);
  // パレット使用状況を再構築
  colorPaletteManager.initializeFromObjects(migratedData.objects);
  return migratedData;
};
