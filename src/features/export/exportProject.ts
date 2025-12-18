import type { ProjectData, ExportOptions } from './types';
import { PROJECT_DATA_VERSION } from './types';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import type { GridObject } from '@/types';

/**
 * アプリケーション名とバージョン
 */
const APP_NAME = 'Gridder';
const APP_VERSION = '1.0';

/**
 * タイムスタンプ付きファイル名を生成（UTC時刻を使用）
 * @param prefix ファイル名のプレフィックス
 * @param extension ファイル拡張子（ドットなし）
 * @returns ファイル名（例: gridder-project_20241218_143025.json）
 */
export const generateFilename = (
  prefix: string = 'gridder-project',
  extension: string = 'json'
): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  return `${prefix}_${timestamp}.${extension}`;
};

/**
 * GridObject をディープコピー
 */
const deepCopyObjects = (objects: GridObject[]): GridObject[] => {
  return objects.map((obj) => ({
    ...obj,
    cells: obj.cells.map(([x, y]) => [x, y] as [number, number]),
    position: { ...obj.position },
  }));
};

/**
 * 現在のストア状態から ProjectData を生成
 * @param projectName プロジェクト名（省略時は空文字）
 * @returns ProjectData オブジェクト
 */
export const createProjectData = (projectName: string = ''): ProjectData => {
  const { objects } = useCanvasStore.getState();
  const { cellSize, unit } = useGridSettingsStore.getState();

  const now = new Date().toISOString();

  return {
    version: PROJECT_DATA_VERSION,
    name: projectName,
    gridSettings: {
      cellSize,
      unit,
    },
    objects: deepCopyObjects(objects),
    metadata: {
      createdAt: now,
      updatedAt: now,
      exportedFrom: `${APP_NAME} v${APP_VERSION}`,
    },
  };
};

/**
 * 既存の ProjectData を更新して新しいデータで返す
 * @param existingData 既存のプロジェクトデータ
 * @returns 更新された ProjectData オブジェクト
 */
export const updateProjectData = (existingData: ProjectData): ProjectData => {
  const { objects } = useCanvasStore.getState();
  const { cellSize, unit } = useGridSettingsStore.getState();

  return {
    ...existingData,
    gridSettings: {
      cellSize,
      unit,
    },
    objects: deepCopyObjects(objects),
    metadata: {
      ...existingData.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
};

/**
 * JSON 文字列を生成
 * @param data ProjectData オブジェクト
 * @param pretty 整形出力するか（デフォルト: true）
 * @returns JSON 文字列
 */
export const serializeProjectData = (data: ProjectData, pretty: boolean = true): string => {
  if (pretty) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
};

/**
 * Blob を作成してダウンロード
 * @param content ファイルコンテンツ
 * @param filename ファイル名
 * @param mimeType MIME タイプ
 */
const downloadBlob = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // メモリリーク防止
  URL.revokeObjectURL(url);
};

/**
 * プロジェクトを JSON ファイルとしてエクスポート
 * @param options エクスポートオプション
 */
export const exportProjectAsJSON = (options: ExportOptions = {}): void => {
  const {
    filename,
    projectName = '',
    pretty = true,
  } = options;

  const projectData = createProjectData(projectName);
  const json = serializeProjectData(projectData, pretty);
  const finalFilename = filename || generateFilename('gridder-project', 'json');

  downloadBlob(json, finalFilename, 'application/json');
};

/**
 * ProjectData を JSON ファイルとしてダウンロード
 * @param data ProjectData オブジェクト
 * @param filename ファイル名（省略時は自動生成）
 * @param pretty 整形出力するか（デフォルト: true）
 */
export const downloadProjectData = (
  data: ProjectData,
  filename?: string,
  pretty: boolean = true
): void => {
  const json = serializeProjectData(data, pretty);
  const finalFilename = filename || generateFilename('gridder-project', 'json');
  downloadBlob(json, finalFilename, 'application/json');
};
