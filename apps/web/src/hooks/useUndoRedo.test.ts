import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { GridObject } from '@/types';

describe('useUndoRedo', () => {
  // テスト用のオブジェクト
  const createMockObject = (id: string, x = 0): GridObject => ({
    id,
    cells: [[0, 0]],
    position: { x, y: 0 },
    rotation: 0,
    color: '#333333',
  });

  beforeEach(() => {
    vi.useFakeTimers();

    // ストアをリセット
    useCanvasStore.setState({
      toolMode: 'draw',
      objects: [],
      selectedObjectId: null,
      drawingCells: [],
      panPosition: { x: 0, y: 0 },
    });

    useHistoryStore.setState({
      past: [],
      future: [],
      maxHistorySize: 50,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleUndo', () => {
    it('should restore previous state when undo is called', () => {
      const previousState = [createMockObject('obj-1')];
      const currentState = [createMockObject('obj-2')];

      // 履歴を設定
      useHistoryStore.setState({
        past: [previousState],
        future: [],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.handleUndo();
        vi.advanceTimersByTime(10); // setTimeout for flag reset
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(previousState);
    });

    it('should do nothing when no history available', () => {
      const currentState = [createMockObject('obj-1')];

      useCanvasStore.setState({
        objects: currentState,
      });

      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.handleUndo();
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(currentState);
    });
  });

  describe('handleRedo', () => {
    it('should restore next state when redo is called', () => {
      const currentState = [createMockObject('obj-1')];
      const nextState = [createMockObject('obj-2')];

      // 履歴を設定
      useHistoryStore.setState({
        past: [],
        future: [nextState],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.handleRedo();
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(nextState);
    });

    it('should do nothing when no future history available', () => {
      const currentState = [createMockObject('obj-1')];

      useCanvasStore.setState({
        objects: currentState,
      });

      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.handleRedo();
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(currentState);
    });
  });

  describe('canUndo / canRedo', () => {
    it('should return correct canUndo status', () => {
      const { result } = renderHook(() => useUndoRedo());

      // 初期状態ではundoできない
      expect(result.current.canUndo).toBe(false);

      // 履歴を追加
      act(() => {
        useHistoryStore.setState({
          past: [[createMockObject('obj-1')]],
        });
      });

      const { result: result2 } = renderHook(() => useUndoRedo());
      expect(result2.current.canUndo).toBe(true);
    });

    it('should return correct canRedo status', () => {
      const { result } = renderHook(() => useUndoRedo());

      // 初期状態ではredoできない
      expect(result.current.canRedo).toBe(false);

      // future履歴を追加
      act(() => {
        useHistoryStore.setState({
          future: [[createMockObject('obj-1')]],
        });
      });

      const { result: result2 } = renderHook(() => useUndoRedo());
      expect(result2.current.canRedo).toBe(true);
    });
  });

  describe('handleClearHistory', () => {
    it('should clear all history', () => {
      useHistoryStore.setState({
        past: [[createMockObject('obj-1')], [createMockObject('obj-2')]],
        future: [[createMockObject('obj-3')]],
      });

      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.handleClearHistory();
      });

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(0);
    });
  });

  describe('auto history recording', () => {
    it('should record history when objects change after debounce', () => {
      const obj1 = createMockObject('obj-1');

      useCanvasStore.setState({
        objects: [obj1],
      });

      renderHook(() => useUndoRedo());

      // 初期状態を記録（変更検出の基準）
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // オブジェクトを変更
      act(() => {
        useCanvasStore.setState({
          objects: [createMockObject('obj-2')],
        });
      });

      // デバウンス前は履歴に追加されない
      expect(useHistoryStore.getState().past.length).toBe(0);

      // デバウンス後に履歴に追加される
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(useHistoryStore.getState().past.length).toBe(1);
    });
  });

  describe('keyboard shortcuts', () => {
    it('should undo on Ctrl+Z', () => {
      const previousState = [createMockObject('obj-1')];
      const currentState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [previousState],
        future: [],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      renderHook(() => useUndoRedo());

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
        });
        window.dispatchEvent(event);
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(previousState);
    });

    it('should redo on Ctrl+Shift+Z', () => {
      const currentState = [createMockObject('obj-1')];
      const nextState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [],
        future: [nextState],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      renderHook(() => useUndoRedo());

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
        });
        window.dispatchEvent(event);
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(nextState);
    });

    it('should redo on Ctrl+Y', () => {
      const currentState = [createMockObject('obj-1')];
      const nextState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [],
        future: [nextState],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      renderHook(() => useUndoRedo());

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'y',
          ctrlKey: true,
        });
        window.dispatchEvent(event);
        vi.advanceTimersByTime(10);
      });

      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(nextState);
    });

    it('should not trigger shortcuts when input is focused', () => {
      const previousState = [createMockObject('obj-1')];
      const currentState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [previousState],
        future: [],
      });

      useCanvasStore.setState({
        objects: currentState,
      });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      renderHook(() => useUndoRedo());

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
        });
        Object.defineProperty(event, 'target', { value: input });
        window.dispatchEvent(event);
        vi.advanceTimersByTime(10);
      });

      // 状態は変わらない
      const { objects } = useCanvasStore.getState();
      expect(objects).toEqual(currentState);

      document.body.removeChild(input);
    });
  });
});
