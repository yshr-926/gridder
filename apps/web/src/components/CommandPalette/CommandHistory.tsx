/**
 * コマンド履歴表示コンポーネント
 *
 * コマンドの実行履歴と結果を表示するコンポーネントです。
 * ターミナルライクな出力表示を提供します。
 */

import { memo, useEffect, useRef } from 'react';
import type { OutputLine, OutputLineType } from '@/utils/outputLine';

// 型を再エクスポート
export type { OutputLine, OutputLineType };

/**
 * CommandHistory コンポーネントの Props
 */
interface CommandHistoryProps {
  /** 出力行の配列 */
  output: OutputLine[];
  /** 追加のCSSクラス */
  className?: string;
  /** 自動スクロールを有効にするか */
  autoScroll?: boolean;
}

/**
 * 出力行の種類に応じたCSSクラスを取得
 */
const getLineColorClass = (type: OutputLineType): string => {
  switch (type) {
    case 'command':
      return 'text-blue-400';
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'info':
      return 'text-gray-300';
    case 'prompt':
      return 'text-yellow-400';
    default:
      return 'text-gray-300';
  }
};

/**
 * コマンド履歴表示コンポーネント
 *
 * コマンドの実行履歴と結果をターミナルライクなスタイルで表示します。
 * 自動スクロール機能により、新しい出力が追加されると自動的にスクロールします。
 *
 * @example
 * ```tsx
 * import { createOutputLine } from '@/utils/outputLine';
 *
 * const [output, setOutput] = useState<OutputLine[]>([]);
 *
 * const addOutput = (text: string, type: OutputLineType) => {
 *   setOutput(prev => [...prev, createOutputLine(text, type)]);
 * };
 *
 * <CommandHistory output={output} autoScroll />
 * ```
 */
export const CommandHistory = memo(
  ({ output, className = '', autoScroll = true }: CommandHistoryProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // 新しい出力が追加されたら自動スクロール
    useEffect(() => {
      if (autoScroll && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [output, autoScroll]);

    return (
      <div
        ref={containerRef}
        className={`overflow-y-auto p-4 font-mono text-sm ${className}`}
        role="log"
        aria-label="コマンド出力履歴"
        aria-live="polite"
      >
        {output.length === 0 ? (
          <div className="text-gray-500">
            コマンドを入力してください。HELP で使い方を確認できます。
          </div>
        ) : (
          output.map((line, index) => (
            <div
              key={`${line.timestamp}-${index}`}
              className={`${getLineColorClass(line.type)} whitespace-pre-wrap break-words`}
            >
              {line.text}
            </div>
          ))
        )}
      </div>
    );
  }
);

CommandHistory.displayName = 'CommandHistory';
