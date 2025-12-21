/**
 * コマンドパーサー
 *
 * ユーザー入力文字列をパースして構造化されたコマンドデータに変換します。
 * 座標形式、相対座標、各種引数型のパースをサポートします。
 */

import type { ParsedCommand, CommandArg, GridCoordinate } from './types';

/**
 * コマンド文字列をパースする
 *
 * 入力文字列を解析し、コマンド名と引数に分解します。
 * コマンド名は自動的に大文字に変換されます。
 *
 * @param input - ユーザーが入力したコマンド文字列
 * @returns パース済みコマンドオブジェクト、または空入力の場合はnull
 *
 * @example
 * ```typescript
 * const result = parseCommand('RECT 0,0 10,10');
 * // { name: 'RECT', args: ['0,0', '10,10'], raw: 'RECT 0,0 10,10' }
 * ```
 */
export const parseCommand = (input: string): ParsedCommand | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const name = parts[0].toUpperCase();
  const args = parts.slice(1).map(parseArg);

  return {
    name,
    args,
    raw: trimmed,
  };
};

/**
 * 個別の引数をパースする
 *
 * 引数文字列を適切な型（数値、ブール値、文字列）に変換します。
 *
 * @param arg - 引数文字列
 * @returns パース済みの引数値
 *
 * @example
 * ```typescript
 * parseArg('42');        // 42 (number)
 * parseArg('true');      // true (boolean)
 * parseArg('5,10');      // '5,10' (string, coordinate)
 * parseArg('text');      // 'text' (string)
 * ```
 */
const parseArg = (arg: string): CommandArg => {
  // 数値チェック（座標形式を除く）
  if (!arg.includes(',') && !arg.startsWith('@')) {
    const num = parseFloat(arg);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  // ブールチェック
  const lowerArg = arg.toLowerCase();
  if (lowerArg === 'true') {
    return true;
  }
  if (lowerArg === 'false') {
    return false;
  }

  // 座標形式 "x,y" や相対座標 "@x,y" はそのまま文字列として返す
  // コマンド側で適切に処理する
  return arg;
};

/**
 * 座標文字列をパースする
 *
 * "x,y" 形式の文字列をGridCoordinateオブジェクトに変換します。
 *
 * @param arg - コマンド引数
 * @returns GridCoordinateオブジェクト、またはパース失敗時はnull
 *
 * @example
 * ```typescript
 * parseCoordinate('5,10');   // { x: 5, y: 10 }
 * parseCoordinate('abc');    // null
 * parseCoordinate(42);       // null
 * ```
 */
export const parseCoordinate = (arg: CommandArg): GridCoordinate | null => {
  if (typeof arg !== 'string') {
    return null;
  }

  // 相対座標の場合はここでは処理しない
  if (arg.startsWith('@')) {
    return null;
  }

  if (!arg.includes(',')) {
    return null;
  }

  const parts = arg.split(',');
  if (parts.length !== 2) {
    return null;
  }

  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);

  if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
    return null;
  }

  return { x, y };
};

/**
 * 相対座標をパースする
 *
 * "@x,y" 形式の相対座標を基点からの絶対座標に変換します。
 *
 * @param arg - コマンド引数（"@x,y" 形式）
 * @param basePoint - 基点となる座標
 * @returns 計算された絶対座標、またはパース失敗時はnull
 *
 * @example
 * ```typescript
 * parseRelativeCoordinate('@2,3', { x: 5, y: 10 });
 * // { x: 7, y: 13 }
 * ```
 */
export const parseRelativeCoordinate = (
  arg: CommandArg,
  basePoint: GridCoordinate
): GridCoordinate | null => {
  if (typeof arg !== 'string' || !arg.startsWith('@')) {
    return null;
  }

  const coordPart = arg.substring(1);
  if (!coordPart.includes(',')) {
    return null;
  }

  const parts = coordPart.split(',');
  if (parts.length !== 2) {
    return null;
  }

  const dx = parseFloat(parts[0]);
  const dy = parseFloat(parts[1]);

  if (isNaN(dx) || isNaN(dy) || !isFinite(dx) || !isFinite(dy)) {
    return null;
  }

  return {
    x: basePoint.x + dx,
    y: basePoint.y + dy,
  };
};

/**
 * 絶対座標または相対座標をパースする
 *
 * 引数が相対座標（@x,y）の場合は基点から計算し、
 * 絶対座標（x,y）の場合はそのまま返します。
 *
 * @param arg - コマンド引数
 * @param basePoint - 相対座標の基点（nullの場合、相対座標は失敗）
 * @returns GridCoordinateオブジェクト、またはパース失敗時はnull
 *
 * @example
 * ```typescript
 * resolveCoordinate('5,10', null);          // { x: 5, y: 10 }
 * resolveCoordinate('@2,3', { x: 5, y: 10 }); // { x: 7, y: 13 }
 * resolveCoordinate('@2,3', null);          // null (基点がない)
 * ```
 */
export const resolveCoordinate = (
  arg: CommandArg,
  basePoint: GridCoordinate | null
): GridCoordinate | null => {
  if (typeof arg !== 'string') {
    return null;
  }

  // 相対座標の場合
  if (arg.startsWith('@')) {
    if (!basePoint) {
      return null;
    }
    return parseRelativeCoordinate(arg, basePoint);
  }

  // 絶対座標の場合
  return parseCoordinate(arg);
};

/**
 * コマンド引数が座標形式かどうかを判定する
 *
 * @param arg - コマンド引数
 * @returns 座標形式（絶対または相対）の場合はtrue
 *
 * @example
 * ```typescript
 * isCoordinateArg('5,10');   // true
 * isCoordinateArg('@2,3');   // true
 * isCoordinateArg('abc');    // false
 * isCoordinateArg(42);       // false
 * ```
 */
export const isCoordinateArg = (arg: CommandArg): boolean => {
  if (typeof arg !== 'string') {
    return false;
  }

  // 相対座標
  if (arg.startsWith('@')) {
    const coordPart = arg.substring(1);
    return coordPart.includes(',');
  }

  // 絶対座標
  return arg.includes(',');
};

/**
 * 引数が相対座標かどうかを判定する
 *
 * @param arg - コマンド引数
 * @returns 相対座標形式の場合はtrue
 *
 * @example
 * ```typescript
 * isRelativeCoordinate('@2,3');  // true
 * isRelativeCoordinate('5,10');  // false
 * isRelativeCoordinate('abc');   // false
 * ```
 */
export const isRelativeCoordinate = (arg: CommandArg): boolean => {
  return typeof arg === 'string' && arg.startsWith('@');
};
