/**
 * コマンド入力フィールドコンポーネント
 *
 * コマンドパレットで使用する入力フィールドです。
 * ターミナルライクなプロンプト表示とテキスト入力を提供します。
 */

import { forwardRef, type KeyboardEvent } from 'react';

/**
 * CommandInput コンポーネントの Props
 */
interface CommandInputProps {
  /** 現在の入力値 */
  value: string;
  /** 入力値変更時のコールバック */
  onChange: (value: string) => void;
  /** キーダウン時のコールバック */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** プレースホルダーテキスト */
  placeholder?: string;
  /** プロンプト文字列 */
  prompt?: string;
  /** 入力フィールドが無効かどうか */
  disabled?: boolean;
}

/**
 * コマンド入力フィールドコンポーネント
 *
 * ターミナルライクなプロンプト付きの入力フィールドを提供します。
 * forwardRef を使用してフォーカス制御を可能にしています。
 *
 * @example
 * ```tsx
 * <CommandInput
 *   ref={inputRef}
 *   value={input}
 *   onChange={setInput}
 *   onKeyDown={handleKeyDown}
 *   prompt=">"
 *   placeholder="コマンドを入力..."
 * />
 * ```
 */
export const CommandInput = forwardRef<HTMLInputElement, CommandInputProps>(
  ({ value, onChange, onKeyDown, placeholder, prompt = '>', disabled = false }, ref) => {
    return (
      <div className="flex items-center px-4 py-2 border-t border-gray-700">
        <span className="text-green-400 mr-2 font-mono select-none">{prompt}</span>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className="
            flex-1 bg-transparent
            text-gray-100 font-mono text-sm
            outline-none
            placeholder:text-gray-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    );
  }
);

CommandInput.displayName = 'CommandInput';
