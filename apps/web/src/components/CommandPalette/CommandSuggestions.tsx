/**
 * コマンドサジェスト（オートコンプリート）コンポーネント
 *
 * 入力中のコマンドに対するサジェストを表示するコンポーネントです。
 * 前方一致でコマンドをフィルタリングし、選択可能なリストを表示します。
 */

import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import type { CommandDefinition } from '@/features/commands/types';

/**
 * CommandSuggestions コンポーネントの Props
 */
interface CommandSuggestionsProps {
  /** 現在の入力値 */
  input: string;
  /** 利用可能なコマンド一覧 */
  commands: CommandDefinition[];
  /** コマンド選択時のコールバック */
  onSelect: (command: string) => void;
  /** 現在選択中のインデックス */
  selectedIndex?: number;
  /** 選択インデックス変更時のコールバック */
  onSelectedIndexChange?: (index: number) => void;
  /** 最大表示件数 */
  maxItems?: number;
}

/**
 * コマンドサジェスト（オートコンプリート）コンポーネント
 *
 * 入力されたテキストに対して前方一致するコマンドをサジェストします。
 * コマンド名と別名の両方でマッチングを行います。
 *
 * @example
 * ```tsx
 * <CommandSuggestions
 *   input="LI"
 *   commands={availableCommands}
 *   onSelect={(cmd) => setInput(cmd)}
 *   selectedIndex={selectedIndex}
 *   onSelectedIndexChange={setSelectedIndex}
 * />
 * ```
 */
export const CommandSuggestions = memo(
  ({
    input,
    commands,
    onSelect,
    selectedIndex = -1,
    onSelectedIndexChange,
    maxItems = 5,
  }: CommandSuggestionsProps) => {
    const listRef = useRef<HTMLDivElement>(null);

    /**
     * 入力値に一致するサジェストをフィルタリング
     */
    const suggestions = useMemo(() => {
      if (!input.trim()) return [];

      const inputUpper = input.toUpperCase();

      return commands
        .filter((cmd) => {
          // コマンド名で前方一致
          if (cmd.name.startsWith(inputUpper)) return true;
          // 別名で前方一致
          if (cmd.aliases?.some((alias) => alias.toUpperCase().startsWith(inputUpper))) {
            return true;
          }
          return false;
        })
        .slice(0, maxItems);
    }, [input, commands, maxItems]);

    /**
     * 選択中のアイテムが見えるようにスクロール
     */
    useEffect(() => {
      if (selectedIndex >= 0 && listRef.current) {
        const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined;
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [selectedIndex]);

    /**
     * アイテムクリック時のハンドラ
     */
    const handleItemClick = useCallback(
      (command: string) => {
        onSelect(command);
      },
      [onSelect]
    );

    /**
     * マウスホバー時のハンドラ
     */
    const handleMouseEnter = useCallback(
      (index: number) => {
        onSelectedIndexChange?.(index);
      },
      [onSelectedIndexChange]
    );

    // サジェストがない場合は何も表示しない
    if (suggestions.length === 0) return null;

    return (
      <div
        ref={listRef}
        className="
          absolute bottom-full left-0 right-0
          border-t border-gray-700 bg-gray-800
          max-h-40 overflow-y-auto
          shadow-lg
        "
        role="listbox"
        aria-label="コマンドサジェスト"
      >
        {suggestions.map((cmd, index) => (
          <button
            key={cmd.name}
            onClick={() => handleItemClick(cmd.name)}
            onMouseEnter={() => handleMouseEnter(index)}
            className={`
              w-full text-left px-4 py-2
              flex items-center justify-between
              font-mono text-sm
              transition-colors duration-75
              ${
                index === selectedIndex
                  ? 'bg-gray-700 text-white'
                  : 'hover:bg-gray-700 text-gray-300'
              }
            `}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-semibold">{cmd.name}</span>
              {cmd.aliases && cmd.aliases.length > 0 && (
                <span className="text-gray-500 text-xs">({cmd.aliases.join(', ')})</span>
              )}
            </div>
            <span className="text-gray-500 text-xs truncate max-w-[200px]">
              {cmd.description}
            </span>
          </button>
        ))}
      </div>
    );
  }
);

CommandSuggestions.displayName = 'CommandSuggestions';
