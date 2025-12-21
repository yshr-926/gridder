/**
 * コマンド実行フック
 *
 * コマンドパレットやキーボードショートカットからコマンドを実行するためのフックです。
 * CommandExecutor インスタンスを管理し、コマンドの実行と結果取得を提供します。
 */

import { useCallback, useMemo, useRef } from 'react';
import { CommandExecutor } from '@/features/commands/executor';
import { allCommands } from '@/features/commands/commands';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useHistoryStore } from '@/stores/historyStore';
import { getNextObjectColor } from '@/utils/colorPalette';
import type { CommandContext, CommandResult, CommandDefinition } from '@/features/commands/types';

/**
 * コマンド実行フックの戻り値
 */
interface UseCommandExecutorReturn {
  /** コマンドを実行する */
  execute: (input: string) => CommandResult;
  /** 利用可能なコマンド一覧 */
  availableCommands: CommandDefinition[];
  /** 現在のプロンプト（対話的コマンド用） */
  currentPrompt: string | null;
  /** 履歴からコマンドを取得 */
  getHistory: () => string[];
  /** 履歴をクリア */
  clearHistory: () => void;
}

/**
 * コマンド実行フック
 *
 * コマンドシステムを React コンポーネントから利用するためのフックです。
 * CommandExecutor インスタンスをメモ化して管理し、コマンドの実行と結果取得を提供します。
 *
 * @returns コマンド実行関数と関連情報
 *
 * @example
 * ```tsx
 * const { execute, availableCommands, currentPrompt } = useCommandExecutor();
 *
 * const handleSubmit = (input: string) => {
 *   const result = execute(input);
 *   if (result.success) {
 *     console.log('成功:', result.message);
 *   } else {
 *     console.error('失敗:', result.message);
 *   }
 * };
 * ```
 */
export const useCommandExecutor = (): UseCommandExecutorReturn => {
  // ストアへの参照を取得（Zustand のセレクタパターンではなくストア自体を渡す）
  const canvasStore = useCanvasStore;
  const gridSettingsStore = useGridSettingsStore;
  const historyStore = useHistoryStore;

  // 履歴参照用のRef（履歴配列を保持）
  const commandHistoryRef = useRef<string[]>([]);

  // CommandExecutor のインスタンスをメモ化
  const executor = useMemo(() => {
    const context: CommandContext = {
      canvasStore,
      gridSettingsStore,
      historyStore,
      cursorPosition: null,
      lastPoint: null,
      getNextObjectColor,
    };

    const exec = new CommandExecutor(context);

    // 全コマンドを登録
    exec.registerCommands(allCommands);

    return exec;
  }, [canvasStore, gridSettingsStore, historyStore]);

  /**
   * コマンドを実行
   */
  const execute = useCallback(
    (input: string): CommandResult => {
      const result = executor.execute(input);

      // 成功した場合は履歴に追加
      if (result.success) {
        commandHistoryRef.current = [...commandHistoryRef.current, input];
        // 履歴サイズを制限（最大100件）
        if (commandHistoryRef.current.length > 100) {
          commandHistoryRef.current = commandHistoryRef.current.slice(-100);
        }
      }

      return result;
    },
    [executor]
  );

  /**
   * 利用可能なコマンドを取得
   */
  const availableCommands = useMemo(() => {
    return executor.getAvailableCommands();
  }, [executor]);

  /**
   * 現在のプロンプトを取得
   */
  const currentPrompt = executor.getCurrentPrompt();

  /**
   * 履歴を取得
   */
  const getHistory = useCallback(() => {
    return [...commandHistoryRef.current];
  }, []);

  /**
   * 履歴をクリア
   */
  const clearHistory = useCallback(() => {
    commandHistoryRef.current = [];
    executor.clearHistory();
  }, [executor]);

  return {
    execute,
    availableCommands,
    currentPrompt,
    getHistory,
    clearHistory,
  };
};
