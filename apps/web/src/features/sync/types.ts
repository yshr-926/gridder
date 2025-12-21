/**
 * 同期機能の型定義
 *
 * Yjs共有データとZustandストア間の同期ロジックを管理するモジュールの型定義。
 * 同期状態、イベント、設定の型を定義し、型安全な同期機能の基盤を構築する。
 */

import type { GridObject } from '@/types';
import type { Map as YMap } from 'yjs';

/**
 * 同期状態
 *
 * 同期マネージャーの現在の状態を表す。
 * - idle: 同期待機中（変更なし）
 * - syncing: 同期処理中
 * - error: エラー発生
 */
export type SyncState = 'idle' | 'syncing' | 'error';

/**
 * 同期イベントのアクション種別
 *
 * オブジェクトに対する操作の種類を表す。
 * - add: オブジェクトの追加
 * - update: オブジェクトの更新
 * - delete: オブジェクトの削除
 */
export type SyncAction = 'add' | 'update' | 'delete';

/**
 * 同期イベントのオリジン（発生元）
 *
 * イベントがどこで発生したかを表す。
 * - local: 自分のブラウザでの操作
 * - remote: 他のユーザーからの同期
 */
export type SyncEventOrigin = 'local' | 'remote';

/**
 * 同期イベント
 *
 * オブジェクトの変更を表すイベント。
 * トレーサビリティのため、一意のIDとタイムスタンプを持つ。
 */
export interface SyncEvent {
  /** イベントの一意識別子 */
  id: string;
  /** イベントのアクション種別 */
  action: SyncAction;
  /** 対象オブジェクトのID */
  objectId: string;
  /** オブジェクトデータ（deleteの場合はundefined） */
  object?: GridObject;
  /** イベント発生時刻（Unixタイムスタンプ、ミリ秒） */
  timestamp: number;
  /** イベントの発生元 */
  origin: SyncEventOrigin;
}

/**
 * 同期マネージャーの状態
 *
 * 同期マネージャーの現在の状態を表す。
 * Yjs Y.Mapへの参照と、同期状態に関するメタデータを含む。
 */
export interface SyncManagerState {
  /** 現在の同期状態 */
  state: SyncState;
  /** Yjs Y.Map<GridObject> への参照（未接続時はnull） */
  yObjects: YMap<GridObject> | null;
  /** 最後の同期完了時刻（Unixタイムスタンプ、ミリ秒。未同期の場合はnull） */
  lastSyncAt: number | null;
  /** 保留中のローカル変更数 */
  pendingChanges: number;
  /** エラーメッセージ（エラー発生時のみ） */
  error: string | null;
}

/**
 * 同期マネージャーの初期状態
 */
export const INITIAL_SYNC_MANAGER_STATE: SyncManagerState = {
  state: 'idle',
  yObjects: null,
  lastSyncAt: null,
  pendingChanges: 0,
  error: null,
};

/**
 * 同期マネージャーの設定
 *
 * 同期動作に関する設定値。
 */
export interface SyncConfig {
  /** ローカル変更のデバウンス時間（ミリ秒）。0の場合は即座に同期 */
  debounceMs: number;
  /** 同期失敗時のリトライ最大回数 */
  maxRetries: number;
  /** リトライ間隔（ミリ秒） */
  retryIntervalMs: number;
}

/**
 * デフォルトの同期設定
 *
 * Yjsがネットワーク送信を最適化するため、アプリレベルでのデバウンスは不要。
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  debounceMs: 0, // リアルタイム同期のためデバウンスなし
  maxRetries: 3,
  retryIntervalMs: 1000,
};

/**
 * Yjs トランザクションのオリジン識別子
 *
 * 無限ループ防止のため、同期元を識別するために使用する。
 * Yjsのトランザクション実行時に origin パラメータとして渡す。
 *
 * @example
 * ```typescript
 * yDoc.transact(() => {
 *   yObjects.set(id, object);
 * }, SYNC_ORIGIN.LOCAL);
 * ```
 */
export const SYNC_ORIGIN = {
  /** ローカルUI操作からの変更 */
  LOCAL: 'local-ui',
  /** Yjsからの同期による変更 */
  YJS: 'yjs-sync',
  /** 初期ロード時の変更 */
  INITIAL: 'initial-load',
} as const;

/**
 * 同期オリジンの型
 */
export type SyncOrigin = (typeof SYNC_ORIGIN)[keyof typeof SYNC_ORIGIN];

/**
 * 同期変更の情報
 *
 * ローカル/リモートからの変更を表す。
 * canvasStoreへの反映時に使用。
 */
export interface SyncChange {
  /** 変更のアクション種別 */
  action: SyncAction;
  /** 対象オブジェクトのID */
  objectId: string;
  /** 変更後のオブジェクトデータ（deleteの場合はundefined） */
  object?: GridObject;
}

/**
 * バッチ同期変更
 *
 * 複数の変更をまとめて処理する際に使用。
 */
export interface SyncBatch {
  /** 変更のリスト */
  changes: SyncChange[];
  /** バッチの発生元 */
  origin: SyncEventOrigin;
  /** バッチのタイムスタンプ */
  timestamp: number;
}

/**
 * 同期イベントリスナー
 *
 * 同期イベントを購読するためのコールバック関数の型。
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * 同期マネージャーのアクション
 *
 * 同期マネージャーが提供するメソッドの型定義。
 */
export interface SyncManagerActions {
  /**
   * 同期を初期化する
   *
   * @param yObjects - Yjs Y.Map<GridObject>
   * @param initialObjects - Zustandストアの現在のオブジェクト
   */
  initialize: (
    yObjects: YMap<GridObject>,
    initialObjects: GridObject[]
  ) => void;

  /**
   * ローカル変更をYjsに同期する
   *
   * @param action - 変更のアクション種別
   * @param objectId - 対象オブジェクトのID
   * @param object - オブジェクトデータ（deleteの場合はundefined）
   */
  syncLocalChange: (
    action: SyncAction,
    objectId: string,
    object?: GridObject
  ) => void;

  /**
   * 同期を破棄する
   *
   * イベントリスナーの解除やリソースの解放を行う。
   */
  dispose: () => void;

  /**
   * 同期イベントリスナーを追加する
   *
   * @param listener - イベントリスナー
   * @returns リスナー解除関数
   */
  addEventListener: (listener: SyncEventListener) => () => void;
}

/**
 * オブジェクト同期ソース
 *
 * canvasStore.setObjects で使用する、オブジェクト更新のソースを表す。
 */
export type ObjectSyncSource = 'local' | 'sync' | 'initial';

/**
 * setObjects のオプション
 *
 * canvasStore.setObjects に渡すオプション。
 */
export interface SetObjectsOptions {
  /** オブジェクト更新のソース */
  source: ObjectSyncSource;
}
