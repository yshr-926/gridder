import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useGroupStore } from '@/stores/groupStore';
import type { GridObject } from '@/types';

describe('useCanvasKeyboard', () => {
  const mockObject: GridObject = {
    id: 'test-obj-1',
    cells: [[0, 0]],
    position: { x: 0, y: 0 },
    rotation: 0,
    color: '#333333',
  };

  beforeEach(() => {
    // Reset stores
    useGridSettingsStore.setState({
      zoom: 1,
      basePixelSize: 20,
      cellSize: 10,
      unit: 'cm',
    });
    useCanvasStore.setState({
      toolMode: 'draw',
      objects: [mockObject],
      selectedObjectId: null,
      selection: {
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      },
      drawingCells: [],
      panPosition: { x: 0, y: 0 },
    });
    // Clear any groups from previous tests
    useGroupStore.setState({ groups: [] });
  });

  it('switches to draw mode with D key', () => {
    useCanvasStore.setState({ toolMode: 'select' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyD' });
      window.dispatchEvent(event);
    });

    expect(useCanvasStore.getState().toolMode).toBe('draw');
  });

  it('switches to select mode with V key', () => {
    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyV' });
      window.dispatchEvent(event);
    });

    expect(useCanvasStore.getState().toolMode).toBe('select');
  });

  it('switches to eraser mode with E key', () => {
    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyE' });
      window.dispatchEvent(event);
    });

    expect(useCanvasStore.getState().toolMode).toBe('eraser');
  });

  it('rotates selected object with R key', () => {
    useCanvasStore.setState({ selectedObjectId: 'test-obj-1' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyR' });
      window.dispatchEvent(event);
    });

    const store = useCanvasStore.getState();
    const obj = store.objects.find((o) => o.id === 'test-obj-1');
    expect(obj?.rotation).toBe(90);
  });

  it('deletes selected object with Delete key', () => {
    useCanvasStore.setState({ selectedObjectId: 'test-obj-1' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'Delete' });
      window.dispatchEvent(event);
    });

    const store = useCanvasStore.getState();
    expect(store.objects.length).toBe(0);
    expect(store.selectedObjectId).toBeNull();
  });

  it('deletes selected object with Backspace key', () => {
    useCanvasStore.setState({ selectedObjectId: 'test-obj-1' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'Backspace' });
      window.dispatchEvent(event);
    });

    const store = useCanvasStore.getState();
    expect(store.objects.length).toBe(0);
  });

  it('clears selection with Escape key', () => {
    useCanvasStore.setState({ selectedObjectId: 'test-obj-1' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'Escape' });
      window.dispatchEvent(event);
    });

    expect(useCanvasStore.getState().selectedObjectId).toBeNull();
  });

  it('duplicates selected object with Ctrl+D', () => {
    useCanvasStore.setState({ selectedObjectId: 'test-obj-1' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyD',
        ctrlKey: true,
      });
      window.dispatchEvent(event);
    });

    const store = useCanvasStore.getState();
    expect(store.objects.length).toBe(2);
  });

  it('zooms in with Ctrl+=', () => {
    const initialZoom = useGridSettingsStore.getState().zoom;

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'Equal',
        ctrlKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(useGridSettingsStore.getState().zoom).toBeGreaterThan(initialZoom);
  });

  it('zooms out with Ctrl+-', () => {
    const initialZoom = useGridSettingsStore.getState().zoom;

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'Minus',
        ctrlKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(useGridSettingsStore.getState().zoom).toBeLessThan(initialZoom);
  });

  it('does not trigger shortcuts when input is focused', () => {
    // Create a mock input element and simulate it being the target
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    useCanvasStore.setState({ toolMode: 'select' });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyD' });
      // Dispatch to window, but the handler checks the target
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);
    });

    // Should still be 'select' because input was focused
    expect(useCanvasStore.getState().toolMode).toBe('select');

    document.body.removeChild(input);
  });

  it('creates group with Ctrl+G when multiple objects selected', () => {
    const mockObject2: GridObject = {
      id: 'test-obj-2',
      cells: [[1, 0]],
      position: { x: 1, y: 0 },
      rotation: 0,
      color: '#444444',
    };

    useCanvasStore.setState({
      objects: [mockObject, mockObject2],
      selection: {
        selectedIds: ['test-obj-1', 'test-obj-2'],
        primaryId: 'test-obj-1',
        mode: 'multiple',
      },
    });

    // Clear any existing groups
    useGroupStore.setState({ groups: [] });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyG',
        ctrlKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(useGroupStore.getState().groups.length).toBe(1);
    expect(useGroupStore.getState().groups[0].objectIds).toContain('test-obj-1');
    expect(useGroupStore.getState().groups[0].objectIds).toContain('test-obj-2');
  });

  it('ungroups with Ctrl+Shift+G when grouped objects selected', () => {
    const mockObject2: GridObject = {
      id: 'test-obj-2',
      cells: [[1, 0]],
      position: { x: 1, y: 0 },
      rotation: 0,
      color: '#444444',
    };

    useCanvasStore.setState({
      objects: [mockObject, mockObject2],
      selection: {
        selectedIds: ['test-obj-1', 'test-obj-2'],
        primaryId: 'test-obj-1',
        mode: 'multiple',
      },
    });

    // Create a group first
    const group = useGroupStore.getState().createGroup(['test-obj-1', 'test-obj-2']);
    expect(group).not.toBeNull();
    expect(useGroupStore.getState().groups.length).toBe(1);

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyG',
        ctrlKey: true,
        shiftKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(useGroupStore.getState().groups.length).toBe(0);
  });

  it('selects all objects with Ctrl+A', () => {
    const mockObject2: GridObject = {
      id: 'test-obj-2',
      cells: [[1, 0]],
      position: { x: 1, y: 0 },
      rotation: 0,
      color: '#444444',
    };

    useCanvasStore.setState({
      objects: [mockObject, mockObject2],
      selection: {
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      },
    });

    renderHook(() => useCanvasKeyboard());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyA',
        ctrlKey: true,
      });
      window.dispatchEvent(event);
    });

    const selection = useCanvasStore.getState().selection;
    expect(selection.selectedIds).toContain('test-obj-1');
    expect(selection.selectedIds).toContain('test-obj-2');
  });
});
