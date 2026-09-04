import type { ProjectData } from './types';
import { validateProjectData, ProjectValidationError, checkVersion } from './validation';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useGroupStore } from '@/stores/groupStore';
import { useViewportStore } from '@/stores/viewportStore';

/**
 * インポート結果
 */
export interface ImportResult {
  /** インポート成功したかどうか */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 警告メッセージ（後方互換モード時など） */
  warning?: string;
  /** インポートされたデータ（成功時） */
  data?: ProjectData;
}

/**
 * インポートエラーの種類
 */
export type ImportErrorType = 'syntax' | 'validation' | 'file_read' | 'unknown';

/**
 * JSON 文字列からプロジェクトデータをインポート
 * @param jsonString JSON 文字列
 * @returns インポート結果
 */
export const importProjectFromJSON = (jsonString: string): ImportResult => {
  try {
    // JSON パース
    const data = JSON.parse(jsonString);

    // バリデーション
    const validatedData = validateProjectData(data);

    // バージョンチェック（警告を取得）
    const versionCheck = checkVersion(validatedData.version);

    return {
      success: true,
      data: validatedData,
      warning: versionCheck.warning,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: 'JSONファイルの形式が不正です。正しいJSONファイルを選択してください。',
      };
    }

    if (error instanceof ProjectValidationError) {
      return {
        success: false,
        error: error.getDetailedMessage(),
      };
    }

    return {
      success: false,
      error: 'ファイルの読み込み中に予期しないエラーが発生しました。',
    };
  }
};

/**
 * File オブジェクトからプロジェクトデータをインポート
 * @param file File オブジェクト
 * @returns Promise<ImportResult>
 */
export const importProjectFromFile = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    // ファイル拡張子チェック
    if (!file.name.toLowerCase().endsWith('.json')) {
      resolve({
        success: false,
        error: 'JSONファイル（.json）を選択してください。',
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;

      if (typeof content !== 'string') {
        resolve({
          success: false,
          error: 'ファイルの内容を読み取れませんでした。',
        });
        return;
      }

      const result = importProjectFromJSON(content);
      resolve(result);
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'ファイルの読み込みに失敗しました。',
      });
    };

    reader.readAsText(file);
  });
};

/**
 * プロジェクトデータをストアに適用
 * @param data ProjectData オブジェクト
 */
export const applyProjectData = (data: ProjectData): void => {
  // グリッド設定を適用
  useGridSettingsStore.setState({
    cellSize: data.gridSettings.cellSize,
    unit: data.gridSettings.unit,
  });

  // オブジェクトを適用（ディープコピー）
  const objects = data.objects.map((obj) => ({
    ...obj,
    cells: obj.cells.map(([x, y]) => [x, y] as [number, number]),
    position: { ...obj.position },
  }));

  useCanvasStore.setState({
    objects,
    selectedObjectId: null,
    drawingCells: [],
    toolMode: 'draw',
  });

  // グループを復元（存在する場合）
  if (data.groups && data.groups.length > 0) {
    useGroupStore.getState().setGroups(
      data.groups.map((group) => ({
        ...group,
        objectIds: [...group.objectIds], // 配列をディープコピー
      }))
    );
  } else {
    // グループ情報がない場合はクリア
    useGroupStore.getState().clearGroups();
  }

  // 履歴をクリア
  useHistoryStore.getState().clearHistory();
};

/**
 * ファイルからインポートしてストアに適用
 * @param file File オブジェクト
 * @returns Promise<ImportResult>
 */
export const importAndApplyFromFile = async (file: File): Promise<ImportResult> => {
  const result = await importProjectFromFile(file);

  if (result.success && result.data) {
    applyProjectData(result.data);
  }

  return result;
};

/**
 * 新規プロジェクトを作成（すべての状態をリセット）
 */
export const createNewProject = (): void => {
  useViewportStore.getState().resetViewport();

  // キャンバス状態をリセット
  useCanvasStore.setState({
    objects: [],
    selectedObjectId: null,
    drawingCells: [],
    toolMode: 'draw',
  });

  // グリッド設定をデフォルトに
  useGridSettingsStore.setState({
    cellSize: 10,
    unit: 'cm',
  });

  // グループをクリア
  useGroupStore.getState().clearGroups();

  // 履歴をクリア
  useHistoryStore.getState().clearHistory();
};

/**
 * 現在のプロジェクトが変更されているか確認
 * （オブジェクトが存在する場合は変更ありとみなす）
 */
export const hasUnsavedChanges = (): boolean => {
  const { objects } = useCanvasStore.getState();
  return objects.length > 0;
};
