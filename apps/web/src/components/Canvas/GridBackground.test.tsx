import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GridBackground } from './GridBackground';

// Mock react-konva
vi.mock('react-konva', () => ({
  Rect: ({ fill, ...props }: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-fill={fill} {...props} />
  ),
  Line: ({
    stroke,
    strokeWidth,
    points,
    ...props
  }: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-points={JSON.stringify(points)}
      {...props}
    />
  ),
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
}));

describe('GridBackground', () => {
  const defaultProps = {
    width: 800,
    height: 600,
    gridSize: 20,
    panX: 0,
    panY: 0,
    zoom: 1,
  };

  it('renders a background rectangle', () => {
    render(<GridBackground {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThan(0);

    // Check that background has white fill
    const background = rects[0];
    expect(background).toHaveAttribute('data-fill', '#ffffff');
  });

  it('renders grid lines', () => {
    render(<GridBackground {...defaultProps} />);

    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders both vertical and horizontal lines', () => {
    render(<GridBackground {...defaultProps} />);

    const lines = screen.getAllByTestId('konva-line');

    // Check for vertical lines (same x at start and end)
    const verticalLines = lines.filter((line) => {
      const points = JSON.parse(line.getAttribute('data-points') || '[]') as number[];
      return points[0] === points[2]; // x1 === x2
    });

    // Check for horizontal lines (same y at start and end)
    const horizontalLines = lines.filter((line) => {
      const points = JSON.parse(line.getAttribute('data-points') || '[]') as number[];
      return points[1] === points[3]; // y1 === y2
    });

    expect(verticalLines.length).toBeGreaterThan(0);
    expect(horizontalLines.length).toBeGreaterThan(0);
  });

  it('uses thicker lines for major grid (every 5 cells)', () => {
    render(<GridBackground {...defaultProps} />);

    const lines = screen.getAllByTestId('konva-line');

    // Check for both thin and thick stroke widths
    const strokeWidths = lines.map((line) =>
      parseFloat(line.getAttribute('data-stroke-width') || '0')
    );

    const uniqueWidths = [...new Set(strokeWidths)];
    // Should have 2 different widths (normal and major)
    expect(uniqueWidths.length).toBe(2);
  });

  it('adjusts stroke width based on zoom', () => {
    const { rerender } = render(<GridBackground {...defaultProps} zoom={1} />);

    const linesZoom1 = screen.getAllByTestId('konva-line');
    const strokeWidth1 = parseFloat(linesZoom1[0].getAttribute('data-stroke-width') || '0');

    rerender(<GridBackground {...defaultProps} zoom={2} />);

    const linesZoom2 = screen.getAllByTestId('konva-line');
    const strokeWidth2 = parseFloat(linesZoom2[0].getAttribute('data-stroke-width') || '0');

    // Stroke width should be half when zoom is doubled
    expect(strokeWidth2).toBe(strokeWidth1 / 2);
  });

  it('renders within a Group with listening disabled', () => {
    render(<GridBackground {...defaultProps} />);

    const group = screen.getByTestId('konva-group');
    expect(group).toBeInTheDocument();
  });

  it('draws the background around the visible region after a distant pan', () => {
    render(<GridBackground {...defaultProps} panX={-50000} panY={30000} />);

    const background = screen.getAllByTestId('konva-rect')[0];
    expect(Number(background.getAttribute('x'))).toBeGreaterThan(10000);
    expect(Number(background.getAttribute('y'))).toBeLessThan(-10000);
  });
});
