/**
 * HELP コマンド
 *
 * コマンド一覧を表示するコマンドです。
 * 引数として特定のコマンド名を指定すると、そのコマンドの詳細を表示します。
 */

import type { CommandDefinition, CommandResult } from '../types';

/**
 * HELP コマンド定義
 *
 * 利用可能なコマンド一覧を表示します。
 * 引数でコマンド名を指定すると、そのコマンドの詳細ヘルプを表示します。
 */
export const helpCommand: CommandDefinition = {
  name: 'HELP',
  aliases: ['H', '?'],
  description: 'コマンド一覧を表示',
  syntax: 'HELP [command]',
  requiredArgs: 0,
  optionalArgs: 1,

  execute: (args): CommandResult => {
    // 特定のコマンドのヘルプ
    if (args.length > 0) {
      const commandName = String(args[0]).toUpperCase();

      // コマンドごとの詳細ヘルプ
      const commandHelp: Record<string, string> = {
        LINE: `
LINE コマンド

2点間に線を引きます。ブレゼンハムのアルゴリズムを使用して効率的に描画します。

構文:
  LINE x1,y1 x2,y2    - 始点と終点を指定して線を引く
  LINE                - 対話モード（始点と終点を順に入力）
  LINE x,y            - 始点のみ指定し、終点を後で入力

別名: L

例:
  LINE 0,0 10,10      - (0,0)から(10,10)への線
  LINE 5,5 @5,5       - (5,5)から相対座標(5,5)先への線
        `.trim(),

        RECT: `
RECT コマンド

2つの角座標を指定して矩形を作成します。

構文:
  RECT x1,y1 x2,y2           - 塗りつぶし矩形を作成
  RECT x1,y1 x2,y2 filled    - 塗りつぶし矩形を作成（デフォルト）
  RECT x1,y1 x2,y2 outline   - 輪郭のみの矩形を作成

別名: R, RECTANGLE

例:
  RECT 0,0 5,5               - 5x5 の塗りつぶし矩形
  RECT 0,0 10,5 outline      - 輪郭のみの矩形
        `.trim(),

        FILL: `
FILL コマンド

指定位置から空き領域を塗りつぶします。Flood Fillアルゴリズムを使用します。

構文:
  FILL x,y    - 指定位置から塗りつぶし開始

別名: F

注意:
  - 最大100グリッド距離まで対応
  - 最大1000セルまで一度に塗りつぶし可能
  - 既に占有されている位置から開始するとエラー

例:
  FILL 10,10  - (10,10)から塗りつぶし
        `.trim(),

        UNDO: `
UNDO コマンド

直前の操作を取り消します。

構文:
  UNDO    - 直前の操作を取り消し

別名: U

注意:
  - 履歴がない場合はエラーメッセージが表示されます
        `.trim(),

        HELP: `
HELP コマンド

利用可能なコマンド一覧またはコマンドの詳細ヘルプを表示します。

構文:
  HELP              - コマンド一覧を表示
  HELP <command>    - 指定コマンドの詳細ヘルプを表示

別名: H, ?

例:
  HELP        - 全コマンドの一覧
  HELP LINE   - LINE コマンドの詳細
        `.trim(),
      };

      const help = commandHelp[commandName];
      if (help) {
        return {
          success: true,
          message: help,
        };
      }

      // 別名からメインコマンド名を取得
      const aliasMap: Record<string, string> = {
        L: 'LINE',
        R: 'RECT',
        RECTANGLE: 'RECT',
        F: 'FILL',
        U: 'UNDO',
        H: 'HELP',
        '?': 'HELP',
      };

      const mainCommand = aliasMap[commandName];
      if (mainCommand && commandHelp[mainCommand]) {
        return {
          success: true,
          message: commandHelp[mainCommand],
        };
      }

      return {
        success: false,
        message: `不明なコマンド: ${commandName}。HELP と入力してコマンド一覧を表示できます。`,
      };
    }

    // 全コマンドの一覧
    const helpText = `
利用可能なコマンド:

LINE (L)      - 2点間に線を引く
               使用法: LINE x1,y1 x2,y2

RECT (R)      - 矩形を作成
               使用法: RECT x1,y1 x2,y2 [filled|outline]

FILL (F)      - 指定位置から塗りつぶし
               使用法: FILL x,y

UNDO (U)      - 直前の操作を取り消し
               使用法: UNDO

HELP (H, ?)   - このヘルプを表示
               使用法: HELP [command]

座標の指定方法:
  絶対座標: x,y (例: 5,10)
  相対座標: @x,y (例: @2,3) - 直前の座標から相対的に指定
    `.trim();

    return {
      success: true,
      message: helpText,
    };
  },
};
