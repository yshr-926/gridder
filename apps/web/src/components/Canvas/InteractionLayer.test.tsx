import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteractionLayer } from './InteractionLayer';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: ({
    fill,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    ...props
  }: {
    fill?: string;
    onMouseDown?: (e: unknown) => void;
    onMouseMove?: (e: unknown) => void;
    onMouseUp?: () => void;
    onMouseLeave?: () => void;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-fill={fill}
      onMouseDown={(e) => {
        if (onMouseDown) {
          // Create mock Konva event
          const mockEvent = {
            evt: e,
            target: {
              getStage: () => ({
                getPointerPosition: () => ({ x: 100, y: 100 }),
              }),
            },
          };
          onMouseDown(mockEvent);
        }
      }}
      onMouseMove={(e) => {
        if (onMouseMove) {
          const mockEvent = {
            evt: { ...e, buttons: 1 },
            target: {
              getStage: () => ({
                getPointerPosition: () => ({ x: 100, y: 100 }),
              }),
            },
          };
          onMouseMove(mockEvent);
        }
      }}
      onMouseUp={() => onMouseUp?.()}
      onMouseLeave={() => onMouseLeave?.()}
      {...props}
    />
  ),
}));

describe('InteractionLayer', () => {
  const defaultProps = {
    panPosition: { x: 0, y: 0 },
    zoom: 1,
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
      objects: [],
      selectedObjectId: null,
      toolMode: 'draw',
      drawingCells: [],
      panPosition: { x: 0, y: 0 },
    });
  });

  it('renders the interaction layer', () => {
    render(<InteractionLayer {...defaultProps} />);

    expect(screen.getByTestId('konva-group')).toBeInTheDocument();
  });

  it('renders transparent interaction area', () => {
    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const transparentRect = rects.find((r) => r.getAttribute('data-fill') === 'transparent');
    expect(transparentRect).toBeInTheDocument();
  });

  it('adds drawing cell on mouse down in draw mode', () => {
    useCanvasStore.setState({ toolMode: 'draw' });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

    if (interactionArea) {
      fireEvent.mouseDown(interactionArea);
    }

    // Check that drawing cell was added
    const store = useCanvasStore.getState();
    expect(store.drawingCells.length).toBeGreaterThan(0);
  });

  it('shows preview cells while drawing', () => {
    useCanvasStore.setState({
      toolMode: 'draw',
      drawingCells: [[5, 5]],
    });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    // Should have at least 2 rects: interaction area + preview cell
    expect(rects.length).toBeGreaterThanOrEqual(2);

    // Check for preview fill color
    const previewRect = rects.find(
      (r) => r.getAttribute('data-fill') === 'rgba(51, 51, 51, 0.7)'
    );
    expect(previewRect).toBeInTheDocument();
  });

  it('commits drawing on mouse up in draw mode', () => {
    useCanvasStore.setState({
      toolMode: 'draw',
      drawingCells: [[5, 5]],
    });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

    if (interactionArea) {
      fireEvent.mouseUp(interactionArea);
    }

    // Check that drawing was committed (object created, drawing cells cleared)
    const store = useCanvasStore.getState();
    expect(store.drawingCells.length).toBe(0);
    expect(store.objects.length).toBe(1);
  });

  it('clears drawing cells on mouse leave', () => {
    useCanvasStore.setState({
      toolMode: 'draw',
      drawingCells: [[5, 5]],
    });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

    if (interactionArea) {
      fireEvent.mouseLeave(interactionArea);
    }

    // Check that drawing cells were cleared
    const store = useCanvasStore.getState();
    expect(store.drawingCells.length).toBe(0);
  });

  it('does not add drawing cells in select mode', () => {
    useCanvasStore.setState({ toolMode: 'select' });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

    if (interactionArea) {
      fireEvent.mouseDown(interactionArea);
    }

    // Drawing cells should remain empty
    const store = useCanvasStore.getState();
    expect(store.drawingCells.length).toBe(0);
  });

  it('erases cells in eraser mode', () => {
    // Set up an object with a cell at position that will be erased
    useCanvasStore.setState({
      toolMode: 'eraser',
      objects: [
        {
          id: 'test-obj',
          cells: [[0, 0]],
          position: { x: 5, y: 5 }, // gridSize=20, click at 100,100 => cell 5,5
          rotation: 0,
          color: '#333333',
        },
      ],
    });

    render(<InteractionLayer {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

    if (interactionArea) {
      fireEvent.mouseDown(interactionArea);
    }

    // Check that object was removed (only had 1 cell)
    const store = useCanvasStore.getState();
    expect(store.objects.length).toBe(0);
  });

  describe('subtract mode', () => {
    it('renders without errors in subtract mode', () => {
      useCanvasStore.setState({
        toolMode: 'subtract',
        selectedObjectId: 'test-obj',
        objects: [
          {
            id: 'test-obj',
            cells: [[0, 0], [1, 0], [0, 1]],
            position: { x: 5, y: 5 },
            rotation: 0,
            color: '#333333',
          },
        ],
      });

      render(<InteractionLayer {...defaultProps} />);

      expect(screen.getByTestId('konva-group')).toBeInTheDocument();
    });

    it('does not affect drawing cells in subtract mode', () => {
      useCanvasStore.setState({
        toolMode: 'subtract',
        drawingCells: [],
      });

      render(<InteractionLayer {...defaultProps} />);

      const rects = screen.getAllByTestId('konva-rect');
      const interactionArea = rects.find((r) => r.getAttribute('data-fill') === 'transparent');

      if (interactionArea) {
        fireEvent.mouseDown(interactionArea);
      }

      // Drawing cells should remain empty in subtract mode
      const store = useCanvasStore.getState();
      expect(store.drawingCells.length).toBe(0);
    });
  });

  describe('polygon mode', () => {
    it('renders without errors in polygon mode', () => {
      useCanvasStore.setState({
        toolMode: 'polygon',
      });

      render(<InteractionLayer {...defaultProps} />);

      expect(screen.getByTestId('konva-group')).toBeInTheDocument();
    });
  });

  describe('line mode', () => {
    it('renders without errors in line mode', () => {
      useCanvasStore.setState({
        toolMode: 'line',
      });

      render(<InteractionLayer {...defaultProps} />);

      expect(screen.getByTestId('konva-group')).toBeInTheDocument();
    });
  });
});
