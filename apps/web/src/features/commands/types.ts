/**
 * コマンドシステムの型定義
 *
 * CADライクなコマンド入力システムで使用する型を定義します。
 * コマンドのパース、実行、履歴管理に必要な型を提供します。
 */

import type { useCanvasStore } from '../../stores/canvasStore';
import type { useGridSettingsStore } from '../../stores/gridSettingsStore';
import type { useHistoryStore } from '../../stores/historyStore';

/**
 * コマンド引数の型
 *
 * コマンドの引数として受け取る値の型です。
 * 文字列、数値、ブール値のいずれかになります。
 */
export type CommandArg = string | number | boolean;

/**
 * コマンド定義
 *
 * 各コマンドの構造を定義するインターフェースです。
 * コマンドの登録時に使用します。
 */
export interface CommandDefinition {
  /** コマンド名（大文字） */
  name: string;
  /** 別名（省略可能） */
  aliases?: string[];
  /** コマンドの説明 */
  description: string;
  /** 構文の説明（使用例） */
  syntax: string;
  /** 必須引数の数 */
  requiredArgs: number;
  /** オプション引数の数 */
  optionalArgs: number;
  /** 実行関数 */
  execute: (args: CommandArg[], context: CommandContext) => CommandResult;
}

/**
 * コマンド実行コンテキスト
 *
 * コマンド実行時に渡されるコンテキスト情報です。
 * 各ストアへのアクセスや状態情報を含みます。
 */
export interface CommandContext {
  /** キャンバスストアへのアクセス */
  canvasStore: typeof useCanvasStore;
  /** グリッド設定ストアへのアクセス */
  gridSettingsStore: typeof useGridSettingsStore;
  /** 履歴ストアへのアクセス */
  historyStore: typeof useHistoryStore;
  /** 現在のカーソル位置（グリッド座標） */
  cursorPosition: { x: number; y: number } | null;
  /** 最後に入力した座標（相対座標の基点） */
  lastPoint: { x: number; y: number } | null;
  /** 次のオブジェクト色を取得する関数 */
  getNextObjectColor: () => string;
}

/**
 * コマンド実行結果
 *
 * コマンド実行後に返される結果オブジェクトです。
 * 成功/失敗状態とメッセージ、追加情報を含みます。
 */
export interface CommandResult {
  /** 成功したかどうか */
  success: boolean;
  /** ユーザーへのメッセージ */
  message?: string;
  /** 次の入力待ちプロンプト（対話的コマンド用） */
  prompt?: string;
  /** 作成されたオブジェクトのID */
  createdObjectId?: string;
  /** 実行後の状態更新 */
  stateUpdate?: Partial<Pick<CommandContext, 'cursorPosition' | 'lastPoint'>>;
}

/**
 * パース済みコマンド
 *
 * 文字列からパースされたコマンドの構造化データです。
 */
export interface ParsedCommand {
  /** コマンド名（大文字） */
  name: string;
  /** パース済みの引数配列 */
  args: CommandArg[];
  /** 元の入力文字列 */
  raw: string;
}

/**
 * グリッド座標
 *
 * グリッド上の座標を表す型です。
 */
export interface GridCoordinate {
  /** X座標（グリッド単位） */
  x: number;
  /** Y座標（グリッド単位） */
  y: number;
}

/**
 * コマンド履歴エントリ
 *
 * 履歴に保存されるコマンド情報です。
 */
export interface CommandHistoryEntry {
  /** パース済みコマンド */
  command: ParsedCommand;
  /** 実行結果 */
  result: CommandResult;
  /** 実行日時 */
  timestamp: number;
}
