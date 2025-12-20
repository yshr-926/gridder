/**
 * 共同編集ストアのテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// モックのセットアップ
const mockAwareness = {
  setLocalStateField: vi.fn(),
  getStates: vi.fn(() => new Map()),
  on: vi.fn(),
  off: vi.fn(),
};

const mockProvider = {
  awareness: mockAwareness,
  disconnect: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn((event: string, callback: () => void) => {
    if (event === 'connect') {
      // 接続成功をシミュレート
      setTimeout(callback, 0);
    }
  }),
};

const mockDoc = {
  clientID: 12345,
  destroy: vi.fn(),
};

const mockIndexeddbProvider = {
  destroy: vi.fn(),
};

// HocuspocusProvider のモック
vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: vi.fn().mockImplementation(function (
    this: typeof mockProvider,
    options: { onConnect?: () => void }
  ) {
    // onConnect を遅延して呼び出す
    setTimeout(() => {
      if (options.onConnect) {
        options.onConnect();
      }
    }, 10);
    Object.assign(this, mockProvider);
    return this;
  }),
}));

// yjs のモック（名前空間インポート対応）
vi.mock('yjs', () => {
  const MockDoc = vi.fn().mockImplementation(function (this: typeof mockDoc) {
    Object.assign(this, mockDoc);
    return this;
  });
  return {
    Doc: MockDoc,
    default: { Doc: MockDoc },
  };
});

// y-indexeddb のモック
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(function (
    this: typeof mockIndexeddbProvider
  ) {
    Object.assign(this, mockIndexeddbProvider);
    return this;
  }),
}));

// import.meta.env のモック
vi.stubEnv('VITE_WS_URL', 'ws://test-server:3001');
vi.stubEnv('MODE', 'test');

// ストアのインポート（モックの後に行う）
import { useCollaborationStore, getYDoc, getProvider } from './collaborationStore';

describe('useCollaborationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ストアをリセット
    act(() => {
      useCollaborationStore.getState().reset();
    });
  });

  afterEach(() => {
    // テスト後にクリーンアップ
    act(() => {
      useCollaborationStore.getState().reset();
    });
  });

  describe('初期状態', () => {
    it('初期状態が正しく設定されていること', () => {
      const state = useCollaborationStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.room).toBeNull();
      expect(state.self).toBeNull();
      expect(state.collaborators).toEqual([]);
      expect(state.presences).toEqual(new Map());
      expect(state.error).toBeNull();
    });
  });

  describe('connect', () => {
    it('接続中の状態が設定されること', async () => {
      const connectPromise = act(async () => {
        await useCollaborationStore.getState().connect('room-123', 'TestUser');
      });

      // 接続中の状態を確認（即座に確認）
      const stateWhileConnecting = useCollaborationStore.getState();
      expect(stateWhileConnecting.connectionState).toBe('connecting');

      await connectPromise;
    });

    it('接続成功時に状態が更新されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-123', 'TestUser');
      });

      const state = useCollaborationStore.getState();
      expect(state.connectionState).toBe('connected');
      expect(state.room).not.toBeNull();
      expect(state.room?.id).toBe('room-123');
      expect(state.self).not.toBeNull();
      expect(state.self?.displayName).toBe('TestUser');
      expect(state.self?.id).toBe('12345'); // mockDoc.clientID
    });

    it('ルーム情報が正しく設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('test-room', 'User1');
      });

      const state = useCollaborationStore.getState();
      expect(state.room?.id).toBe('test-room');
      expect(state.room?.createdAt).toBeDefined();
      expect(state.room?.participants).toBeDefined();
    });

    it('自分のユーザー情報が正しく設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'MyName');
      });

      const state = useCollaborationStore.getState();
      expect(state.self?.displayName).toBe('MyName');
      expect(state.self?.color).toBeDefined();
      expect(state.self?.connectedAt).toBeDefined();
    });

    it('Awareness に自分の情報が設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'TestUser');
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('user', {
        name: 'TestUser',
        color: expect.any(String),
        connectedAt: expect.any(String),
      });
    });

    it('パスフレーズ付きで接続できること', async () => {
      const { HocuspocusProvider } = await import('@hocuspocus/provider');

      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User', 'secret123');
      });

      expect(HocuspocusProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'secret123',
        })
      );
    });
  });

  describe('disconnect', () => {
    it('切断時に状態がリセットされること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      expect(useCollaborationStore.getState().connectionState).toBe('connected');

      act(() => {
        useCollaborationStore.getState().disconnect();
      });

      const state = useCollaborationStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.room).toBeNull();
      expect(state.self).toBeNull();
      expect(state.collaborators).toEqual([]);
      expect(state.presences).toEqual(new Map());
    });

    it('Provider が正しく破棄されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      act(() => {
        useCollaborationStore.getState().disconnect();
      });

      expect(mockProvider.disconnect).toHaveBeenCalled();
      expect(mockProvider.destroy).toHaveBeenCalled();
    });

    it('IndexedDB Provider が破棄されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      act(() => {
        useCollaborationStore.getState().disconnect();
      });

      expect(mockIndexeddbProvider.destroy).toHaveBeenCalled();
    });

    it('Yjs ドキュメントが破棄されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      act(() => {
        useCollaborationStore.getState().disconnect();
      });

      expect(mockDoc.destroy).toHaveBeenCalled();
    });
  });

  describe('updateDisplayName', () => {
    it('表示名が更新されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'OldName');
      });

      act(() => {
        useCollaborationStore.getState().updateDisplayName('NewName');
      });

      expect(useCollaborationStore.getState().self?.displayName).toBe('NewName');
    });

    it('Awareness に新しい表示名が設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'OldName');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updateDisplayName('NewName');
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          name: 'NewName',
        })
      );
    });

    it('未接続時は何もしないこと', () => {
      act(() => {
        useCollaborationStore.getState().updateDisplayName('NewName');
      });

      // エラーが発生しないこと
      expect(useCollaborationStore.getState().self).toBeNull();
    });
  });

  describe('updateCursor', () => {
    it('カーソル位置が Awareness に設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updateCursor({ x: 10, y: 20 });
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', {
        x: 10,
        y: 20,
      });
    });

    it('カーソル位置を null に設定できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updateCursor(null);
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', null);
    });
  });

  describe('updateSelection', () => {
    it('選択オブジェクトが Awareness に設定されること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updateSelection(['obj-1', 'obj-2']);
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('selectedObjectIds', [
        'obj-1',
        'obj-2',
      ]);
    });

    it('空の配列を設定できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updateSelection([]);
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('selectedObjectIds', []);
    });
  });

  describe('updatePresence', () => {
    it('カーソルと選択を一括更新できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updatePresence({
          cursor: { x: 5, y: 10 },
          selectedObjectIds: ['obj-1'],
        });
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', { x: 5, y: 10 });
      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('selectedObjectIds', ['obj-1']);
    });

    it('カーソルのみ更新できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      mockAwareness.setLocalStateField.mockClear();

      act(() => {
        useCollaborationStore.getState().updatePresence({
          cursor: { x: 15, y: 25 },
        });
      });

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', { x: 15, y: 25 });
      expect(mockAwareness.setLocalStateField).not.toHaveBeenCalledWith(
        'selectedObjectIds',
        expect.anything()
      );
    });
  });

  describe('setError', () => {
    it('エラーが設定されること', () => {
      act(() => {
        useCollaborationStore.getState().setError('Test error message');
      });

      const state = useCollaborationStore.getState();
      expect(state.error).toBe('Test error message');
      expect(state.connectionState).toBe('error');
    });

    it('エラーをクリアできること', () => {
      act(() => {
        useCollaborationStore.getState().setError('Error');
      });

      act(() => {
        useCollaborationStore.getState().setError(null);
      });

      expect(useCollaborationStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('状態が初期状態にリセットされること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      act(() => {
        useCollaborationStore.getState().reset();
      });

      const state = useCollaborationStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.room).toBeNull();
      expect(state.self).toBeNull();
      expect(state.collaborators).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('getYDoc', () => {
    it('接続後に Yjs ドキュメントを取得できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      const doc = useCollaborationStore.getState().getYDoc();
      expect(doc).not.toBeNull();
    });

    it('未接続時は null を返すこと', () => {
      const doc = useCollaborationStore.getState().getYDoc();
      expect(doc).toBeNull();
    });
  });

  describe('getProvider', () => {
    it('接続後に Provider を取得できること', async () => {
      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      const provider = useCollaborationStore.getState().getProvider();
      expect(provider).not.toBeNull();
    });

    it('未接続時は null を返すこと', () => {
      const provider = useCollaborationStore.getState().getProvider();
      expect(provider).toBeNull();
    });
  });

  describe('ヘルパー関数', () => {
    it('getYDoc ヘルパーが動作すること', async () => {
      expect(getYDoc()).toBeNull();

      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      expect(getYDoc()).not.toBeNull();
    });

    it('getProvider ヘルパーが動作すること', async () => {
      expect(getProvider()).toBeNull();

      await act(async () => {
        await useCollaborationStore.getState().connect('room-1', 'User');
      });

      expect(getProvider()).not.toBeNull();
    });
  });
});
