/**
 * コマンドシステム
 *
 * CADライクなコマンド入力システムの基盤を提供します。
 * コマンドのパース、実行、履歴管理機能を含みます。
 *
 * @module features/commands
 */

// 型定義
export type {
  CommandArg,
  CommandDefinition,
  CommandContext,
  CommandResult,
  ParsedCommand,
  GridCoordinate,
  CommandHistoryEntry,
} from './types';

// パーサー
export {
  parseCommand,
  parseCoordinate,
  parseRelativeCoordinate,
  resolveCoordinate,
  isCoordinateArg,
  isRelativeCoordinate,
} from './parser';

// 実行エンジン
export { CommandExecutor, createCommandExecutor } from './executor';

// 履歴管理
export { CommandHistory, createCommandHistory } from './history';
