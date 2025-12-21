import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection, findObjectAtCell } from './useSelection';
import { useCanvasStore } from '@/stores/canvasStore';
import type { GridObject } from '@/types';

describe('findObjectAtCell', () => {
  it('should return null for empty objects array', () => {
    const result = findObjectAtCell(0, 0, []);
    expect(result).toBeNull();
  });

  it('should find object at cell', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 5, y: 5 },
        rotation: 0,
        color: '#333',
      },
    ];
    const result = findObjectAtCell(5, 5, objects);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('obj-1');
  });

  it('should find object considering position offset', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        position: { x: 10, y: 20 },
        rotation: 0,
        color: '#333',
      },
    ];
    // Cell [1, 0] at position [10, 20] = global [11, 20]
    expect(findObjectAtCell(11, 20, objects)?.id).toBe('obj-1');
    // Cell [0, 1] at position [10, 20] = global [10, 21]
    expect(findObjectAtCell(10, 21, objects)?.id).toBe('obj-1');
    // Non-existent
    expect(findObjectAtCell(12, 20, objects)).toBeNull();
  });

  it('should return first matching object when overlapping', () => {
    const objects: GridObject[] = [
      {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      },
      {
        id: 'obj-2',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#fff',
      },
    ];
    const result = findObjectAtCell(0, 0, objects);
    expect(result?.id).toBe('obj-1');
  });
});

describe('useSelection', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      objects: [],
      drawingCells: [],
      selectedObjectId: null,
    });
  });

  describe('select and deselect', () => {
    it('should select an object', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.select('obj-1');
      });

      expect(result.current.selectedObjectId).toBe('obj-1');
    });

    it('should deselect', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.deselect();
      });

      expect(result.current.selectedObjectId).toBeNull();
    });

    it('should get selected object', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      const selectedObj = result.current.getSelectedObject();
      expect(selectedObj?.id).toBe('obj-1');
    });
  });

  describe('moveSelectedObject', () => {
    it('should move selected object by delta', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 5, y: 5 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.moveSelectedObject(2, 3);
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].position).toEqual({ x: 7, y: 8 });
    });

    it('should do nothing when no object is selected', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 5, y: 5 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: null,
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.moveSelectedObject(2, 3);
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].position).toEqual({ x: 5, y: 5 });
    });
  });

  describe('rotateSelectedObject', () => {
    it('should rotate selected object 90 degrees', () => {
      // Create an L-shaped object
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.rotateSelectedObject();
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].rotation).toBe(90);
      // L-shape rotated 90 degrees clockwise
      expect(state.objects[0].cells).toHaveLength(3);
    });

    it('should cycle rotation through 0, 90, 180, 270', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.rotateSelectedObject();
      });
      expect(useCanvasStore.getState().objects[0].rotation).toBe(90);

      act(() => {
        result.current.rotateSelectedObject();
      });
      expect(useCanvasStore.getState().objects[0].rotation).toBe(180);

      act(() => {
        result.current.rotateSelectedObject();
      });
      expect(useCanvasStore.getState().objects[0].rotation).toBe(270);

      act(() => {
        result.current.rotateSelectedObject();
      });
      expect(useCanvasStore.getState().objects[0].rotation).toBe(0);
    });

    it('should normalize cells after rotation', () => {
      // Vertical line
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [
              [0, 0],
              [0, 1],
              [0, 2],
            ],
            position: { x: 5, y: 5 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.rotateSelectedObject();
      });

      const state = useCanvasStore.getState();
      // After rotation, vertical line becomes horizontal
      // Cells should be normalized to start from 0
      const minX = Math.min(...state.objects[0].cells.map(([x]) => x));
      const minY = Math.min(...state.objects[0].cells.map(([, y]) => y));
      expect(minX).toBe(0);
      expect(minY).toBe(0);
    });
  });

  describe('deleteSelectedObject', () => {
    it('should delete selected object', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.deleteSelectedObject();
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(0);
      expect(state.selectedObjectId).toBeNull();
    });

    it('should do nothing when no object is selected', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: null,
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.deleteSelectedObject();
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(1);
    });
  });

  describe('duplicateSelectedObject', () => {
    it('should duplicate selected object', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [
              [0, 0],
              [1, 0],
            ],
            position: { x: 5, y: 5 },
            rotation: 90,
            color: '#ff0000',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.duplicateSelectedObject();
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(2);

      const newObj = state.objects[1];
      expect(newObj.id).not.toBe('obj-1');
      expect(newObj.cells).toEqual([
        [0, 0],
        [1, 0],
      ]);
      expect(newObj.position).toEqual({ x: 6, y: 6 }); // Original + 1
      expect(newObj.rotation).toBe(90);
      expect(newObj.color).toBe('#ff0000');
    });

    it('should select the duplicated object', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
        selectedObjectId: 'obj-1',
      });

      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.duplicateSelectedObject();
      });

      const state = useCanvasStore.getState();
      const newObjId = state.objects[1].id;
      expect(state.selectedObjectId).toBe(newObjId);
    });

    it('should return null when no object is selected', () => {
      useCanvasStore.setState({
        objects: [],
        selectedObjectId: null,
      });

      const { result } = renderHook(() => useSelection());

      let duplicateResult: GridObject | null = null;
      act(() => {
        duplicateResult = result.current.duplicateSelectedObject();
      });

      expect(duplicateResult).toBeNull();
    });
  });

  describe('findObjectAtCell', () => {
    it('should find object at given coordinates', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 10, y: 10 },
            rotation: 0,
            color: '#333',
          },
        ],
      });

      const { result } = renderHook(() => useSelection());

      const found = result.current.findObjectAtCell(10, 10);
      expect(found?.id).toBe('obj-1');
    });
  });
});
