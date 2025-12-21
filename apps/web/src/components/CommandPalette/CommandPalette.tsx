/**
 * コマンドパレットコンポーネント
 *
 * ターミナルライクなコマンド入力UIを提供するコンポーネントです。
 * コマンド履歴表示、オートコンプリート、キーボード操作をサポートします。
 */

import { useState, useCallback, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { CommandInput } from './CommandInput';
import { CommandHistory, type OutputLine } from './CommandHistory';
import { CommandSuggestions } from './CommandSuggestions';
import { useCommandExecutor, useSuggestionKeyboard } from '@/hooks';
import { createOutputLine } from '@/utils/outputLine';

/**
 * CommandPalette コンポーネントの Props
 */
interface CommandPaletteProps {
  /** パレットが開いているかどうか */
  isOpen: boolean;
  /** パレットを閉じる際のコールバック */
  onClose: () => void;
}

/**
 * コマンド履歴の最大行数
 */
const MAX_OUTPUT_LINES = 200;

/**
 * コマンドパレットコンポーネント
 *
 * ターミナルライクなインターフェースでコマンドを入力・実行できるUIを提供します。
 * 画面下部に固定表示され、コマンド履歴とオートコンプリート機能を備えています。
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <CommandPalette
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistoryRef = useRef<string[]>([]);

  const { execute, availableCommands, currentPrompt } = useCommandExecutor();

  /**
   * 入力値に一致するサジェストをフィルタリング
   */
  const suggestions = useMemo(() => {
    if (!input.trim()) return [];

    const inputUpper = input.toUpperCase();

    return availableCommands.filter((cmd) => {
      // コマンド名で前方一致
      if (cmd.name.startsWith(inputUpper)) return true;
      // 別名で前方一致
      if (cmd.aliases?.some((alias) => alias.toUpperCase().startsWith(inputUpper))) {
        return true;
      }
      return false;
    });
  }, [input, availableCommands]);

  /**
   * パレットが開いたらフォーカス
   */
  useEffect(() => {
    if (isOpen) {
      // 少し遅延させてフォーカスを確実に当てる
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  /**
   * 入力値変更ハンドラ（サジェストインデックスをリセット）
   */
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setSuggestionIndex(-1);
  }, []);

  /**
   * 出力を追加（行数制限付き）
   */
  const addOutput = useCallback((lines: OutputLine[]) => {
    setOutput((prev) => {
      const newOutput = [...prev, ...lines];
      // 最大行数を超えた場合は古い行を削除
      if (newOutput.length > MAX_OUTPUT_LINES) {
        return newOutput.slice(-MAX_OUTPUT_LINES);
      }
      return newOutput;
    });
  }, []);

  /**
   * コマンド実行
   */
  const handleSubmit = useCallback(
    (command: string) => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) return;

      // コマンド履歴に追加
      commandHistoryRef.current = [...commandHistoryRef.current, trimmedCommand];
      setHistoryIndex(-1);

      // コマンド入力を出力に追加
      addOutput([createOutputLine(`> ${trimmedCommand}`, 'command')]);

      // コマンド実行
      const result = execute(trimmedCommand);

      // 結果を出力に追加
      if (result.message) {
        addOutput([
          createOutputLine(result.message, result.success ? 'success' : 'error'),
        ]);
      } else {
        addOutput([
          createOutputLine(result.success ? 'OK' : 'Error', result.success ? 'success' : 'error'),
        ]);
      }

      // プロンプトがある場合は追加
      if (result.prompt) {
        addOutput([createOutputLine(result.prompt, 'prompt')]);
      }

      // 入力をクリア
      setInput('');
    },
    [execute, addOutput]
  );

  /**
   * サジェスト選択
   */
  const handleSuggestionSelect = useCallback((command: string) => {
    setInput(command + ' ');
    setSuggestionIndex(-1);
    inputRef.current?.focus();
  }, []);

  /**
   * サジェストキーボード操作
   */
  const handleSuggestionKeyboard = useSuggestionKeyboard(
    suggestions,
    suggestionIndex,
    setSuggestionIndex,
    handleSuggestionSelect
  );

  /**
   * キーダウンハンドラ
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // サジェストのキーボード操作を優先
      if (suggestions.length > 0 && handleSuggestionKeyboard(e)) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;

        case 'Enter':
          e.preventDefault();
          // サジェストが選択されている場合はそれを選択
          if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
            handleSuggestionSelect(suggestions[suggestionIndex].name);
          } else {
            handleSubmit(input);
          }
          break;

        case 'ArrowUp':
          // サジェストがない場合は履歴を遡る
          if (suggestions.length === 0) {
            e.preventDefault();
            const history = commandHistoryRef.current;
            if (history.length > 0) {
              const newIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
              setHistoryIndex(newIndex);
              setInput(history[newIndex]);
            }
          }
          break;

        case 'ArrowDown':
          // サジェストがない場合は履歴を進む
          if (suggestions.length === 0) {
            e.preventDefault();
            const history = commandHistoryRef.current;
            if (historyIndex >= 0) {
              const newIndex = historyIndex + 1;
              if (newIndex >= history.length) {
                setHistoryIndex(-1);
                setInput('');
              } else {
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
              }
            }
          }
          break;

        case 'l':
          // Ctrl+L でクリア
          if (e.ctrlKey) {
            e.preventDefault();
            setOutput([]);
          }
          break;
      }
    },
    [
      input,
      suggestions,
      suggestionIndex,
      historyIndex,
      onClose,
      handleSubmit,
      handleSuggestionSelect,
      handleSuggestionKeyboard,
    ]
  );

  // 表示しない場合は null を返す
  if (!isOpen) return null;

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0
        bg-gray-900 text-gray-100
        border-t border-gray-700
        shadow-lg
        z-50
        flex flex-col
      "
      role="dialog"
      aria-modal="true"
      aria-label="コマンドパレット"
    >
      {/* 出力エリア */}
      <CommandHistory output={output} className="h-48" />

      {/* 入力エリア（相対配置でサジェストを配置） */}
      <div className="relative">
        {/* サジェスト */}
        {input && suggestions.length > 0 && (
          <CommandSuggestions
            input={input}
            commands={suggestions}
            onSelect={handleSuggestionSelect}
            selectedIndex={suggestionIndex}
            onSelectedIndexChange={setSuggestionIndex}
          />
        )}

        {/* 入力フィールド */}
        <div className="flex items-center border-t border-gray-700">
          <CommandInput
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            prompt={currentPrompt ?? '>'}
            placeholder="コマンドを入力... (HELP で一覧表示)"
          />
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
            aria-label="コマンドパレットを閉じる"
          >
            ESC
          </button>
        </div>
      </div>

      {/* ヘルプテキスト */}
      <div className="px-4 py-1 text-xs text-gray-600 border-t border-gray-800 flex justify-between">
        <span>Enter: 実行 | Tab: 補完 | Esc: 閉じる | Ctrl+L: クリア</span>
        <span>Ctrl+Shift+P: 開閉</span>
      </div>
    </div>
  );
};
