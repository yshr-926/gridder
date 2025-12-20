/**
 * コマンド履歴管理
 *
 * コマンドの実行履歴を管理し、履歴のナビゲーション機能を提供します。
 * 上下矢印キーでの履歴呼び出しをサポートします。
 */

import type { ParsedCommand } from './types';

/** 履歴の最大サイズ */
const MAX_HISTORY_SIZE = 100;

/**
 * コマンド履歴管理クラス
 *
 * コマンドの実行履歴を保持し、履歴のナビゲーション機能を提供します。
 * ターミナルのような上下矢印キーでの履歴呼び出しをサポートします。
 *
 * @example
 * ```typescript
 * const history = new CommandHistory();
 *
 * // 履歴に追加
 * history.add({ name: 'LINE', args: ['0,0', '10,10'], raw: 'LINE 0,0 10,10' });
 *
 * // 履歴をナビゲート
 * const prev = history.previous(); // 前のコマンドを取得
 * const next = history.next();     // 次のコマンドを取得
 * ```
 */
export class CommandHistory {
  /** 履歴配列 */
  private history: ParsedCommand[] = [];

  /** 現在のナビゲーション位置 */
  private currentIndex: number = -1;

  /** 一時保存された現在の入力（履歴ナビゲーション中に使用） */
  private pendingInput: string = '';

  /**
   * 履歴にコマンドを追加する
   *
   * 同じコマンドが連続して追加された場合は重複を避けます。
   * 最大サイズを超えた場合は古い履歴を削除します。
   *
   * @param command - 追加するパース済みコマンド
   */
  add(command: ParsedCommand): void {
    // 直前のコマンドと同じ場合は追加しない
    const lastCommand = this.history[this.history.length - 1];
    if (lastCommand && lastCommand.raw === command.raw) {
      return;
    }

    this.history.push(command);

    // 最大サイズを超えたら古いものを削除
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
    }

    // インデックスをリセット
    this.currentIndex = this.history.length;
    this.pendingInput = '';
  }

  /**
   * 前のコマンドを取得する（上矢印キー）
   *
   * 履歴を遡って前のコマンドを返します。
   * 履歴の先頭に達した場合は最初のコマンドを返し続けます。
   *
   * @returns 前のコマンド、または履歴が空の場合はnull
   */
  previous(): ParsedCommand | null {
    if (this.history.length === 0) {
      return null;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
    }

    return this.history[this.currentIndex] ?? null;
  }

  /**
   * 次のコマンドを取得する（下矢印キー）
   *
   * 履歴を進めて次のコマンドを返します。
   * 履歴の末尾を超えた場合はnullを返します（入力欄をクリア）。
   *
   * @returns 次のコマンド、または履歴の末尾の場合はnull
   */
  next(): ParsedCommand | null {
    if (this.history.length === 0) {
      return null;
    }

    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex] ?? null;
    }

    // 履歴の最後まで来たらインデックスを履歴の長さに設定
    if (this.currentIndex === this.history.length - 1) {
      this.currentIndex = this.history.length;
    }

    return null;
  }

  /**
   * 現在の入力を一時保存する
   *
   * 履歴ナビゲーションを開始する前に、現在の入力を保存します。
   * 履歴から戻った時に復元できます。
   *
   * @param input - 現在の入力文字列
   */
  savePendingInput(input: string): void {
    // 履歴の末尾にいる場合のみ保存
    if (this.currentIndex === this.history.length) {
      this.pendingInput = input;
    }
  }

  /**
   * 一時保存された入力を取得する
   *
   * @returns 一時保存された入力文字列
   */
  getPendingInput(): string {
    return this.pendingInput;
  }

  /**
   * ナビゲーションをリセットする
   *
   * ナビゲーション位置を履歴の末尾（最新の後）にリセットします。
   */
  resetNavigation(): void {
    this.currentIndex = this.history.length;
    this.pendingInput = '';
  }

  /**
   * 全履歴を取得する
   *
   * @returns パース済みコマンドの配列（コピー）
   */
  getAll(): ParsedCommand[] {
    return [...this.history];
  }

  /**
   * 履歴のサイズを取得する
   *
   * @returns 履歴に保存されているコマンドの数
   */
  size(): number {
    return this.history.length;
  }

  /**
   * 履歴が空かどうかを確認する
   *
   * @returns 履歴が空の場合はtrue
   */
  isEmpty(): boolean {
    return this.history.length === 0;
  }

  /**
   * 履歴をクリアする
   *
   * すべての履歴を削除し、ナビゲーション状態をリセットします。
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.pendingInput = '';
  }

  /**
   * 特定のインデックスの履歴を取得する
   *
   * @param index - 履歴のインデックス
   * @returns 指定されたインデックスのコマンド、または範囲外の場合はundefined
   */
  getAt(index: number): ParsedCommand | undefined {
    return this.history[index];
  }

  /**
   * 最新の履歴を取得する
   *
   * @returns 最新のコマンド、または履歴が空の場合はundefined
   */
  getLast(): ParsedCommand | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * パターンに一致する履歴を検索する
   *
   * @param pattern - 検索パターン（部分一致）
   * @returns マッチしたコマンドの配列
   */
  search(pattern: string): ParsedCommand[] {
    const lowerPattern = pattern.toLowerCase();
    return this.history.filter((cmd) =>
      cmd.raw.toLowerCase().includes(lowerPattern)
    );
  }

  /**
   * 履歴を配列としてエクスポートする
   *
   * LocalStorage等への保存用にraw文字列の配列を返します。
   *
   * @returns コマンド文字列の配列
   */
  export(): string[] {
    return this.history.map((cmd) => cmd.raw);
  }

  /**
   * 文字列配列から履歴をインポートする
   *
   * LocalStorage等から復元する際に使用します。
   * 既存の履歴はクリアされます。
   *
   * @param rawCommands - コマンド文字列の配列
   */
  import(rawCommands: string[]): void {
    this.clear();

    for (const raw of rawCommands) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      const name = parts[0].toUpperCase();
      const args = parts.slice(1);

      this.history.push({
        name,
        args,
        raw: trimmed,
      });
    }

    this.currentIndex = this.history.length;
  }
}

/**
 * 新しいCommandHistoryインスタンスを作成する
 *
 * @returns CommandHistoryインスタンス
 */
export const createCommandHistory = (): CommandHistory => {
  return new CommandHistory();
};
