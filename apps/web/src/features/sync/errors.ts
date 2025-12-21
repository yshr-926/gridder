/**
 * 同期機能のエラー定義
 *
 * Yjs共有データとZustandストア間の同期で発生する可能性のあるエラーを定義する。
 */

/**
 * 同期エラーコード
 *
 * 同期処理中に発生する可能性のあるエラーの種類を表す。
 * - SYNC_FAILED: 同期処理が失敗した
 * - VERSION_MISMATCH: データバージョンが不整合
 * - SYNC_TIMEOUT: 同期がタイムアウトした
 * - INITIALIZATION_FAILED: 初期化に失敗した
 * - INVALID_STATE: 無効な状態での操作
 * - OBJECT_NOT_FOUND: オブジェクトが見つからない
 */
export const SyncErrorCode = {
  /** 同期処理が失敗した */
  SYNC_FAILED: 'SYNC_FAILED',
  /** データバージョンが不整合 */
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  /** 同期がタイムアウトした */
  SYNC_TIMEOUT: 'SYNC_TIMEOUT',
  /** 初期化に失敗した */
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  /** 無効な状態での操作 */
  INVALID_STATE: 'INVALID_STATE',
  /** オブジェクトが見つからない */
  OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
} as const;

/**
 * 同期エラーコードの型
 */
export type SyncErrorCode = (typeof SyncErrorCode)[keyof typeof SyncErrorCode];

/**
 * エラーコードに対応するメッセージ
 */
export const SYNC_ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  [SyncErrorCode.SYNC_FAILED]:
    '同期処理に失敗しました。再試行してください。',
  [SyncErrorCode.VERSION_MISMATCH]:
    'データのバージョンが一致しません。ページを再読み込みしてください。',
  [SyncErrorCode.SYNC_TIMEOUT]:
    '同期がタイムアウトしました。ネットワーク接続を確認してください。',
  [SyncErrorCode.INITIALIZATION_FAILED]:
    '同期の初期化に失敗しました。再接続してください。',
  [SyncErrorCode.INVALID_STATE]:
    '無効な状態です。ページを再読み込みしてください。',
  [SyncErrorCode.OBJECT_NOT_FOUND]:
    '指定されたオブジェクトが見つかりません。',
};

/**
 * 同期関連エラーの基底クラス
 *
 * すべての同期関連エラーはこのクラスを継承する。
 * エラーコードとメッセージを含む。
 */
export class SyncError extends Error {
  /** エラーコード */
  readonly code: SyncErrorCode;

  /**
   * SyncError のコンストラクタ
   *
   * @param code - エラーコード
   * @param message - オプションのカスタムメッセージ（省略時はデフォルトメッセージを使用）
   */
  constructor(code: SyncErrorCode, message?: string) {
    super(message ?? SYNC_ERROR_MESSAGES[code]);
    this.name = 'SyncError';
    this.code = code;

    // Error を継承する際に必要
    Object.setPrototypeOf(this, SyncError.prototype);
  }

  /**
   * エラーが特定のコードかどうかを判定
   *
   * @param code - 判定するエラーコード
   * @returns エラーコードが一致する場合 true
   */
  is(code: SyncErrorCode): boolean {
    return this.code === code;
  }
}

/**
 * 同期失敗エラー
 *
 * 同期処理が何らかの理由で失敗した場合に発生する。
 */
export class SyncFailedError extends SyncError {
  /** 元のエラー（ある場合） */
  readonly cause?: Error;

  /**
   * SyncFailedError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param cause - 元のエラー
   */
  constructor(message?: string, cause?: Error) {
    super(SyncErrorCode.SYNC_FAILED, message);
    this.name = 'SyncFailedError';
    this.cause = cause;

    Object.setPrototypeOf(this, SyncFailedError.prototype);
  }
}

/**
 * バージョン不整合エラー
 *
 * ローカルとリモートのデータバージョンが一致しない場合に発生する。
 */
export class VersionMismatchError extends SyncError {
  /** ローカルバージョン */
  readonly localVersion?: string;
  /** リモートバージョン */
  readonly remoteVersion?: string;

  /**
   * VersionMismatchError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param localVersion - ローカルバージョン
   * @param remoteVersion - リモートバージョン
   */
  constructor(message?: string, localVersion?: string, remoteVersion?: string) {
    super(SyncErrorCode.VERSION_MISMATCH, message);
    this.name = 'VersionMismatchError';
    this.localVersion = localVersion;
    this.remoteVersion = remoteVersion;

    Object.setPrototypeOf(this, VersionMismatchError.prototype);
  }
}

/**
 * 同期タイムアウトエラー
 *
 * 同期処理が指定時間内に完了しなかった場合に発生する。
 */
export class SyncTimeoutError extends SyncError {
  /** タイムアウト時間（ミリ秒） */
  readonly timeoutMs?: number;

  /**
   * SyncTimeoutError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param timeoutMs - タイムアウト時間（ミリ秒）
   */
  constructor(message?: string, timeoutMs?: number) {
    super(SyncErrorCode.SYNC_TIMEOUT, message);
    this.name = 'SyncTimeoutError';
    this.timeoutMs = timeoutMs;

    Object.setPrototypeOf(this, SyncTimeoutError.prototype);
  }
}

/**
 * 初期化失敗エラー
 *
 * 同期マネージャーの初期化に失敗した場合に発生する。
 */
export class InitializationFailedError extends SyncError {
  /** 元のエラー（ある場合） */
  readonly cause?: Error;

  /**
   * InitializationFailedError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param cause - 元のエラー
   */
  constructor(message?: string, cause?: Error) {
    super(SyncErrorCode.INITIALIZATION_FAILED, message);
    this.name = 'InitializationFailedError';
    this.cause = cause;

    Object.setPrototypeOf(this, InitializationFailedError.prototype);
  }
}

/**
 * 無効状態エラー
 *
 * 同期マネージャーが無効な状態で操作が試みられた場合に発生する。
 */
export class InvalidStateError extends SyncError {
  /** 現在の状態 */
  readonly currentState?: string;

  /**
   * InvalidStateError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param currentState - 現在の状態
   */
  constructor(message?: string, currentState?: string) {
    super(SyncErrorCode.INVALID_STATE, message);
    this.name = 'InvalidStateError';
    this.currentState = currentState;

    Object.setPrototypeOf(this, InvalidStateError.prototype);
  }
}

/**
 * オブジェクト未発見エラー
 *
 * 操作対象のオブジェクトが見つからなかった場合に発生する。
 */
export class ObjectNotFoundError extends SyncError {
  /** 対象オブジェクトのID */
  readonly objectId?: string;

  /**
   * ObjectNotFoundError のコンストラクタ
   *
   * @param message - カスタムメッセージ
   * @param objectId - 対象オブジェクトのID
   */
  constructor(message?: string, objectId?: string) {
    super(SyncErrorCode.OBJECT_NOT_FOUND, message);
    this.name = 'ObjectNotFoundError';
    this.objectId = objectId;

    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * エラーが SyncError かどうかを判定する型ガード
 *
 * @param error - 判定対象のエラー
 * @returns SyncError の場合 true
 */
export function isSyncError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

/**
 * エラーコードからエラーメッセージを取得
 *
 * @param code - エラーコード
 * @returns エラーメッセージ
 */
export function getSyncErrorMessage(code: SyncErrorCode): string {
  return SYNC_ERROR_MESSAGES[code];
}
