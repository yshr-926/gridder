/**
 * 同期機能モジュール
 *
 * Yjs共有データとZustandストア間の同期ロジックを管理する。
 * SyncManager、型定義、エラー定義をエクスポートする。
 */

// 型定義のエクスポート
export type {
  SyncState,
  SyncAction,
  SyncEventOrigin,
  SyncEvent,
  SyncManagerState,
  SyncConfig,
  SyncOrigin,
  SyncChange,
  SyncBatch,
  SyncEventListener,
  SyncManagerActions,
  ObjectSyncSource,
  SetObjectsOptions,
} from './types';

export {
  INITIAL_SYNC_MANAGER_STATE,
  DEFAULT_SYNC_CONFIG,
  SYNC_ORIGIN,
} from './types';

// エラー定義のエクスポート
export type { SyncErrorCode } from './errors';

export {
  SyncErrorCode as SyncErrorCodes,
  SYNC_ERROR_MESSAGES,
  SyncError,
  SyncFailedError,
  VersionMismatchError,
  SyncTimeoutError,
  InitializationFailedError,
  InvalidStateError,
  ObjectNotFoundError,
  isSyncError,
  getSyncErrorMessage,
} from './errors';

// 同期マネージャー
export { SyncManager, type SyncManagerDebugState } from './SyncManager';
