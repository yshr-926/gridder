/**
 * サジェスト操作用キーボードフック
 *
 * コマンドサジェストのキーボードナビゲーションを処理するフックです。
 */

import { useCallback, type KeyboardEvent } from 'react';
import type { CommandDefinition } from '@/features/commands/types';

/**
 * サジェスト操作用のキーボードハンドラを作成するフック
 *
 * @param suggestions - 現在のサジェスト配列
 * @param selectedIndex - 現在の選択インデックス
 * @param setSelectedIndex - 選択インデックス設定関数
 * @param onSelect - 選択実行時のコールバック
 * @returns キーダウンハンドラ
 */
export const useSuggestionKeyboard = (
  suggestions: CommandDefinition[],
  selectedIndex: number,
  setSelectedIndex: (index: number) => void,
  onSelect: (command: string) => void
): ((e: KeyboardEvent<HTMLInputElement>) => boolean) => {
  return useCallback(
    (e: KeyboardEvent<HTMLInputElement>): boolean => {
      if (suggestions.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(
            selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0
          );
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(
            selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1
          );
          return true;

        case 'Tab':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            onSelect(suggestions[selectedIndex].name);
          } else if (suggestions.length > 0) {
            onSelect(suggestions[0].name);
          }
          return true;

        default:
          return false;
      }
    },
    [suggestions, selectedIndex, setSelectedIndex, onSelect]
  );
};
