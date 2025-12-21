/**
 * useLocalPresence フックのテスト
 *
 * @module features/collaboration/__tests__/useLocalPresence.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalPresence } from '../useLocalPresence';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { Presence } from '../types';

// useCanvasStore のモック
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: vi.fn(),
}));

describe('useLocalPresence', () => {
  const mockSelectedIds: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();

    // useCanvasStore のモック設定
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const state = {
        selection: {
          selectedIds: mockSelectedIds,
          primaryId: null,
          mode: 'single' as const,
        },
      };
      return selector(state as Parameters<typeof selector>[0]);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('updateCursor', () => {
    it('should update cursor position', () => {
      const { result } = renderHook(() => useLocalPresence());

      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
      });

      expect(result.current.getCursor()).toEqual({ x: 5, y: 10 });
    });

    it('should allow null cursor position', () => {
      const { result } = renderHook(() => useLocalPresence());

      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
      });

      expect(result.current.getCursor()).toEqual({ x: 5, y: 10 });

      act(() => {
        result.current.updateCursor(null);
      });

      expect(result.current.getCursor()).toBeNull();
    });

    it('should call onPresenceChange with cursor update', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange })
      );

      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { x: 5, y: 10 },
          updatedAt: expect.any(String),
        })
      );
    });

    it('should include userId when provided', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange, userId: 'user-123' })
      );

      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          cursor: { x: 5, y: 10 },
        })
      );
    });
  });

  describe('throttling', () => {
    it('should throttle cursor updates with default 50ms', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange, autoTrackSelection: false })
      );

      // 連続して更新
      act(() => {
        result.current.updateCursor({ x: 1, y: 1 });
        result.current.updateCursor({ x: 2, y: 2 });
        result.current.updateCursor({ x: 3, y: 3 });
      });

      // スロットリングにより最初の1回のみ即座に呼ばれる
      expect(onPresenceChange).toHaveBeenCalledTimes(1);
      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { x: 1, y: 1 },
        })
      );

      // スロットリング時間経過後に最後の更新が反映される
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledTimes(2);
    });

    it('should respect custom throttle time', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange, throttleMs: 100, autoTrackSelection: false })
      );

      act(() => {
        result.current.updateCursor({ x: 1, y: 1 });
      });

      expect(onPresenceChange).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.updateCursor({ x: 2, y: 2 });
        vi.advanceTimersByTime(50);
      });

      // 50ms後ではまだ呼ばれない
      expect(onPresenceChange).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(50);
      });

      // 100ms後に呼ばれる
      expect(onPresenceChange).toHaveBeenCalledTimes(2);
    });

    it('should not call onPresenceChange when not provided', () => {
      const { result } = renderHook(() => useLocalPresence());

      // エラーなく動作することを確認
      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
        vi.advanceTimersByTime(50);
      });

      expect(result.current.getCursor()).toEqual({ x: 5, y: 10 });
    });
  });

  describe('selection tracking', () => {
    it('should return selected IDs from store', () => {
      const testSelectedIds = ['obj-1', 'obj-2'];
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          selection: {
            selectedIds: testSelectedIds,
            primaryId: 'obj-1',
            mode: 'multiple' as const,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const { result } = renderHook(() => useLocalPresence());

      expect(result.current.getSelectedIds()).toEqual(['obj-1', 'obj-2']);
    });

    it('should call onPresenceChange when selection changes', () => {
      const onPresenceChange = vi.fn();
      let currentSelectedIds: string[] = [];

      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          selection: {
            selectedIds: currentSelectedIds,
            primaryId: currentSelectedIds[0] ?? null,
            mode: currentSelectedIds.length > 1 ? 'multiple' : ('single' as const),
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const { rerender } = renderHook(() =>
        useLocalPresence({ onPresenceChange })
      );

      // 選択状態を変更
      currentSelectedIds = ['obj-1'];
      rerender();

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedObjectIds: ['obj-1'],
        })
      );
    });

    it('should not auto-track selection when autoTrackSelection is false', () => {
      const onPresenceChange = vi.fn();
      let currentSelectedIds: string[] = [];

      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          selection: {
            selectedIds: currentSelectedIds,
            primaryId: null,
            mode: 'single' as const,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const { result, rerender } = renderHook(() =>
        useLocalPresence({ onPresenceChange, autoTrackSelection: false })
      );

      // 選択状態を変更
      currentSelectedIds = ['obj-1'];
      rerender();

      act(() => {
        vi.advanceTimersByTime(50);
      });

      // autoTrackSelection が false なので呼ばれない
      expect(onPresenceChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          selectedObjectIds: ['obj-1'],
        })
      );

      // 手動更新は動作する
      act(() => {
        result.current.updateSelection(['obj-2', 'obj-3']);
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedObjectIds: ['obj-2', 'obj-3'],
        })
      );
    });
  });

  describe('updateSelection', () => {
    it('should manually update selection', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange, autoTrackSelection: false })
      );

      act(() => {
        result.current.updateSelection(['obj-1', 'obj-2']);
        vi.advanceTimersByTime(50);
      });

      expect(onPresenceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedObjectIds: ['obj-1', 'obj-2'],
        })
      );

      expect(result.current.getSelectedIds()).toEqual(['obj-1', 'obj-2']);
    });
  });

  describe('getPresence', () => {
    it('should return current presence state', () => {
      const { result } = renderHook(() =>
        useLocalPresence({ userId: 'user-123' })
      );

      act(() => {
        result.current.updateCursor({ x: 10, y: 20 });
      });

      const presence = result.current.getPresence();

      expect(presence).toMatchObject({
        userId: 'user-123',
        cursor: { x: 10, y: 20 },
        selectedObjectIds: [],
        updatedAt: expect.any(String),
      });
    });

    it('should return presence without userId when not provided', () => {
      const { result } = renderHook(() => useLocalPresence());

      const presence = result.current.getPresence();

      expect(presence.userId).toBeUndefined();
      expect(presence.cursor).toBeNull();
      expect(presence.selectedObjectIds).toEqual([]);
      expect(presence.updatedAt).toBeDefined();
    });

    it('should return presence with selection from store when autoTrackSelection is true', () => {
      const testSelectedIds = ['obj-1', 'obj-2'];
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          selection: {
            selectedIds: testSelectedIds,
            primaryId: 'obj-1',
            mode: 'multiple' as const,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const { result } = renderHook(() => useLocalPresence());

      const presence = result.current.getPresence();

      expect(presence.selectedObjectIds).toEqual(['obj-1', 'obj-2']);
    });
  });

  describe('updatedAt', () => {
    it('should include ISO 8601 formatted timestamp', () => {
      const onPresenceChange = vi.fn();
      const { result } = renderHook(() =>
        useLocalPresence({ onPresenceChange })
      );

      act(() => {
        result.current.updateCursor({ x: 5, y: 10 });
        vi.advanceTimersByTime(50);
      });

      const call = onPresenceChange.mock.calls[0][0] as Partial<Presence>;
      expect(call.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      );
    });
  });
});
