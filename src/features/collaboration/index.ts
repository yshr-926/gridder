/**
 * 共同編集機能モジュール
 *
 * リアルタイム共同編集に必要な型定義とエラーコードをエクスポートする。
 */

// 型定義
export type {
  CursorPosition,
  CollaboratorInfo,
  Presence,
  RoomInfo,
  ConnectionState,
  CollaborationState,
  CollaborationActions,
  CursorColor,
} from './types';

// 定数
export {
  CURSOR_COLORS,
  DISPLAY_NAME_CONSTRAINTS,
  ROOM_ID_CONSTRAINTS,
  PRESENCE_THROTTLE_MS,
  ROOM_EXPIRY_MS,
} from './types';

// エラーコード
export {
  CollaborationErrorCode,
  COLLABORATION_ERROR_MESSAGES,
  CollaborationError,
  isCollaborationError,
  getErrorMessage,
} from './errors';

// エラーコードの型（エイリアス）
export type { CollaborationErrorCode as CollaborationErrorCodeType } from './errors';

// フック
export { useLocalPresence } from './useLocalPresence';
export type {
  UseLocalPresenceOptions,
  UseLocalPresenceResult,
} from './useLocalPresence';
