import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from './historyStore';
import type { GridObject } from '@/types';

describe('historyStore', () => {
  // テスト用のオブジェクト
  const createMockObject = (id: string): GridObject => ({
    id,
    cells: [[0, 0]],
    position: { x: 0, y: 0 },
    rotation: 0,
    color: '#333333',
  });

  beforeEach(() => {
    // ストアをリセット
    useHistoryStore.setState({
      past: [],
      future: [],
      maxHistorySize: 50,
    });
  });

  describe('pushState', () => {
    it('should add state to past stack', () => {
      const { pushState } = useHistoryStore.getState();
      const state1 = [createMockObject('obj-1')];

      pushState(state1);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(1);
      expect(past[0]).toEqual(state1);
    });

    it('should clear future stack when pushing new state', () => {
      useHistoryStore.setState({
        past: [[createMockObject('obj-1')]],
        future: [[createMockObject('obj-2')]],
      });

      const { pushState } = useHistoryStore.getState();
      pushState([createMockObject('obj-3')]);

      const { future } = useHistoryStore.getState();
      expect(future.length).toBe(0);
    });

    it('should respect maxHistorySize', () => {
      useHistoryStore.setState({ maxHistorySize: 3 });

      const { pushState } = useHistoryStore.getState();

      // 4つの状態を追加
      pushState([createMockObject('obj-1')]);
      pushState([createMockObject('obj-2')]);
      pushState([createMockObject('obj-3')]);
      pushState([createMockObject('obj-4')]);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(3);
      // 最も古い状態が削除されている
      expect(past[0][0].id).toBe('obj-2');
    });
  });

  describe('undo', () => {
    it('should return null when past is empty', () => {
      const { undo } = useHistoryStore.getState();
      const currentState = [createMockObject('current')];

      const result = undo(currentState);

      expect(result).toBeNull();
    });

    it('should return previous state and update stacks', () => {
      const previousState = [createMockObject('obj-1')];
      const currentState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [previousState],
        future: [],
      });

      const { undo } = useHistoryStore.getState();
      const result = undo(currentState);

      expect(result).toEqual(previousState);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(1);
      expect(future[0]).toEqual(currentState);
    });

    it('should handle multiple undo operations', () => {
      const state1 = [createMockObject('obj-1')];
      const state2 = [createMockObject('obj-2')];
      const state3 = [createMockObject('obj-3')];

      useHistoryStore.setState({
        past: [state1, state2],
        future: [],
      });

      const { undo } = useHistoryStore.getState();

      // 最初のUndo
      const result1 = undo(state3);
      expect(result1).toEqual(state2);

      // 2回目のUndo
      const result2 = useHistoryStore.getState().undo(state2);
      expect(result2).toEqual(state1);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(2);
    });
  });

  describe('redo', () => {
    it('should return null when future is empty', () => {
      const { redo } = useHistoryStore.getState();
      const currentState = [createMockObject('current')];

      const result = redo(currentState);

      expect(result).toBeNull();
    });

    it('should return next state and update stacks', () => {
      const currentState = [createMockObject('obj-1')];
      const nextState = [createMockObject('obj-2')];

      useHistoryStore.setState({
        past: [],
        future: [nextState],
      });

      const { redo } = useHistoryStore.getState();
      const result = redo(currentState);

      expect(result).toEqual(nextState);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(1);
      expect(past[0]).toEqual(currentState);
      expect(future.length).toBe(0);
    });

    it('should handle multiple redo operations', () => {
      const state1 = [createMockObject('obj-1')];
      const state2 = [createMockObject('obj-2')];
      const state3 = [createMockObject('obj-3')];

      useHistoryStore.setState({
        past: [],
        future: [state2, state3],
      });

      const { redo } = useHistoryStore.getState();

      // 最初のRedo
      const result1 = redo(state1);
      expect(result1).toEqual(state3);

      // 2回目のRedo
      const result2 = useHistoryStore.getState().redo(state3);
      expect(result2).toEqual(state2);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(2);
      expect(future.length).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear both past and future stacks', () => {
      useHistoryStore.setState({
        past: [[createMockObject('obj-1')], [createMockObject('obj-2')]],
        future: [[createMockObject('obj-3')]],
      });

      const { clearHistory } = useHistoryStore.getState();
      clearHistory();

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(0);
    });
  });

  describe('canUndo / canRedo', () => {
    it('canUndo should return true when past has items', () => {
      useHistoryStore.setState({
        past: [[createMockObject('obj-1')]],
        future: [],
      });

      const { canUndo } = useHistoryStore.getState();
      expect(canUndo()).toBe(true);
    });

    it('canUndo should return false when past is empty', () => {
      useHistoryStore.setState({
        past: [],
        future: [[createMockObject('obj-1')]],
      });

      const { canUndo } = useHistoryStore.getState();
      expect(canUndo()).toBe(false);
    });

    it('canRedo should return true when future has items', () => {
      useHistoryStore.setState({
        past: [],
        future: [[createMockObject('obj-1')]],
      });

      const { canRedo } = useHistoryStore.getState();
      expect(canRedo()).toBe(true);
    });

    it('canRedo should return false when future is empty', () => {
      useHistoryStore.setState({
        past: [[createMockObject('obj-1')]],
        future: [],
      });

      const { canRedo } = useHistoryStore.getState();
      expect(canRedo()).toBe(false);
    });
  });

  describe('setMaxHistorySize', () => {
    it('should update maxHistorySize', () => {
      const { setMaxHistorySize } = useHistoryStore.getState();
      setMaxHistorySize(100);

      const { maxHistorySize } = useHistoryStore.getState();
      expect(maxHistorySize).toBe(100);
    });

    it('should trim past if it exceeds new size', () => {
      useHistoryStore.setState({
        past: [
          [createMockObject('obj-1')],
          [createMockObject('obj-2')],
          [createMockObject('obj-3')],
          [createMockObject('obj-4')],
          [createMockObject('obj-5')],
        ],
      });

      const { setMaxHistorySize } = useHistoryStore.getState();
      setMaxHistorySize(3);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(3);
      // 最新の3つが保持される
      expect(past[0][0].id).toBe('obj-3');
      expect(past[1][0].id).toBe('obj-4');
      expect(past[2][0].id).toBe('obj-5');
    });
  });
});
