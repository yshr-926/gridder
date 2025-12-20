/**
 * 共同編集機能のエラーコード定義
 *
 * 共同編集中に発生する可能性のあるエラーを定義する。
 * サーバーサイドとクライアントサイドで共通のエラーコードを使用する。
 */

/**
 * 共同編集エラーコード
 *
 * - ROOM_NOT_FOUND: 指定されたルームが存在しない
 * - INVALID_PASSPHRASE: パスフレーズが正しくない
 * - ROOM_EXPIRED: ルームの有効期限が切れている
 * - CONNECTION_LIMIT: 接続数上限に達した
 * - INVALID_DISPLAY_NAME: 表示名が無効
 * - NETWORK_ERROR: ネットワークエラー
 * - INTERNAL_ERROR: 内部エラー
 */
export const CollaborationErrorCode = {
  /** 指定されたルームが存在しない */
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  /** パスフレーズが正しくない */
  INVALID_PASSPHRASE: 'INVALID_PASSPHRASE',
  /** ルームの有効期限が切れている */
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  /** 接続数上限に達した */
  CONNECTION_LIMIT: 'CONNECTION_LIMIT',
  /** 表示名が無効（長さ制限違反など） */
  INVALID_DISPLAY_NAME: 'INVALID_DISPLAY_NAME',
  /** ネットワークエラー */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** 内部エラー */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * 共同編集エラーコードの型
 */
export type CollaborationErrorCode =
  (typeof CollaborationErrorCode)[keyof typeof CollaborationErrorCode];

/**
 * エラーコードに対応するメッセージ
 */
export const COLLABORATION_ERROR_MESSAGES: Record<
  CollaborationErrorCode,
  string
> = {
  [CollaborationErrorCode.ROOM_NOT_FOUND]:
    '指定されたルームが見つかりません。URLを確認してください。',
  [CollaborationErrorCode.INVALID_PASSPHRASE]:
    'パスフレーズが正しくありません。',
  [CollaborationErrorCode.ROOM_EXPIRED]:
    'ルームの有効期限が切れています。新しいルームを作成してください。',
  [CollaborationErrorCode.CONNECTION_LIMIT]:
    '接続数の上限に達しました。しばらく待ってから再試行してください。',
  [CollaborationErrorCode.INVALID_DISPLAY_NAME]:
    '表示名が無効です。1〜20文字で設定してください。',
  [CollaborationErrorCode.NETWORK_ERROR]:
    'ネットワークエラーが発生しました。接続を確認してください。',
  [CollaborationErrorCode.INTERNAL_ERROR]:
    '内部エラーが発生しました。しばらく待ってから再試行してください。',
};

/**
 * 共同編集エラークラス
 *
 * 共同編集機能で発生するエラーを表すカスタムエラークラス。
 * エラーコードとメッセージを含む。
 */
export class CollaborationError extends Error {
  /** エラーコード */
  readonly code: CollaborationErrorCode;

  /**
   * CollaborationError のコンストラクタ
   *
   * @param code - エラーコード
   * @param message - オプションのカスタムメッセージ（省略時はデフォルトメッセージを使用）
   */
  constructor(code: CollaborationErrorCode, message?: string) {
    super(message ?? COLLABORATION_ERROR_MESSAGES[code]);
    this.name = 'CollaborationError';
    this.code = code;

    // Error を継承する際に必要
    Object.setPrototypeOf(this, CollaborationError.prototype);
  }

  /**
   * エラーが特定のコードかどうかを判定
   *
   * @param code - 判定するエラーコード
   * @returns エラーコードが一致する場合 true
   */
  is(code: CollaborationErrorCode): boolean {
    return this.code === code;
  }
}

/**
 * エラーが CollaborationError かどうかを判定する型ガード
 *
 * @param error - 判定対象のエラー
 * @returns CollaborationError の場合 true
 */
export function isCollaborationError(
  error: unknown
): error is CollaborationError {
  return error instanceof CollaborationError;
}

/**
 * エラーコードからエラーメッセージを取得
 *
 * @param code - エラーコード
 * @returns エラーメッセージ
 */
export function getErrorMessage(code: CollaborationErrorCode): string {
  return COLLABORATION_ERROR_MESSAGES[code];
}
