/**
 * 共同編集ストア
 *
 * Yjs と Hocuspocus Provider を使用したリアルタイム共同編集の状態管理を行う。
 * - WebSocket接続の管理
 * - Awareness によるプレゼンス共有
 * - IndexedDB によるオフライン永続化
 * - パスフレーズ認証
 */

import { create } from 'zustand';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import type {
  CollaborationState,
  CollaboratorInfo,
  Presence,
  CursorPosition,
} from '@/features/collaboration/types';
import { CURSOR_COLORS } from '@/features/collaboration/types';
import {
  CollaborationError,
  CollaborationErrorCode,
} from '@/features/collaboration/errors';

/**
 * 共同編集ストアのアクション
 */
interface CollaborationActions {
  /** ルームに接続 */
  connect: (
    roomId: string,
    displayName: string,
    passphrase?: string
  ) => Promise<void>;
  /** ルームから切断 */
  disconnect: () => void;
  /** 表示名を更新 */
  updateDisplayName: (displayName: string) => void;
  /** カーソル位置を更新（プレゼンス） */
  updateCursor: (cursor: CursorPosition | null) => void;
  /** 選択オブジェクトを更新（プレゼンス） */
  updateSelection: (objectIds: string[]) => void;
  /** プレゼンスを一括更新 */
  updatePresence: (presence: Partial<Omit<Presence, 'userId' | 'updatedAt'>>) => void;
  /** Yjs ドキュメントを取得 */
  getYDoc: () => Y.Doc | null;
  /** Hocuspocus Provider を取得 */
  getProvider: () => HocuspocusProvider | null;
  /** エラーを設定 */
  setError: (error: string | null) => void;
  /** 状態をリセット */
  reset: () => void;
}

/**
 * 共同編集ストアの型
 */
type CollaborationStore = CollaborationState & CollaborationActions;

// Yjs インスタンス（ストア外で管理、シングルトン）
let ydoc: Y.Doc | null = null;
let hocuspocusProvider: HocuspocusProvider | null = null;
let indexeddbProvider: IndexeddbPersistence | null = null;

// 他のユーザーの「初回観測時刻」を記録するマップ
// Awareness の更新のたびに connectedAt が上書きされるのを防ぐ
const collaboratorFirstSeen = new Map<number, string>();

/**
 * カーソル色を取得（clientID に基づいて割り当て）
 */
const getColorForClient = (clientId: number): string => {
  return CURSOR_COLORS[clientId % CURSOR_COLORS.length];
};

/**
 * 初期状態
 */
const initialState: CollaborationState = {
  connectionState: 'disconnected',
  room: null,
  self: null,
  collaborators: [],
  presences: new Map(),
  error: null,
};

/**
 * 共同編集ストア
 */
