import { useEffect, useRef, useCallback, useState } from 'react';
import { createProjectData, serializeProjectData } from './exportProject';
import { importProjectFromJSON, applyProjectData } from './importProject';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';

/**
 * LocalStorage キー
 */
export const STORAGE_KEY = 'gridder_autosave';

/**
 * 最終保存時刻のキー
 */
export const STORAGE_TIME_KEY = 'gridder_autosave_time';

/**
 * 自動保存の遅延時間（ミリ秒）
 */
export const AUTOSAVE_DELAY = 2000;

/**
 * LocalStorage へ保存
 * @returns 成功したかどうか
 */
export const saveToLocalStorage = (): boolean => {
  try {
    const projectData = createProjectData('Auto Save');
    const json = serializeProjectData(projectData, false);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(STORAGE_TIME_KEY, new Date().toISOString());
    return true;
  } catch (error) {
    // LocalStorage の容量制限やプライベートブラウジングモードでのエラー
    console.error('Failed to auto-save to LocalStorage:', error);
    return false;
  }
};

/**
 * LocalStorage から読み込み
 * @returns JSON 文字列、または null
 */
export const loadFromLocalStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load from LocalStorage:', error);
    return null;
  }
};

/**
 * 自動保存データが存在するかチェック
 */
export const hasAutoSavedData = (): boolean => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data !== null && data.length > 0;
  } catch {
    return false;
  }
};

/**
 * 最後の自動保存時刻を取得
 * @returns Date オブジェクト、または null
 */
export const getLastAutoSaveTime = (): Date | null => {
  try {
    const timeStr = localStorage.getItem(STORAGE_TIME_KEY);
    if (!timeStr) return null;
    const date = new Date(timeStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/**
 * LocalStorage の自動保存データを削除
 */
export const clearLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIME_KEY);
  } catch (error) {
    console.error('Failed to clear LocalStorage:', error);
  }
};

/**
 * LocalStorage から復元
 * @returns 成功したかどうか
 */
export const restoreFromLocalStorage = (): boolean => {
  const json = loadFromLocalStorage();
  if (!json) return false;

  const result = importProjectFromJSON(json);
  if (!result.success || !result.data) {
    console.error('Failed to restore from LocalStorage:', result.error);
    return false;
  }

  applyProjectData(result.data);
  return true;
};

/**
 * 自動保存フック
 *
 * objects, cellSize, unit の変更を監視し、
 * AUTOSAVE_DELAY ミリ秒後に LocalStorage へ保存する。
 *
 * @param enabled 自動保存を有効にするかどうか（デフォルト: true）
 * @param delay 保存までの遅延時間（デフォルト: AUTOSAVE_DELAY）
 * @returns 手動保存関数
 */
export const useAutoSave = (
  enabled: boolean = true,
  delay: number = AUTOSAVE_DELAY
): { save: () => boolean; lastSaveTime: Date | null } => {
  const objects = useCanvasStore((state) => state.objects);
  const cellSize = useGridSettingsStore((state) => state.cellSize);
  const unit = useGridSettingsStore((state) => state.unit);

  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(() => getLastAutoSaveTime());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 手動保存関数
  const save = useCallback(() => {
    const success = saveToLocalStorage();
    if (success) {
      setLastSaveTime(new Date());
    }
    return success;
  }, []);

  // 自動保存エフェクト
  useEffect(() => {
    if (!enabled) return;

    // 既存のタイムアウトをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 遅延後に保存
    timeoutRef.current = setTimeout(() => {
      const success = saveToLocalStorage();
      if (success) {
        setLastSaveTime(new Date());
      }
    }, delay);

    // クリーンアップ
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [objects, cellSize, unit, enabled, delay]);

  return {
    save,
    lastSaveTime,
  };
};

/**
 * 復元確認フック
 *
 * コンポーネントのマウント時に自動保存データの有無を確認し、
 * 復元するかどうかを返す。
 *
 * @returns 復元確認の状態と操作
 */
export const useRestoreConfirmation = () => {
  const hasData = hasAutoSavedData();
  const lastSaveTime = getLastAutoSaveTime();

  const restore = useCallback(() => {
    return restoreFromLocalStorage();
  }, []);

  const dismiss = useCallback(() => {
    clearLocalStorage();
  }, []);

  return {
    hasData,
    lastSaveTime,
    restore,
    dismiss,
  };
};
