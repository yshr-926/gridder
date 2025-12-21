/**
 * コマンド出力行のユーティリティ
 *
 * コマンドパレットの出力行を作成するためのヘルパー関数を提供します。
 */

/**
 * 出力行の種類
 */
export type OutputLineType = 'command' | 'success' | 'error' | 'info' | 'prompt';

/**
 * 出力行
 */
export interface OutputLine {
  /** 出力内容 */
  text: string;
  /** 出力の種類 */
  type: OutputLineType;
  /** タイムスタンプ */
  timestamp: number;
}

/**
 * 出力行を作成するヘルパー関数
 */
export const createOutputLine = (
  text: string,
  type: OutputLineType = 'info'
): OutputLine => ({
  text,
  type,
  timestamp: Date.now(),
});
