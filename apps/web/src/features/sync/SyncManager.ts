/**
 * SyncManager - Yjs Y.Map と canvasStore の同期を管理するクラス
 *
 * 責務:
 * - Y.Map の初期化と監視
 * - ローカル変更 → Yjs への反映
 * - Yjs の変更 → ローカルへの反映
 * - 無限ループの防止
 */

import * as Y from 'yjs';
import type { GridObject } from '@/types';
import { useCanvasStore } from '@/stores/canvasStore';
import { SYNC_ORIGIN, type SyncState } from './types';
import { isDebug } from '@/config/environment';

/**
 * 同期マネージャーの状態情報（デバッグ用）
 */
export interface SyncManagerDebugState {
  /** ローカルストアのオブジェクト数 */
  localCount: number;
  /** Yjs Y.Mapのオブジェクト数 */
  yjsCount: number;
  /** リモート変更処理中フラグ */
  isProcessingRemoteChange: boolean;
  /** 初期化済みフラグ */
  isInitialized: boolean;
  /** 現在の同期状態 */
  syncState: SyncState;
}

/**
 * Yjs Y.Map と canvasStore の同期を管理するクラス
 *
 * 同期フロー:
 * 1. ローカル変更 → Zustand subscribe → syncDiffToYjs → Y.Map.set/delete
 * 2. リモート変更 → Y.Map.observe → handleYjsChange → canvasStore.setObjects
 *
 * 無限ループ防止:
 * - オリジン識別子: Yjsトランザクションに SYNC_ORIGIN.LOCAL を設定
 * - フラグ: isProcessingRemoteChange でリモート変更処理中を判定
 */
export class SyncManager {
  private readonly ydoc: Y.Doc;
  private readonly yObjects: Y.Map<GridObject>;
  private unsubscribeStore: (() => void) | null = null;
  private isProcessingRemoteChange = false;
  private isInitialized = false;
  private syncState: SyncState = 'idle';

