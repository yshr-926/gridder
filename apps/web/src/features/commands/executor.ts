/**
 * コマンド実行エンジン
 *
 * コマンドの登録、実行、管理を行うエンジンクラスを提供します。
 * 各コマンドを登録し、ユーザー入力に応じて適切なコマンドを実行します。
 */

import type {
  CommandDefinition,
  CommandContext,
  CommandResult,
  ParsedCommand,
  GridCoordinate,
} from './types';
import { parseCommand } from './parser';

/**
 * コマンド実行エンジン
 *
 * コマンドの登録と実行を管理するクラスです。
 * コマンドレジストリ、実行コンテキスト、履歴を保持します。
 *
 * @example
 * ```typescript
 * const executor = new CommandExecutor(context);
 * executor.registerCommand(lineCommand);
 * executor.registerCommand(rectCommand);
 *
 * const result = executor.execute('LINE 0,0 10,10');
 * if (result.success) {
 *   console.log(result.message);
 * }
 * ```
 */
export class CommandExecutor {
  /** 登録されたコマンドのマップ（名前 -> 定義） */
  private commands: Map<string, CommandDefinition> = new Map();

  /** 実行コンテキスト */
  private context: CommandContext;

  /** 実行履歴 */
  private history: ParsedCommand[] = [];

  /** 現在のプロンプト（対話的コマンド用） */
  private currentPrompt: string | null = null;

  /**
   * CommandExecutorを作成する
   *
   * @param context - 実行コンテキスト
   */
  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * コマンドを登録する
   *
   * コマンド定義を登録します。別名がある場合はそれも登録されます。
   * 同名のコマンドが既に存在する場合は上書きされます。
   *
   * @param command - 登録するコマンド定義
   *
   * @example
   * ```typescript
   * executor.registerCommand({
   *   name: 'LINE',
   *   aliases: ['L'],
   *   description: '2点間に線を引く',
   *   syntax: 'LINE x1,y1 x2,y2',
   *   requiredArgs: 2,
   *   optionalArgs: 0,
   *   execute: (args, ctx) => { ... }
   * });
   * ```
   */
  registerCommand(command: CommandDefinition): void {
    this.commands.set(command.name.toUpperCase(), command);

    // 別名も登録
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias.toUpperCase(), command);
      }
    }
  }

  /**
   * 複数のコマンドを一括登録する
   *
   * @param commands - 登録するコマンド定義の配列
   */
  registerCommands(commands: CommandDefinition[]): void {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }

  /**
   * コマンドを実行する
   *
   * 入力文字列をパースし、対応するコマンドを実行します。
   *
   * @param input - ユーザー入力文字列
   * @returns コマンド実行結果
   *
   * @example
   * ```typescript
   * const result = executor.execute('RECT 0,0 10,10');
   * if (result.success) {
   *   console.log('成功:', result.message);
   * } else {
   *   console.error('失敗:', result.message);
   * }
   * ```
   */
  execute(input: string): CommandResult {
    const parsed = parseCommand(input);

    if (!parsed) {
      return {
        success: false,
        message: '無効なコマンド形式です',
      };
    }

    const command = this.commands.get(parsed.name);

    if (!command) {
      return {
        success: false,
        message: `不明なコマンド: ${parsed.name}。HELP と入力してコマンド一覧を表示できます。`,
      };
    }

    // 引数の数をチェック
    const totalArgs = command.requiredArgs + command.optionalArgs;
    if (parsed.args.length < command.requiredArgs) {
      return {
        success: false,
        message: `引数が不足しています。必要な引数: ${command.requiredArgs}個。使用法: ${command.syntax}`,
      };
    }
    if (parsed.args.length > totalArgs) {
      return {
        success: false,
        message: `引数が多すぎます。最大引数: ${totalArgs}個。使用法: ${command.syntax}`,
      };
    }

    // コマンド実行
    let result: CommandResult;
    try {
      result = command.execute(parsed.args, this.context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      result = {
        success: false,
        message: `コマンド実行中にエラーが発生しました: ${errorMessage}`,
      };
    }

    // 成功した場合は履歴に追加
    if (result.success) {
      this.history.push(parsed);
    }

    // コンテキスト更新
    if (result.stateUpdate) {
      this.updateContext(result.stateUpdate);
    }

    // プロンプト更新
    this.currentPrompt = result.prompt ?? null;

    return result;
  }

  /**
   * 利用可能なコマンド一覧を取得する
   *
   * 登録されているすべてのコマンド定義を取得します。
   * 別名は除外され、一意のコマンドのみが返されます。
   *
   * @returns コマンド定義の配列
   */
  getAvailableCommands(): CommandDefinition[] {
    const commands: CommandDefinition[] = [];
    const seen = new Set<string>();

    for (const [, command] of this.commands) {
      if (!seen.has(command.name)) {
        commands.push(command);
        seen.add(command.name);
      }
    }

    return commands;
  }

  /**
   * 特定のコマンドを取得する
   *
   * @param name - コマンド名または別名
   * @returns コマンド定義、または見つからない場合はundefined
   */
  getCommand(name: string): CommandDefinition | undefined {
    return this.commands.get(name.toUpperCase());
  }

  /**
   * コマンドが存在するかチェックする
   *
   * @param name - コマンド名または別名
   * @returns コマンドが存在する場合はtrue
   */
  hasCommand(name: string): boolean {
    return this.commands.has(name.toUpperCase());
  }

  /**
   * コマンド履歴を取得する
   *
   * @returns パース済みコマンドの配列（コピー）
   */
  getHistory(): ParsedCommand[] {
    return [...this.history];
  }

  /**
   * 履歴をクリアする
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 現在のプロンプトを取得する
   *
   * 対話的コマンドで次の入力を待っている場合のプロンプト文字列を返します。
   *
   * @returns プロンプト文字列、またはnull
   */
  getCurrentPrompt(): string | null {
    return this.currentPrompt;
  }

  /**
   * プロンプトをクリアする
   */
  clearPrompt(): void {
    this.currentPrompt = null;
  }

  /**
   * コンテキストを取得する
   *
   * @returns 現在の実行コンテキスト
   */
  getContext(): CommandContext {
    return this.context;
  }

  /**
   * コンテキストを更新する
   *
   * @param updates - 更新するコンテキストのプロパティ
   */
  updateContext(updates: Partial<Pick<CommandContext, 'cursorPosition' | 'lastPoint'>>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * 最後のポイントを更新する
   *
   * コマンド実行後に最後に入力された座標を記録します。
   * 相対座標の基点として使用されます。
   *
   * @param point - 座標
   */
  setLastPoint(point: GridCoordinate | null): void {
    this.context = { ...this.context, lastPoint: point };
  }

  /**
   * カーソル位置を更新する
   *
   * @param position - カーソル位置
   */
  setCursorPosition(position: GridCoordinate | null): void {
    this.context = { ...this.context, cursorPosition: position };
  }
}

/**
 * コマンド実行エンジンのファクトリ関数
 *
 * 新しいCommandExecutorインスタンスを作成します。
 *
 * @param context - 実行コンテキスト
 * @returns CommandExecutorインスタンス
 */
export const createCommandExecutor = (context: CommandContext): CommandExecutor => {
  return new CommandExecutor(context);
};