export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  ...initialState,

  connect: async (roomId, displayName, passphrase) => {
    // 既に接続中の場合は切断してから再接続
    if (get().connectionState !== 'disconnected') {
      get().disconnect();
    }

    set({ connectionState: 'connecting', error: null });

    // Yjs ドキュメントを作成
    ydoc = new Y.Doc();

    // WebSocket URL を環境変数から取得
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

    try {
      // Hocuspocus Provider を作成（Promise でラップして接続完了を待つ）
      await new Promise<void>((resolve, reject) => {
        hocuspocusProvider = new HocuspocusProvider({
          url: wsUrl,
          name: roomId,
          document: ydoc!,
          token: passphrase || undefined,

          onConnect: () => {
            set({ connectionState: 'connected' });
            resolve();
          },

          onDisconnect: () => {
            const state = get();
            // エラー状態でない場合のみ disconnected に変更
            if (state.connectionState !== 'error') {
              set({ connectionState: 'disconnected' });
            }
          },

          onClose: ({ event }) => {
            // WebSocket がクローズされた場合
            if (event.code !== 1000) {
              // 正常クローズ以外
              set({
                connectionState: 'error',
                error: 'WebSocket 接続が切断されました',
              });
            }
          },

          onAuthenticationFailed: ({ reason }) => {
            // 認証失敗時のエラーメッセージ
            const errorMessage =
              reason === 'Invalid passphrase'
                ? 'パスフレーズが正しくありません'
                : reason === 'Room not found'
                  ? 'ルームが見つかりません'
                  : reason === 'Room expired'
                    ? 'ルームの有効期限が切れています'
                    : '認証に失敗しました';

            set({ connectionState: 'error', error: errorMessage });
            reject(new CollaborationError(CollaborationErrorCode.INVALID_PASSPHRASE, errorMessage));
          },

          onStatus: ({ status }) => {
            // 再接続中の状態を反映
            if (status === 'connecting') {
              const state = get();
              if (state.connectionState === 'connected') {
                set({ connectionState: 'reconnecting' });
              }
            }
          },
        });

        // 接続タイムアウト（10秒）
        const timeout = setTimeout(() => {
          if (get().connectionState === 'connecting') {
            get().disconnect();
            reject(
              new CollaborationError(
                CollaborationErrorCode.NETWORK_ERROR,
                '接続がタイムアウトしました'
              )
            );
          }
        }, 10000);

        // 接続成功時にタイムアウトをクリア
        hocuspocusProvider!.on('connect', () => {
          clearTimeout(timeout);
        });
      });

      // IndexedDB 永続化を設定（オフライン対応）
      const persistenceKey = `gridder-${import.meta.env.MODE}-${roomId}`;
      indexeddbProvider = new IndexeddbPersistence(persistenceKey, ydoc);

      // 自分のユーザー情報を設定
      const userId = ydoc.clientID.toString();
      const userColor = getColorForClient(ydoc.clientID);
      const connectedAt = new Date().toISOString();

      set({
        room: {
          id: roomId,
          createdAt: connectedAt,
          participants: [],
        },
        self: {
          id: userId,
          displayName,
          color: userColor,
          connectedAt,
        },
      });

      // Awareness に自分の情報を設定
      hocuspocusProvider?.awareness?.setLocalStateField('user', {
        name: displayName,
        color: userColor,
        connectedAt,
      });

      // Awareness の変更を監視
      hocuspocusProvider?.awareness?.on('change', () => {
        const states = hocuspocusProvider!.awareness!.getStates();
        const collaborators: CollaboratorInfo[] = [];
        const presences = new Map<string, Presence>();

        states.forEach((state, clientId) => {
          // 自分以外のユーザーを処理
          if (clientId !== ydoc!.clientID && state.user) {
            // 初回観測時刻を記録（以降は更新しない）
            if (!collaboratorFirstSeen.has(clientId)) {
              collaboratorFirstSeen.set(
                clientId,
                (state.user.connectedAt as string) || new Date().toISOString()
              );
            }

            collaborators.push({
              id: clientId.toString(),
              displayName: state.user.name as string,
              color: state.user.color as string,
              connectedAt: collaboratorFirstSeen.get(clientId)!,
            });

            // プレゼンス情報を収集
            if (state.cursor !== undefined) {
              presences.set(clientId.toString(), {
                userId: clientId.toString(),
                cursor: state.cursor as CursorPosition | null,
                selectedObjectIds: (state.selectedObjectIds as string[]) || [],
                updatedAt: new Date().toISOString(),
              });
            }
          }
        });

        // 離脱したユーザーの初回観測記録を削除
        for (const clientId of collaboratorFirstSeen.keys()) {
          if (!states.has(clientId)) {
            collaboratorFirstSeen.delete(clientId);
          }
        }

        // ルームの参加者リストも更新
        const self = get().self;
        const allParticipants = self
          ? [self, ...collaborators]
          : collaborators;

        set({
          collaborators,
          presences,
          room: get().room
            ? { ...get().room!, participants: allParticipants }
            : null,
        });
      });
    } catch (error) {
      // エラー時にリソースをクリーンアップ
      get().disconnect();

      if (error instanceof CollaborationError) {
        throw error;
      }

      throw new CollaborationError(
        CollaborationErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : '接続に失敗しました'
      );
    }
  },

  disconnect: () => {
    // Hocuspocus Provider を切断・破棄
    if (hocuspocusProvider) {
      hocuspocusProvider.disconnect();
      hocuspocusProvider.destroy();
      hocuspocusProvider = null;
    }

    // IndexedDB Provider を破棄
    if (indexeddbProvider) {
      indexeddbProvider.destroy();
      indexeddbProvider = null;
    }

    // Yjs ドキュメントを破棄
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
    }

    // 初回観測マップをクリア
    collaboratorFirstSeen.clear();

    // 状態を初期化
    set({
      connectionState: 'disconnected',
      room: null,
      self: null,
      collaborators: [],
      presences: new Map(),
      error: null,
    });
  },

  updateDisplayName: (displayName) => {
    const self = get().self;
    if (!self) return;

    // ストアの状態を更新
    set({
      self: { ...self, displayName },
    });

    // Awareness に反映
    if (hocuspocusProvider?.awareness) {
      hocuspocusProvider.awareness.setLocalStateField('user', {
        name: displayName,
        color: self.color,
        connectedAt: self.connectedAt,
      });
    }
  },

  updateCursor: (cursor) => {
    if (hocuspocusProvider?.awareness) {
      hocuspocusProvider.awareness.setLocalStateField('cursor', cursor);
    }
  },

  updateSelection: (objectIds) => {
    if (hocuspocusProvider?.awareness) {
      hocuspocusProvider.awareness.setLocalStateField('selectedObjectIds', objectIds);
    }
  },

  updatePresence: (presence) => {
    if (!hocuspocusProvider?.awareness) return;

    if (presence.cursor !== undefined) {
      hocuspocusProvider.awareness.setLocalStateField('cursor', presence.cursor);
    }
    if (presence.selectedObjectIds !== undefined) {
      hocuspocusProvider.awareness.setLocalStateField(
        'selectedObjectIds',
        presence.selectedObjectIds
      );
    }
  },

  getYDoc: () => ydoc,

  getProvider: () => hocuspocusProvider,

  setError: (error) => {
    if (error) {
      set({ error, connectionState: 'error' });
    } else {
      set({ error: null });
    }
  },

  reset: () => {
    get().disconnect();
    set(initialState);
  },
}));

/**
 * Yjs ドキュメントを取得するヘルパー関数
 */
export const getYDoc = (): Y.Doc | null => {
  return ydoc;
};

/**
 * Hocuspocus Provider を取得するヘルパー関数
 */
export const getProvider = (): HocuspocusProvider | null => {
  return hocuspocusProvider;
};
