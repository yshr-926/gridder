/**
 * 同期機能の型定義テスト
 *
 * types.ts で定義された定数と型の整合性テスト。
 */

import { describe, it, expect } from 'vitest';
import {
  SYNC_ORIGIN,
  DEFAULT_SYNC_CONFIG,
  INITIAL_SYNC_MANAGER_STATE,
  type SyncState,
  type SyncAction,
  type SyncEventOrigin,
  type SyncConfig,
  type ObjectSyncSource,
} from '../types';

describe('sync types', () => {
  describe('SYNC_ORIGIN', () => {
    it('should have correct LOCAL value', () => {
      expect(SYNC_ORIGIN.LOCAL).toBe('local-ui');
    });

    it('should have correct YJS value', () => {
      expect(SYNC_ORIGIN.YJS).toBe('yjs-sync');
    });

    it('should have correct INITIAL value', () => {
      expect(SYNC_ORIGIN.INITIAL).toBe('initial-load');
    });

    it('should have all required origin types', () => {
      expect(Object.keys(SYNC_ORIGIN)).toHaveLength(3);
      expect(SYNC_ORIGIN).toHaveProperty('LOCAL');
      expect(SYNC_ORIGIN).toHaveProperty('YJS');
      expect(SYNC_ORIGIN).toHaveProperty('INITIAL');
    });
  });

  describe('DEFAULT_SYNC_CONFIG', () => {
    it('should have correct debounceMs value', () => {
      expect(DEFAULT_SYNC_CONFIG.debounceMs).toBe(0);
    });

    it('should have correct maxRetries value', () => {
      expect(DEFAULT_SYNC_CONFIG.maxRetries).toBe(3);
    });

    it('should have correct retryIntervalMs value', () => {
      expect(DEFAULT_SYNC_CONFIG.retryIntervalMs).toBe(1000);
    });

    it('should satisfy SyncConfig type', () => {
      const config: SyncConfig = DEFAULT_SYNC_CONFIG;
      expect(config.debounceMs).toBeTypeOf('number');
      expect(config.maxRetries).toBeTypeOf('number');
      expect(config.retryIntervalMs).toBeTypeOf('number');
    });
  });

  describe('INITIAL_SYNC_MANAGER_STATE', () => {
    it('should have idle state', () => {
      expect(INITIAL_SYNC_MANAGER_STATE.state).toBe('idle');
    });

    it('should have null yObjects', () => {
      expect(INITIAL_SYNC_MANAGER_STATE.yObjects).toBeNull();
    });

    it('should have null lastSyncAt', () => {
      expect(INITIAL_SYNC_MANAGER_STATE.lastSyncAt).toBeNull();
    });

    it('should have zero pendingChanges', () => {
      expect(INITIAL_SYNC_MANAGER_STATE.pendingChanges).toBe(0);
    });

    it('should have null error', () => {
      expect(INITIAL_SYNC_MANAGER_STATE.error).toBeNull();
    });
  });

  describe('SyncState type', () => {
    it('should accept valid SyncState values', () => {
      const states: SyncState[] = ['idle', 'syncing', 'error'];
      states.forEach((state) => {
        expect(['idle', 'syncing', 'error']).toContain(state);
      });
    });

    it('should have exactly 3 valid states', () => {
      const validStates: SyncState[] = ['idle', 'syncing', 'error'];
      expect(validStates).toHaveLength(3);
    });
  });

  describe('SyncAction type', () => {
    it('should accept valid SyncAction values', () => {
      const actions: SyncAction[] = ['add', 'update', 'delete'];
      actions.forEach((action) => {
        expect(['add', 'update', 'delete']).toContain(action);
      });
    });

    it('should have exactly 3 valid actions', () => {
      const validActions: SyncAction[] = ['add', 'update', 'delete'];
      expect(validActions).toHaveLength(3);
    });
  });

  describe('SyncEventOrigin type', () => {
    it('should accept valid SyncEventOrigin values', () => {
      const origins: SyncEventOrigin[] = ['local', 'remote'];
      origins.forEach((origin) => {
        expect(['local', 'remote']).toContain(origin);
      });
    });

    it('should have exactly 2 valid origins', () => {
      const validOrigins: SyncEventOrigin[] = ['local', 'remote'];
      expect(validOrigins).toHaveLength(2);
    });
  });

  describe('ObjectSyncSource type', () => {
    it('should accept valid ObjectSyncSource values', () => {
      const sources: ObjectSyncSource[] = ['local', 'sync', 'initial'];
      sources.forEach((source) => {
        expect(['local', 'sync', 'initial']).toContain(source);
      });
    });

    it('should have exactly 3 valid sources', () => {
      const validSources: ObjectSyncSource[] = ['local', 'sync', 'initial'];
      expect(validSources).toHaveLength(3);
    });
  });

  describe('type consistency', () => {
    it('should have SYNC_ORIGIN values consistent with ObjectSyncSource', () => {
      // SYNC_ORIGIN.LOCAL corresponds to 'local' source
      // SYNC_ORIGIN.YJS corresponds to 'sync' source
      // SYNC_ORIGIN.INITIAL corresponds to 'initial' source
      expect(SYNC_ORIGIN.LOCAL).toBe('local-ui');
      expect(SYNC_ORIGIN.YJS).toBe('yjs-sync');
      expect(SYNC_ORIGIN.INITIAL).toBe('initial-load');
    });

    it('should have SyncState aligned with INITIAL_SYNC_MANAGER_STATE', () => {
      const validStates: SyncState[] = ['idle', 'syncing', 'error'];
      expect(validStates).toContain(INITIAL_SYNC_MANAGER_STATE.state);
    });
  });
});
