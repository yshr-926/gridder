/**
 * UNDO コマンド
 *
 * 直前の操作を取り消すコマンドです。
 * 履歴ストアを使用してオブジェクトの状態を前の状態に戻します。
 */

import type { CommandDefinition, CommandResult } from '../types';

/**
 * UNDO コマンド定義
 *
 * 直前の操作を取り消します。
 * 履歴がない場合はエラーメッセージを返します。
 */
export const undoCommand: CommandDefinition = {
  name: 'UNDO',
  aliases: ['U'],
  description: '直前の操作を取り消し',
  syntax: 'UNDO',
  requiredArgs: 0,
  optionalArgs: 0,

  execute: (_args, context): CommandResult => {
    const { canUndo, undo } = context.historyStore.getState();
    const { objects, setObjects } = context.canvasStore.getState();

    if (!canUndo()) {
      return { success: false, message: '取り消す操作がありません' };
    }

    const previousState = undo(objects);

    if (!previousState) {
      return { success: false, message: '取り消す操作がありません' };
    }

    setObjects(previousState);

    return {
      success: true,
      message: '操作を取り消しました',
    };
  },
};
