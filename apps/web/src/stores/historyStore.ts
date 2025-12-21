import { create } from 'zustand';
import type { GridObject } from '@/types';

/**
 * 履歴スナップショット
 */
type HistorySnapshot = GridObject[];

/**
 * デフォルトの最大履歴サイズ
 */
const DEFAULT_MAX_HISTORY_SIZE = 50;

/**
 * 履歴管理ストアの状態
 */
interface HistoryState {
  /** 過去の状態スタック */
  past: HistorySnapshot[];
  /** 未来の状態スタック（Redo用） */
  future: HistorySnapshot[];
  /** 最大履歴サイズ */
  maxHistorySize: number;

  /**
   * 新しい状態を履歴に追加
   * 新しい状態を追加すると、future はクリアされる
   */
  pushState: (state: HistorySnapshot) => void;

  /**
   * Undo: 1つ前の状態に戻る
   * @returns 戻った先の状態、または履歴がない場合は null
   */
  undo: (currentState: HistorySnapshot) => HistorySnapshot | null;

  /**
   * Redo: 1つ先の状態に進む
   * @returns 進んだ先の状態、または履歴がない場合は null
   */
  redo: (currentState: HistorySnapshot) => HistorySnapshot | null;

  /**
   * 履歴をクリア
   */
  clearHistory: () => void;

  /**
   * Undo が可能かどうか
   */
  canUndo: () => boolean;

  /**
   * Redo が可能かどうか
   */
  canRedo: () => boolean;

  /**
   * 最大履歴サイズを設定
   */
  setMaxHistorySize: (size: number) => void;
}

/**
 * 履歴管理ストア
 *
 * Undo/Redo機能を提供するZustandストア。
 * オブジェクトの状態履歴をスタックで管理する。
 *
 * 履歴スタック構造:
 * ```
 * past: [状態1, 状態2, 状態3]  <- 過去
 * 現在の状態: 状態4
 * future: [状態5, 状態6]       <- 未来（Redo用）
 * ```
 *
 * - Undo: past から状態を取り出し、現在を future に追加
 * - Redo: future から状態を取り出し、現在を past に追加
 * - 新しい操作: 現在を past に追加、future をクリア
 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxHistorySize: DEFAULT_MAX_HISTORY_SIZE,

  pushState: (state) => {
    const { past, maxHistorySize } = get();

    // 新しい状態を追加、futureをクリア
    const newPast = [...past, state];

    // 最大サイズを超えた場合、古い履歴を削除
    if (newPast.length > maxHistorySize) {
      newPast.shift();
    }

    set({
      past: newPast,
      future: [], // 新しい操作があった場合、Redo履歴はクリア
    });
  },

  undo: (currentState) => {
    const { past, future } = get();

    if (past.length === 0) {
      return null;
    }

    // 最新の過去状態を取り出す
    const newPast = [...past];
    const previousState = newPast.pop();

    if (!previousState) {
      return null;
    }

    // 現在の状態を未来スタックに追加
    set({
      past: newPast,
      future: [...future, currentState],
    });

    return previousState;
  },

  redo: (currentState) => {
    const { past, future } = get();

    if (future.length === 0) {
      return null;
    }

    // 最新の未来状態を取り出す
    const newFuture = [...future];
    const nextState = newFuture.pop();

    if (!nextState) {
      return null;
    }

    // 現在の状態を過去スタックに追加
    set({
      past: [...past, currentState],
      future: newFuture,
    });

    return nextState;
  },

  clearHistory: () => {
    set({
      past: [],
      future: [],
    });
  },

  canUndo: () => {
    return get().past.length > 0;
  },

  canRedo: () => {
    return get().future.length > 0;
  },

  setMaxHistorySize: (size) => {
    const { past } = get();

    // 現在の履歴が新しいサイズを超えている場合、古い履歴を削除
    const newPast = size < past.length ? past.slice(-size) : past;

    set({
      maxHistorySize: size,
      past: newPast,
    });
  },
}));
