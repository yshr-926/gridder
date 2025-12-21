/**
 * 共同編集ストア
 *
 * Yjs と y-websocket を使用したリアルタイム共同編集の状態管理を行う。
 * - WebSocket接続の管理（Rust バックエンド対応）
 * - Awareness によるプレゼンス共有
 * - IndexedDB によるオフライン永続化
 * - パスフレーズ認証（REST API 経由）
 */

import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
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
import { getWebSocketUrl, environment, isDebug } from '@/config/environment';
import { authApi } from '@/services/api';
import { SyncManager } from '@/features/sync/SyncManager';
import type { SyncState } from '@/features/sync/types';

/**
 * 認証状態
 */
interface AuthState {
  /** 認証トークン */
  token: string | null;
  /** トークン有効期限（Unix タイムスタンプ、秒） */
  expiresAt: number | null;
  /** 認証中フラグ */
  isAuthenticating: boolean;
  /** 認証エラー */
  authError: string | null;
}

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
  /** y-websocket Provider を取得 */
  getProvider: () => WebsocketProvider | null;
  /** 同期マネージャーを取得（デバッグ用） */
  getSyncManager: () => SyncManager | null;
  /** エラーを設定 */
  setError: (error: string | null) => void;
  /** 状態をリセット */
  reset: () => void;
}

/**
 * 同期状態
 */
interface ObjectSyncState {
  /** オブジェクト同期状態 */
  syncState: SyncState;
}

/**
 * 共同編集ストアの型
 */
type CollaborationStore = CollaborationState & AuthState & ObjectSyncState & CollaborationActions;

// Yjs インスタンス（ストア外で管理、シングルトン）
let ydoc: Y.Doc | null = null;
let websocketProvider: WebsocketProvider | null = null;
let indexeddbProvider: IndexeddbPersistence | null = null;
let syncManager: SyncManager | null = null;