  /**
   * SyncManager のコンストラクタ
   *
   * @param ydoc - Yjs ドキュメント
   */
  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc;
    this.yObjects = ydoc.getMap<GridObject>('objects');
  }

  /**
   * 同期を開始
   *
   * - Yjs Y.Map の変更を監視
   * - canvasStore の変更を監視
   * - 初期データを同期
   */
  initialize(): void {
    if (this.isInitialized) {
      this.log('warn', 'Already initialized');
      return;
    }

    this.log('info', 'Initializing...');

    // 1. Yjs Y.Map の変更を監視
    this.yObjects.observe(this.handleYjsChange);

    // 2. canvasStore の変更を監視（Zustand subscribe）
    this.unsubscribeStore = useCanvasStore.subscribe(
      (state, prevState) => {
        // objects が変更された場合のみハンドラを呼び出す
        if (state.objects !== prevState.objects) {
          this.handleLocalChange(state.objects, prevState.objects);
        }
      }
    );

    // 3. 初期同期（Yjsの既存データをローカルに反映）
    this.performInitialSync();

    this.isInitialized = true;
    this.log('info', 'Initialized');
  }

  /**
   * 同期を終了
   *
   * イベントリスナーを解除し、リソースを解放する。
   */
  destroy(): void {
    if (!this.isInitialized) {
      this.log('warn', 'Not initialized, skipping destroy');
      return;
    }

    this.log('info', 'Destroying...');

    // Yjs Y.Map の監視を解除
    this.yObjects.unobserve(this.handleYjsChange);

    // Zustand の監視を解除
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    this.isInitialized = false;
    this.syncState = 'idle';

    this.log('info', 'Destroyed');
  }

  /**
   * 初期同期を実行
   *
   * Yjsに既存データがあればローカルに反映し、
   * ローカルにのみデータがあればYjsに反映する。
   */
  private performInitialSync(): void {
    const remoteObjects = this.getObjectsFromYjs();
    const localObjects = useCanvasStore.getState().objects;

    if (remoteObjects.length > 0) {
      // Yjsにデータがある場合はローカルに反映（リモートデータ優先）
      this.log('info', `Initial sync: ${remoteObjects.length} objects from Yjs`);
      this.isProcessingRemoteChange = true;
      useCanvasStore.getState().setObjects(remoteObjects, { source: 'sync' });
      this.isProcessingRemoteChange = false;
    } else if (localObjects.length > 0) {
      // ローカルにのみデータがある場合はYjsに反映
      this.log('info', `Initial sync: ${localObjects.length} objects to Yjs`);
      this.syncAllToYjs(localObjects);
    } else {
      this.log('info', 'Initial sync: No data to sync');
    }
  }

  /**
   * Yjs Y.Map の変更ハンドラー
   *
   * リモートからの変更を検出し、ローカルストアに反映する。
   */
  private handleYjsChange = (event: Y.YMapEvent<GridObject>): void => {
    // ローカル変更（自分がトリガー）の場合はスキップ
    if (event.transaction.origin === SYNC_ORIGIN.LOCAL) {
      this.log('debug', 'Skipping local-originated Yjs change');
      return;
    }

    this.log('info', 'Yjs change detected', {
      keysChanged: event.changes.keys.size,
      origin: event.transaction.origin,
    });

    this.syncState = 'syncing';

    // Yjsの現在の状態をローカルに反映
    const objects = this.getObjectsFromYjs();

    this.isProcessingRemoteChange = true;
    useCanvasStore.getState().setObjects(objects, { source: 'sync' });
    this.isProcessingRemoteChange = false;

    this.syncState = 'idle';
  };

  /**
   * canvasStore の変更ハンドラー
   *
   * ローカルの変更を検出し、Yjsに反映する。
   */
  private handleLocalChange = (
    objects: GridObject[],
    prevObjects: GridObject[]
  ): void => {
    // リモート変更処理中の場合はスキップ（無限ループ防止）
    if (this.isProcessingRemoteChange) {
      this.log('debug', 'Skipping local change during remote processing');
      return;
    }

    this.log('debug', 'Local change detected', {
      prevCount: prevObjects.length,
      newCount: objects.length,
    });

    // 差分を計算してYjsに反映
    this.syncDiffToYjs(prevObjects, objects);
  };

  /**
   * 差分をYjsに同期
   *
   * 追加・更新・削除の差分を検出し、変更のあったオブジェクトのみをYjsに反映する。
   */
  private syncDiffToYjs(
    prevObjects: GridObject[],
    newObjects: GridObject[]
  ): void {
    const prevMap = new Map(prevObjects.map((o) => [o.id, o]));
    const newMap = new Map(newObjects.map((o) => [o.id, o]));

    let hasChanges = false;

    this.ydoc.transact(() => {
      // 削除されたオブジェクト
      for (const [id] of prevMap) {
        if (!newMap.has(id)) {
          this.yObjects.delete(id);
          this.log('debug', `Deleted object: ${id}`);
          hasChanges = true;
        }
      }

      // 追加・更新されたオブジェクト
      for (const [id, obj] of newMap) {
        const prevObj = prevMap.get(id);
        if (!prevObj || !this.deepEqual(prevObj, obj)) {
          // GridObjectをプレーンオブジェクトとして保存
          this.yObjects.set(id, this.toPlainObject(obj));
          this.log('debug', `${prevObj ? 'Updated' : 'Added'} object: ${id}`);
          hasChanges = true;
        }
      }
    }, SYNC_ORIGIN.LOCAL);

    if (hasChanges) {
      this.log('info', `Synced diff to Yjs`, {
        prevCount: prevObjects.length,
        newCount: newObjects.length,
      });
    }
  }

  /**
   * 全オブジェクトをYjsに同期
   *
   * 初期同期時に使用。既存データをクリアして全オブジェクトを追加する。
   */
  private syncAllToYjs(objects: GridObject[]): void {
    this.ydoc.transact(() => {
      // 既存データをクリア
      this.yObjects.clear();
      // 全オブジェクトを追加
      for (const obj of objects) {
        this.yObjects.set(obj.id, this.toPlainObject(obj));
      }
    }, SYNC_ORIGIN.LOCAL);

    this.log('info', `Synced all ${objects.length} objects to Yjs`);
  }

  /**
   * YjsからオブジェクトリストをJSONとして取得
   */
  private getObjectsFromYjs(): GridObject[] {
    const objects: GridObject[] = [];
    this.yObjects.forEach((value, key) => {
      // Yjsから取得したオブジェクトをコピーしてIDを確保
      objects.push({ ...value, id: key });
    });
    return objects;
  }

  /**
   * GridObjectをプレーンオブジェクトに変換（Yjs保存用）
   *
   * Yjsに保存する際はプレーンオブジェクトに変換する必要がある。
   */
  private toPlainObject(obj: GridObject): GridObject {
    return JSON.parse(JSON.stringify(obj)) as GridObject;
  }

  /**
   * 深い等価比較
   *
   * JSON.stringify を使用して2つのオブジェクトを比較する。
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * ログ出力
   *
   * デバッグモードの場合のみログを出力する。
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!isDebug()) return;

    const prefix = '[SyncManager]';
    const formattedMessage = data
      ? `${prefix} ${message} ${JSON.stringify(data)}`
      : `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        // debug レベルは通常無視（必要に応じて console.log に変更）
        break;
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  /**
   * 現在の同期状態を取得（デバッグ用）
   *
   * 同期マネージャーの内部状態を返す。
   */
  getState(): SyncManagerDebugState {
    return {
      localCount: useCanvasStore.getState().objects.length,
      yjsCount: this.yObjects.size,
      isProcessingRemoteChange: this.isProcessingRemoteChange,
      isInitialized: this.isInitialized,
      syncState: this.syncState,
    };
  }

  /**
   * 同期状態を取得
   */
  getSyncState(): SyncState {
    return this.syncState;
  }

  /**
   * 初期化済みかどうかを取得
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}
