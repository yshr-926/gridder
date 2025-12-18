import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridCanvas } from './GridCanvas';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock Konva
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-stage" {...props}>
      {children}
    </div>
  ),
  Layer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="konva-layer">{children}</div>
  ),
  Rect: (props: Record<string, unknown>) => <div data-testid="konva-rect" {...props} />,
  Line: (props: Record<string, unknown>) => <div data-testid="konva-line" {...props} />,
  Group: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="konva-group">{children}</div>
  ),
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('GridCanvas', () => {
  beforeEach(() => {
    // Reset stores
    useGridSettingsStore.setState({
      zoom: 1,
      basePixelSize: 20,
      cellSize: 10,
      unit: 'cm',
    });
    useCanvasStore.setState({
      panPosition: { x: 0, y: 0 },
      toolMode: 'draw',
      objects: [],
      selectedObjectId: null,
      drawingCells: [],
    });
  });

  it('renders the canvas container', () => {
    render(<GridCanvas />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders three layers (Grid, Objects, Interaction)', () => {
    render(<GridCanvas />);
    const layers = screen.getAllByTestId('konva-layer');
    expect(layers).toHaveLength(3);
  });

  it('calls onCursorPositionChange when mouse leaves', () => {
    const mockCallback = vi.fn();
    render(<GridCanvas onCursorPositionChange={mockCallback} />);

    const stage = screen.getByTestId('konva-stage');
    fireEvent.mouseLeave(stage);

    expect(mockCallback).toHaveBeenCalledWith(null);
  });

  it('changes cursor to grab when Space key is pressed', () => {
    render(<GridCanvas />);

    // Initially cursor should be default
    const container = screen.getByTestId('konva-stage').parentElement;
    expect(container).toHaveStyle({ cursor: 'default' });

    // Press Space key
    fireEvent.keyDown(window, { code: 'Space' });

    // Cursor should change to grab
    expect(container).toHaveStyle({ cursor: 'grab' });

    // Release Space key
    fireEvent.keyUp(window, { code: 'Space' });

    // Cursor should return to default
    expect(container).toHaveStyle({ cursor: 'default' });
  });

  it('does not trigger pan mode on Space key repeat', () => {
    render(<GridCanvas />);

    const container = screen.getByTestId('konva-stage').parentElement;

    // First press
    fireEvent.keyDown(window, { code: 'Space' });
    expect(container).toHaveStyle({ cursor: 'grab' });

    // Release
    fireEvent.keyUp(window, { code: 'Space' });
    expect(container).toHaveStyle({ cursor: 'default' });

    // Repeated key event should not trigger
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    // Cursor should still be default because repeat is ignored
    expect(container).toHaveStyle({ cursor: 'default' });
  });
});