// ブラウザオフライン/オンラインイベントリスナーのクリーンアップ関数
let cleanupNetworkListeners: (() => void) | null = null;

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
const initialState: CollaborationState & AuthState & ObjectSyncState = {
  connectionState: 'disconnected',
  room: null,
  self: null,
  collaborators: [],
  presences: new Map(),
  error: null,
  token: null,
  expiresAt: null,
  isAuthenticating: false,
  authError: null,
  syncState: 'idle',
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

    set({ connectionState: 'connecting', error: null, isAuthenticating: true, authError: null });

    try {
      // 1. REST API で認証トークンを取得
      if (isDebug()) {
        console.log('[Collaboration] Authenticating for room:', roomId);
      }

      let token: string | undefined;
      let expiresAt: number | undefined;

      try {
        const authResponse = await authApi.authenticate({
          roomId,
          passphrase,
        });
        token = authResponse.token;
        expiresAt = authResponse.expiresAt;
        set({ token, expiresAt, isAuthenticating: false });
      } catch (authError) {
        // 認証エラーの処理
        const message =
          authError instanceof Error ? authError.message : '認証に失敗しました';
        set({
          isAuthenticating: false,
          authError: message,
          connectionState: 'error',
          error: message,
        });
        throw new CollaborationError(
          CollaborationErrorCode.INVALID_PASSPHRASE,
          message
        );
      }

      // 2. Yjs ドキュメントを作成
      ydoc = new Y.Doc();

      // 3. WebSocket Provider を作成（トークンをクエリパラメータで渡す）
      const wsUrl = getWebSocketUrl(roomId, token);

      if (isDebug()) {
        console.log('[Collaboration] Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
      }

      // y-websocket の WebsocketProvider を使用
      await new Promise<void>((resolve, reject) => {
        websocketProvider = new WebsocketProvider(
          environment.wsUrl,
          roomId,
          ydoc!,
          {
            params: { token: token || '' },
          }
        );

        // 接続状態の監視
        websocketProvider.on('status', (event: { status: string }) => {
          if (isDebug()) {
            console.log('[Collaboration] WebSocket status:', event.status);
          }

          if (event.status === 'connected') {
            set({ connectionState: 'connected' });
            resolve();
          } else if (event.status === 'disconnected') {
            const state = get();
            // エラー状態でない場合のみ disconnected に変更
            if (state.connectionState !== 'error') {
              set({ connectionState: 'disconnected' });
            }
          } else if (event.status === 'connecting') {
            const state = get();
            if (state.connectionState === 'connected') {
              set({ connectionState: 'reconnecting' });
            }
          }
        });

        // 接続エラーの監視
        websocketProvider.on('connection-error', (event: Event) => {
          if (isDebug()) {
            console.error('[Collaboration] WebSocket connection error:', event);
          }
          set({
            connectionState: 'error',
            error: 'WebSocket 接続に失敗しました',
          });
          reject(
            new CollaborationError(
              CollaborationErrorCode.NETWORK_ERROR,
              'WebSocket 接続に失敗しました'
            )
          );
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
        websocketProvider!.on('status', (event: { status: string }) => {
          if (event.status === 'connected') {
            clearTimeout(timeout);
          }
        });
      });

      // 4. IndexedDB 永続化を設定（オフライン対応）
      const persistenceKey = `gridder-${import.meta.env.MODE}-${roomId}`;
      indexeddbProvider = new IndexeddbPersistence(persistenceKey, ydoc);

      // 5. 自分のユーザー情報を設定
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

      // 6. Awareness に自分の情報を設定
      websocketProvider?.awareness.setLocalStateField('user', {
        name: displayName,
        color: userColor,
        connectedAt,
      });

      // 7. Awareness の変更を監視
      websocketProvider?.awareness.on('change', () => {
        const states = websocketProvider!.awareness.getStates();
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

      // 8. SyncManager を初期化
      if (ydoc) {
        try {
          syncManager = new SyncManager(ydoc);
          syncManager.initialize();
          set({ syncState: 'syncing' });

          // 同期完了を少し待ってから状態を更新
          setTimeout(() => {
            const currentState = get();
            if (currentState.connectionState === 'connected') {
              set({ syncState: 'idle' });
            }
          }, 500);

          if (isDebug()) {
            console.log('[CollaborationStore] SyncManager initialized');
          }
        } catch (syncError) {
          console.error('[CollaborationStore] Failed to initialize SyncManager:', syncError);
          set({ syncState: 'error' });
          // SyncManager の初期化失敗は接続自体を失敗にしない（他の機能は継続動作）
        }
      }

      // 9. ブラウザのオフライン/オンラインイベントを監視
      const handleOnline = () => {
        if (isDebug()) {
          console.log('[CollaborationStore] Browser online');
        }
        // オンラインに復帰したら同期状態を更新
        // y-websocket が自動的に再接続を試みる
        const currentState = get();
        if (currentState.connectionState === 'disconnected' || currentState.connectionState === 'reconnecting') {
          set({ syncState: 'syncing' });
          // Yjsが自動的にマージを実行するため、少し待ってからidleに戻す
          setTimeout(() => {
            const state = get();
            if (state.connectionState === 'connected') {
              set({ syncState: 'idle' });
              if (isDebug()) {
                console.log('[CollaborationStore] Sync completed after reconnection');
              }
            }
          }, 2000);
        }
      };

      const handleOffline = () => {
        if (isDebug()) {
          console.log('[CollaborationStore] Browser offline');
        }
        // オフラインになった場合、接続状態を更新
        // y-websocket が自動的に切断を検出するが、ブラウザイベントでより早く検出可能
        const currentState = get();
        if (currentState.connectionState === 'connected') {
          set({ connectionState: 'reconnecting' });
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // クリーンアップ関数を保存
      cleanupNetworkListeners = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
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
    // ネットワークリスナーをクリーンアップ
    if (cleanupNetworkListeners) {
      cleanupNetworkListeners();
      cleanupNetworkListeners = null;
    }

    // SyncManager を先に破棄（Yjsへのリスナーを解除）
    if (syncManager) {
      try {
        syncManager.destroy();
        syncManager = null;
        if (isDebug()) {
          console.log('[CollaborationStore] SyncManager destroyed');
        }
      } catch (error) {
        console.error('[CollaborationStore] Failed to destroy SyncManager:', error);
      }
    }

    // WebSocket Provider を切断・破棄
    if (websocketProvider) {
      websocketProvider.disconnect();
      websocketProvider.destroy();
      websocketProvider = null;
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
      token: null,
      expiresAt: null,
      isAuthenticating: false,
      authError: null,
      syncState: 'idle',
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
    if (websocketProvider?.awareness) {
      websocketProvider.awareness.setLocalStateField('user', {
        name: displayName,
        color: self.color,
        connectedAt: self.connectedAt,
      });
    }
  },

  updateCursor: (cursor) => {
    if (websocketProvider?.awareness) {
      websocketProvider.awareness.setLocalStateField('cursor', cursor);
    }
  },

  updateSelection: (objectIds) => {
    if (websocketProvider?.awareness) {
      websocketProvider.awareness.setLocalStateField('selectedObjectIds', objectIds);
    }
  },

  updatePresence: (presence) => {
    if (!websocketProvider?.awareness) return;

    if (presence.cursor !== undefined) {
      websocketProvider.awareness.setLocalStateField('cursor', presence.cursor);
    }
    if (presence.selectedObjectIds !== undefined) {
      websocketProvider.awareness.setLocalStateField(
        'selectedObjectIds',
        presence.selectedObjectIds
      );
    }
  },

  getYDoc: () => ydoc,

  getProvider: () => websocketProvider,

  getSyncManager: () => syncManager,

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
 * WebSocket Provider を取得するヘルパー関数
 */
export const getProvider = (): WebsocketProvider | null => {
  return websocketProvider;
};

/**
 * SyncManager を取得するヘルパー関数（デバッグ用）
 */
export const getSyncManager = (): SyncManager | null => {
  return syncManager;
};
