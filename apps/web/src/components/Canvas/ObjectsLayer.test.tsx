import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectsLayer } from './ObjectsLayer';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useUIStore } from '@/stores/uiStore';
import type { GridObject } from '@/types';
import { DEFAULT_TEXT_SETTINGS, DEFAULT_DIMENSION_SETTINGS } from '@/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({
    children,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: (e: { evt: MouseEvent }) => void;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-group"
      onClick={(e) => onClick?.({ evt: e.nativeEvent as MouseEvent })}
      {...props}
    >
      {children}
    </div>
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" {...props} />
  ),
  Line: (props: Record<string, unknown>) => (
    <div data-testid="konva-line" {...props} />
  ),
  Text: ({ text, ...props }: { text?: string } & Record<string, unknown>) => (
    <span data-testid="konva-text" data-text={text} {...props}>
      {text}
    </span>
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
      selection: {
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      },
      toolMode: 'draw',
      drawingCells: [],
      panPosition: { x: 0, y: 0 },
    });
    useUIStore.setState({
      showObjectNames: false,
      showDimensions: false,
      textSettings: DEFAULT_TEXT_SETTINGS,
      dimensionSettings: DEFAULT_DIMENSION_SETTINGS,
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
      selection: {
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      },
    });

    render(<ObjectsLayer />);

    // Find all groups (container + each object)
    const groups = screen.getAllByTestId('konva-group');

    // Click on the second group (first object)
    // Note: group[0] is the container, group[1] and [2] are outer groups of objects
    // The mock onClick receives a synthetic event, so we simulate shiftKey = false
    if (groups[1]) {
      fireEvent.click(groups[1], { shiftKey: false });
    }

    // Check if selection was triggered
    const store = useCanvasStore.getState();
    expect(store.selection.selectedIds).toContain('obj-1');
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
      selection: {
        selectedIds: ['obj-1'],
        primaryId: 'obj-1',
        mode: 'single',
      },
      toolMode: 'select',
    });

    render(<ObjectsLayer />);

    // Selected object should have selection rect (our selection indicator)
    // There are object cell rects + selection indicator rect
    const rects = screen.getAllByTestId('konva-rect');
    // At least 1 object rect + 1 selection indicator rect
    expect(rects.length).toBeGreaterThan(1);

    // Check that one rect has selection stroke color
    const hasSelectionRect = rects.some(
      (rect) =>
        rect.getAttribute('stroke') === '#0066cc' ||
        rect.getAttribute('stroke') === '#66aaff'
    );
    expect(hasSelectionRect).toBe(true);
  });
});
