import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CursorOverlay } from './CursorOverlay';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: ({ stroke, fill, dash, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-stroke={stroke}
      data-fill={fill}
      data-dash={dash ? JSON.stringify(dash) : undefined}
      {...props}
    />
  ),
  Circle: ({ stroke, fill, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-circle"
      data-stroke={stroke}
      data-fill={fill}
      {...props}
    />
  ),
}));

describe('CursorOverlay', () => {
  const defaultProps = {
    position: { x: 5, y: 10 },
    gridSize: 20,
  };

  it('renders nothing when position is null', () => {
    const { container } = render(
      <CursorOverlay position={null} toolMode="draw" gridSize={20} />
    );

    // Group should not be rendered
    expect(container.firstChild).toBeNull();
  });

  describe('draw mode', () => {
    it('renders a blue rectangle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="draw" />);

      const rect = screen.getByTestId('konva-rect');
      expect(rect).toBeInTheDocument();
      expect(rect.getAttribute('data-stroke')).toBe('#3b82f6');
      expect(rect.getAttribute('data-fill')).toBe('rgba(59, 130, 246, 0.1)');
    });
  });

  describe('eraser mode', () => {
    it('renders a red rectangle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="eraser" />);

      const rect = screen.getByTestId('konva-rect');
      expect(rect).toBeInTheDocument();
      expect(rect.getAttribute('data-stroke')).toBe('#ef4444');
      expect(rect.getAttribute('data-fill')).toBe('rgba(239, 68, 68, 0.1)');
    });
  });

  describe('select mode', () => {
    it('renders a gray rectangle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="select" />);

      const rect = screen.getByTestId('konva-rect');
      expect(rect).toBeInTheDocument();
      expect(rect.getAttribute('data-stroke')).toBe('#6b7280');
      expect(rect.getAttribute('data-fill')).toBe('transparent');
    });
  });

  describe('polygon mode', () => {
    it('renders a blue circle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="polygon" />);

      const circle = screen.getByTestId('konva-circle');
      expect(circle).toBeInTheDocument();
      expect(circle.getAttribute('data-stroke')).toBe('#3b82f6');
      expect(circle.getAttribute('data-fill')).toBe('rgba(59, 130, 246, 0.2)');
    });
  });

  describe('line mode', () => {
    it('renders a blue circle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="line" />);

      const circle = screen.getByTestId('konva-circle');
      expect(circle).toBeInTheDocument();
      expect(circle.getAttribute('data-stroke')).toBe('#3b82f6');
      expect(circle.getAttribute('data-fill')).toBe('rgba(59, 130, 246, 0.2)');
    });
  });

  describe('subtract mode', () => {
    it('renders a red dashed rectangle cursor', () => {
      render(<CursorOverlay {...defaultProps} toolMode="subtract" />);

      const rect = screen.getByTestId('konva-rect');
      expect(rect).toBeInTheDocument();
      expect(rect.getAttribute('data-stroke')).toBe('#ef4444');
      expect(rect.getAttribute('data-fill')).toBe('rgba(239, 68, 68, 0.1)');
      expect(rect.getAttribute('data-dash')).toBe('[5,5]');
    });
  });

  it('has displayName set correctly', () => {
    expect(CursorOverlay.displayName).toBe('CursorOverlay');
  });
});
