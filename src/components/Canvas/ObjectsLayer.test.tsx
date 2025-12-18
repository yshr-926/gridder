import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectsLayer } from './ObjectsLayer';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import type { GridObject } from '@/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({
    children,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  } & Record<string, unknown>) => (
    <div data-testid="konva-group" onClick={onClick} {...props}>
      {children}
    </div>
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" {...props} />
  ),
  Line: (props: Record<string, unknown>) => (
    <div data-testid="konva-line" {...props} />
  ),
}));

describe('ObjectsLayer', () => {
  const mockObjects: GridObject[] = [
    {
      id: 'obj-1',
      cells: [[0, 0]],
      position: { x: 0, y: 0 },
      rotation: 0,
      color: '#333333',
    },
    {
      id: 'obj-2',
      cells: [
        [0, 0],
        [1, 0],
      ],
      position: { x: 5, y: 5 },
      rotation: 0,
      color: '#666666',
    },
  ];

  beforeEach(() => {
    // Reset stores
    useGridSettingsStore.setState({
      zoom: 1,
      basePixelSize: 20,
      cellSize: 10,
      unit: 'cm',
    });
    useCanvasStore.setState({
      objects: [],
      selectedObjectId: null,
      toolMode: 'draw',
      drawingCells: [],
      panPosition: { x: 0, y: 0 },
    });
  });

  it('renders without objects', () => {
    render(<ObjectsLayer />);

    // Should have at least one group (container)
    const groups = screen.getAllByTestId('konva-group');
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  it('renders objects from store', () => {
    useCanvasStore.setState({ objects: mockObjects });

    render(<ObjectsLayer />);

    // Should render cells from both objects (1 + 2 = 3 cells)
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('selects object on click in select mode', () => {
    useCanvasStore.setState({
      objects: mockObjects,
      toolMode: 'select',
      selectedObjectId: null,
    });

    render(<ObjectsLayer />);

    // Find all groups (container + each object)
    const groups = screen.getAllByTestId('konva-group');

    // Click on the second group (first object)
    // Note: group[0] is the container, group[1] and [2] are outer groups of objects
    if (groups[1]) {
      fireEvent.click(groups[1]);
    }

    // Check if selection was triggered
    const store = useCanvasStore.getState();
    expect(store.selectedObjectId).toBe('obj-1');
  });

  it('does not select object on click in draw mode', () => {
    useCanvasStore.setState({
      objects: mockObjects,
      toolMode: 'draw',
      selectedObjectId: null,
    });

    render(<ObjectsLayer />);

    const groups = screen.getAllByTestId('konva-group');

    if (groups[1]) {
      fireEvent.click(groups[1]);
    }

    // Selection should not change
    const store = useCanvasStore.getState();
    expect(store.selectedObjectId).toBeNull();
  });

  it('objects are draggable in select mode', () => {
    useCanvasStore.setState({
      objects: mockObjects,
      toolMode: 'select',
    });

    render(<ObjectsLayer />);

    const groups = screen.getAllByTestId('konva-group');
    // Find groups with draggable attribute
    const draggableGroups = groups.filter(
      (g) => g.getAttribute('draggable') === 'true'
    );

    // Object groups should be draggable
    expect(draggableGroups.length).toBeGreaterThan(0);
  });

  it('objects are not draggable in draw mode', () => {
    useCanvasStore.setState({
      objects: mockObjects,
      toolMode: 'draw',
    });

    render(<ObjectsLayer />);

    const groups = screen.getAllByTestId('konva-group');
    // Find groups with draggable=true
    const draggableGroups = groups.filter(
      (g) => g.getAttribute('draggable') === 'true'
    );

    // No groups should be draggable in draw mode
    expect(draggableGroups.length).toBe(0);
  });

  it('highlights selected object', () => {
    useCanvasStore.setState({
      objects: mockObjects,
      selectedObjectId: 'obj-1',
      toolMode: 'select',
    });

    render(<ObjectsLayer />);

    // Selected object should have selection line
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });
});
