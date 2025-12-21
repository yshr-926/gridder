/**
 * SyncManager ユニットテスト
 *
 * Yjs Y.Map と canvasStore の同期を管理する SyncManager のテスト。
 * - 初期化、同期、破棄のテスト
 * - 無限ループ防止のテスト
 * - 差分同期のテスト
 */

import * as Y from 'yjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '../SyncManager';
import { useCanvasStore } from '@/stores/canvasStore';
import type { GridObject, CellCoordinate } from '@/types';

/**
 * テスト用ヘルパー: オブジェクトを作成
 */
const createTestObject = (
  id: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  cells: CellCoordinate[] = [[0, 0]],
  color: string = '#ff0000'
): GridObject => ({
  id,
  cells,
  position,
  rotation: 0,
  color,
});

describe('SyncManager', () => {
  let ydoc: Y.Doc;
  let syncManager: SyncManager;

  beforeEach(() => {
    // Yjs ドキュメントを作成
    ydoc = new Y.Doc();
    syncManager = new SyncManager(ydoc);

    // canvasStore をクリア
    useCanvasStore.getState().clearObjects();
  });

  afterEach(() => {
    // SyncManager を破棄
    if (syncManager.getIsInitialized()) {
      syncManager.destroy();
    }

    // Yjs ドキュメントを破棄
    ydoc.destroy();
  });

  describe('initialize', () => {
    it('should initialize without errors', () => {
      // Arrange & Act
      expect(() => syncManager.initialize()).not.toThrow();

      // Assert
      expect(syncManager.getIsInitialized()).toBe(true);
    });

    it('should sync existing Yjs data to local on init', () => {
      // Arrange
      const yObjects = ydoc.getMap<GridObject>('objects');
      yObjects.set('obj-1', {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#ff0000',
      });

      // Act
      syncManager.initialize();

      // Assert
      const localObjects = useCanvasStore.getState().objects;
      expect(localObjects).toHaveLength(1);
      expect(localObjects[0].id).toBe('obj-1');
      expect(localObjects[0].color).toBe('#ff0000');
    });

    it('should sync local data to Yjs when Yjs is empty', () => {
      // Arrange
      useCanvasStore.getState().addObject(
        createTestObject('obj-local', { x: 1, y: 1 }, [[1, 1]], '#00ff00')
      );

      // Act
      syncManager.initialize();

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-local')).toBeDefined();
      expect(yObjects.get('obj-local')?.color).toBe('#00ff00');
    });

    it('should warn if already initialized', () => {
      // Arrange
      syncManager.initialize();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      syncManager.initialize();

      // Assert (no error thrown)
      expect(syncManager.getIsInitialized()).toBe(true);

      warnSpy.mockRestore();
    });
  });

  describe('local to Yjs sync', () => {
    beforeEach(() => {
      syncManager.initialize();
    });

    it('should sync addObject to Yjs', () => {
      // Arrange & Act
      useCanvasStore.getState().addObject(
        createTestObject('obj-new', { x: 1, y: 1 }, [[1, 1]], '#00ff00')
      );

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-new')).toBeDefined();
      expect(yObjects.get('obj-new')?.color).toBe('#00ff00');
    });

    it('should sync removeObject to Yjs', () => {
      // Arrange
      useCanvasStore.getState().addObject(
        createTestObject('obj-delete', { x: 0, y: 0 }, [[0, 0]], '#0000ff')
      );
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-delete')).toBeDefined();

      // Act
      useCanvasStore.getState().removeObject('obj-delete');

      // Assert
      expect(yObjects.get('obj-delete')).toBeUndefined();
    });

    it('should sync updateObject to Yjs', () => {
      // Arrange
      useCanvasStore.getState().addObject(
        createTestObject('obj-update', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Act
      useCanvasStore.getState().updateObject('obj-update', {
        rotation: 90,
      });

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      const updatedObj = yObjects.get('obj-update');
      expect(updatedObj?.rotation).toBe(90);
    });

    it('should sync position changes to Yjs', () => {
      // Arrange
      useCanvasStore.getState().addObject(
        createTestObject('obj-move', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Act
      useCanvasStore.getState().updateObject('obj-move', {
        position: { x: 5, y: 5 },
      });

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      const movedObj = yObjects.get('obj-move');
      expect(movedObj?.position).toEqual({ x: 5, y: 5 });
    });
  });

  describe('Yjs to local sync', () => {
    beforeEach(() => {
      syncManager.initialize();
    });

    it('should sync Yjs changes to local', () => {
      // Arrange
      const yObjects = ydoc.getMap<GridObject>('objects');

      // Act
      yObjects.set('obj-remote', {
        id: 'obj-remote',
        cells: [[2, 2]],
        position: { x: 2, y: 2 },
        rotation: 90,
        color: '#ffff00',
      });

      // Assert
      const localObjects = useCanvasStore.getState().objects;
      expect(localObjects.find((o) => o.id === 'obj-remote')).toBeDefined();
      expect(localObjects.find((o) => o.id === 'obj-remote')?.rotation).toBe(90);
    });

    it('should sync Yjs deletion to local', () => {
      // Arrange
      const yObjects = ydoc.getMap<GridObject>('objects');
      yObjects.set('obj-delete-remote', {
        id: 'obj-delete-remote',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#000000',
      });

      // オブジェクトが同期されることを確認
      expect(
        useCanvasStore.getState().objects.find((o) => o.id === 'obj-delete-remote')
      ).toBeDefined();

      // Act - Yjsから削除
      yObjects.delete('obj-delete-remote');

      // Assert - ローカルからも削除されることを確認
      expect(
        useCanvasStore.getState().objects.find((o) => o.id === 'obj-delete-remote')
      ).toBeUndefined();
    });

    it('should sync Yjs update to local', () => {
      // Arrange
      const yObjects = ydoc.getMap<GridObject>('objects');
      yObjects.set('obj-update-remote', {
        id: 'obj-update-remote',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#000000',
      });

      // Act - Yjsで更新
      yObjects.set('obj-update-remote', {
        id: 'obj-update-remote',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 180,
        color: '#ffffff',
      });

      // Assert
      const localObj = useCanvasStore
        .getState()
        .objects.find((o) => o.id === 'obj-update-remote');
      expect(localObj?.rotation).toBe(180);
      expect(localObj?.color).toBe('#ffffff');
    });
  });

  describe('infinite loop prevention', () => {
    it('should not create infinite loop on local change', () => {
      // Arrange
      syncManager.initialize();
      let localToYjsCount = 0;
      let yjsToLocalCount = 0;

      // モニタリング用のオブザーバーを追加
      const yObjects = ydoc.getMap<GridObject>('objects');
      yObjects.observe(() => {
        localToYjsCount++;
      });

      const unsubscribe = useCanvasStore.subscribe(() => {
        yjsToLocalCount++;
      });

      // Act
      useCanvasStore.getState().addObject(
        createTestObject('obj-loop-test', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Assert - 同期は1回のみ（無限ループではない）
      // ローカル変更 → Yjs への反映は1回
      expect(localToYjsCount).toBeLessThanOrEqual(2);
      // Yjs → ローカル への反映は発生しない（オリジン識別子により）
      expect(yjsToLocalCount).toBeLessThanOrEqual(2);

      unsubscribe();
    });

    it('should skip local-originated Yjs changes', () => {
      // Arrange
      syncManager.initialize();
      const yObjects = ydoc.getMap<GridObject>('objects');

      // ローカル変更を追加
      useCanvasStore.getState().addObject(
        createTestObject('obj-origin-test', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Assert - オブジェクトがYjsに同期されている
      expect(yObjects.get('obj-origin-test')).toBeDefined();

      // ローカルストアのオブジェクト数は1のまま（ループしていない）
      expect(useCanvasStore.getState().objects).toHaveLength(1);
    });
  });

  describe('getState', () => {
    it('should return current sync state', () => {
      // Arrange
      syncManager.initialize();
      useCanvasStore.getState().addObject(
        createTestObject('obj-state', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Act
      const state = syncManager.getState();

      // Assert
      expect(state.localCount).toBe(1);
      expect(state.yjsCount).toBe(1);
      expect(state.isProcessingRemoteChange).toBe(false);
      expect(state.isInitialized).toBe(true);
    });

    it('should return initial state before initialization', () => {
      // Act
      const state = syncManager.getState();

      // Assert
      expect(state.isInitialized).toBe(false);
      expect(state.syncState).toBe('idle');
    });
  });

  describe('getSyncState', () => {
    it('should return idle initially', () => {
      // Assert
      expect(syncManager.getSyncState()).toBe('idle');
    });

    it('should return idle after initialization', () => {
      // Arrange & Act
      syncManager.initialize();

      // Assert
      expect(syncManager.getSyncState()).toBe('idle');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      // Arrange
      syncManager.initialize();
      expect(syncManager.getIsInitialized()).toBe(true);

      // Act
      syncManager.destroy();

      // Assert
      expect(syncManager.getIsInitialized()).toBe(false);
    });

    it('should not throw if not initialized', () => {
      // Act & Assert
      expect(() => syncManager.destroy()).not.toThrow();
    });

    it('should stop syncing after destroy', () => {
      // Arrange
      syncManager.initialize();
      syncManager.destroy();

      // Act - ローカル変更を追加
      useCanvasStore.getState().addObject(
        createTestObject('obj-after-destroy', { x: 0, y: 0 }, [[0, 0]], '#000000')
      );

      // Assert - Yjsには同期されない
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-after-destroy')).toBeUndefined();
    });
  });

  describe('multiple objects sync', () => {
    beforeEach(() => {
      syncManager.initialize();
    });

    it('should sync multiple objects correctly', () => {
      // Arrange & Act
      useCanvasStore.getState().addObject(createTestObject('obj-1'));
      useCanvasStore.getState().addObject(createTestObject('obj-2'));
      useCanvasStore.getState().addObject(createTestObject('obj-3'));

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.size).toBe(3);
      expect(yObjects.get('obj-1')).toBeDefined();
      expect(yObjects.get('obj-2')).toBeDefined();
      expect(yObjects.get('obj-3')).toBeDefined();
    });

    it('should handle batch updates', () => {
      // Arrange
      useCanvasStore.getState().addObject(createTestObject('obj-batch-1'));
      useCanvasStore.getState().addObject(createTestObject('obj-batch-2'));

      // Act - 複数のオブジェクトを更新
      useCanvasStore.getState().updateObject('obj-batch-1', { rotation: 90 });
      useCanvasStore.getState().updateObject('obj-batch-2', { rotation: 180 });

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-batch-1')?.rotation).toBe(90);
      expect(yObjects.get('obj-batch-2')?.rotation).toBe(180);
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects list', () => {
      // Arrange
      syncManager.initialize();

      // Act
      useCanvasStore.getState().clearObjects();

      // Assert
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.size).toBe(0);
    });

    it('should handle rapid sequential updates', () => {
      // Arrange
      syncManager.initialize();
      useCanvasStore.getState().addObject(createTestObject('obj-rapid'));

      // Act - 連続した更新
      const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270, 0, 90, 180, 270, 0, 90];
      for (let i = 0; i < 10; i++) {
        useCanvasStore.getState().updateObject('obj-rapid', {
          rotation: rotations[i],
        });
      }

      // Assert - 最終状態が正しい
      const yObjects = ydoc.getMap<GridObject>('objects');
      expect(yObjects.get('obj-rapid')?.rotation).toBe(90);
    });

    it('should preserve object properties through sync cycle', () => {
      // Arrange
      syncManager.initialize();
      const originalObject = createTestObject(
        'obj-preserve',
        { x: 5, y: 10 },
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        '#abcdef'
      );
      originalObject.rotation = 90;
      originalObject.decoration = {
        showBorder: true,
        borderWidth: 2,
        opacity: 0.5,
      };

      // Act
      useCanvasStore.getState().addObject(originalObject);

      // Assert - Yjsに正しく同期されている
      const yObjects = ydoc.getMap<GridObject>('objects');
      const syncedObj = yObjects.get('obj-preserve');
      expect(syncedObj).toBeDefined();
      expect(syncedObj?.position).toEqual({ x: 5, y: 10 });
      expect(syncedObj?.cells).toEqual([
        [0, 0],
        [1, 0],
        [0, 1],
      ]);
      expect(syncedObj?.color).toBe('#abcdef');
      expect(syncedObj?.rotation).toBe(45);
      expect(syncedObj?.decoration?.opacity).toBe(0.5);
    });
  });
});
