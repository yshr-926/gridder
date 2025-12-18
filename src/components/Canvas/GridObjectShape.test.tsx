import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridObjectShape } from './GridObjectShape';
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
    <div
      data-testid="konva-group"
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  ),
  Rect: ({ fill, stroke, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-fill={fill}
      data-stroke={stroke}
      {...props}
    />
  ),
  Line: ({ stroke, dash, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-stroke={stroke}
      data-dash={JSON.stringify(dash)}
      {...props}
    />
  ),
}));

describe('GridObjectShape', () => {
  const mockObject: GridObject = {
    id: 'test-obj-1',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    position: { x: 5, y: 5 },
    rotation: 0,
    color: '#333333',
  };

  const defaultProps = {
    object: mockObject,
    gridSize: 20,
    isSelected: false,
    draggable: false,
    onClick: vi.fn(),
    onDragEnd: vi.fn(),
  };

  it('renders cells as rectangles', () => {
    render(<GridObjectShape {...defaultProps} />);

    // Should render 3 cells (from mockObject.cells)
    const rects = screen.getAllByTestId('konva-rect');
    // May include selection overlay rect if selected
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('renders with correct fill color', () => {
    render(<GridObjectShape {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const cellRect = rects.find((r) => r.getAttribute('data-fill') === '#333333');
    expect(cellRect).toBeInTheDocument();
  });

  it('shows selection highlight when selected', () => {
    render(<GridObjectShape {...defaultProps} isSelected={true} />);

    // Should have a selection line (dashed border)
    const lines = screen.getAllByTestId('konva-line');
    const selectionLine = lines.find(
      (l) => l.getAttribute('data-stroke') === '#3b82f6'
    );
    expect(selectionLine).toBeInTheDocument();

    // Should have dash pattern
    expect(selectionLine?.getAttribute('data-dash')).toBe('[5,5]');
  });

  it('does not show selection highlight when not selected', () => {
    render(<GridObjectShape {...defaultProps} isSelected={false} />);

    // Should not have dashed selection line
    const lines = screen.queryAllByTestId('konva-line');
    const selectionLine = lines.find(
      (l) => l.getAttribute('data-stroke') === '#3b82f6'
    );
    expect(selectionLine).toBeUndefined();
  });

  it('calls onClick when clicked', () => {
    const onClickMock = vi.fn();
    render(<GridObjectShape {...defaultProps} onClick={onClickMock} />);

    // Find the outer group and click it
    const groups = screen.getAllByTestId('konva-group');
    // Click the first group (outer group)
    fireEvent.click(groups[0]);

    expect(onClickMock).toHaveBeenCalled();
  });

  it('applies rotation correctly', () => {
    const rotatedObject = { ...mockObject, rotation: 90 as const };
    render(<GridObjectShape {...defaultProps} object={rotatedObject} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('rotation', '90');
  });

  it('is draggable when draggable prop is true', () => {
    render(<GridObjectShape {...defaultProps} draggable={true} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('draggable', 'true');
  });

  it('is not draggable when draggable prop is false', () => {
    render(<GridObjectShape {...defaultProps} draggable={false} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('draggable', 'false');
  });
});
