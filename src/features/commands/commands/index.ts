/**
 * コマンド登録
 *
 * 全ての基本コマンドをエクスポートし、一括登録用の配列を提供します。
 */

import type { CommandDefinition } from '../types';
import { lineCommand, drawLine } from './line';
import { rectCommand, createRectCells } from './rect';
import { fillCommand, floodFill } from './fill';
import { undoCommand } from './undo';
import { helpCommand } from './help';

/**
 * 全コマンドを配列で提供
 *
 * CommandExecutorに一括登録するためのコマンド定義配列です。
 */
export const allCommands: CommandDefinition[] = [
  lineCommand,
  rectCommand,
  fillCommand,
  undoCommand,
  helpCommand,
];

// 個別コマンドエクスポート
export { lineCommand, rectCommand, fillCommand, undoCommand, helpCommand };

// ユーティリティ関数エクスポート（他のモジュールでも使用可能）
export { drawLine, createRectCells, floodFill };
