import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteCursor } from './RemoteCursor';
import type { CollaboratorInfo, Presence } from '@/features/collaboration/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Line: ({ points, fill, stroke, closed, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-fill={fill}
      data-stroke={stroke}
      data-closed={closed ? 'true' : 'false'}
      {...props}
    />
  ),
  Rect: ({ width, height, fill, cornerRadius, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-width={width}
      data-height={height}
      data-fill={fill}
      data-corner-radius={cornerRadius}
      {...props}
    />
  ),
  Text: ({ text, fontSize, fill, fontStyle, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-text"
      data-text={text}
      data-font-size={fontSize}
      data-fill={fill}
      data-font-style={fontStyle}
      {...props}
    />
  ),
}));

describe('RemoteCursor', () => {
  const mockCollaborator: CollaboratorInfo = {
    id: 'user-1',
    displayName: 'Alice',
    color: '#ef4444',
    connectedAt: '2025-01-01T00:00:00Z',
  };

  const mockPresenceWithCursor: Presence = {
    userId: 'user-1',
    cursor: { x: 5, y: 10 },
    selectedObjectIds: [],
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const mockPresenceWithoutCursor: Presence = {
    userId: 'user-1',
    cursor: null,
    selectedObjectIds: [],
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const defaultProps = {
    collaborator: mockCollaborator,
    presence: mockPresenceWithCursor,
    gridSize: 20,
  };

  it('renders nothing when cursor is null', () => {
    const { container } = render(
      <RemoteCursor
        collaborator={mockCollaborator}
        presence={mockPresenceWithoutCursor}
        gridSize={20}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders cursor arrow and label when cursor is present', () => {
    render(<RemoteCursor {...defaultProps} />);

    // Check for cursor arrow (Line)
    const line = screen.getByTestId('konva-line');
    expect(line).toBeInTheDocument();
    expect(line.getAttribute('data-fill')).toBe('#ef4444');
    expect(line.getAttribute('data-stroke')).toBe('#ffffff');
    expect(line.getAttribute('data-closed')).toBe('true');

    // Check for label background (Rect)
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toBeInTheDocument();
    expect(rect.getAttribute('data-fill')).toBe('#ef4444');

    // Check for label text (Text)
    const text = screen.getByTestId('konva-text');
    expect(text).toBeInTheDocument();
    expect(text.getAttribute('data-text')).toBe('Alice');
    expect(text.getAttribute('data-fill')).toBe('#ffffff');
  });

  it('positions cursor at correct pixel coordinates', () => {
    render(<RemoteCursor {...defaultProps} />);

    const line = screen.getByTestId('konva-line');
    const points = JSON.parse(line.getAttribute('data-points') || '[]') as number[];

    // With cursor at (5, 10) and gridSize 20, pixel position should be (100, 200)
    expect(points[0]).toBe(100); // First point x
    expect(points[1]).toBe(200); // First point y
  });

  it('renders cursor with different grid sizes', () => {
    const { rerender } = render(
      <RemoteCursor {...defaultProps} gridSize={40} />
    );

    let line = screen.getByTestId('konva-line');
    let points = JSON.parse(line.getAttribute('data-points') || '[]') as number[];

    // With gridSize 40, pixel position should be (200, 400)
    expect(points[0]).toBe(200);
    expect(points[1]).toBe(400);

    rerender(<RemoteCursor {...defaultProps} gridSize={10} />);

    line = screen.getByTestId('konva-line');
    points = JSON.parse(line.getAttribute('data-points') || '[]') as number[];

    // With gridSize 10, pixel position should be (50, 100)
    expect(points[0]).toBe(50);
    expect(points[1]).toBe(100);
  });

  it('uses collaborator color for cursor and label', () => {
    const blueCollaborator: CollaboratorInfo = {
      ...mockCollaborator,
      color: '#3b82f6',
    };

    render(
      <RemoteCursor
        collaborator={blueCollaborator}
        presence={mockPresenceWithCursor}
        gridSize={20}
      />
    );

    const line = screen.getByTestId('konva-line');
    expect(line.getAttribute('data-fill')).toBe('#3b82f6');

    const rect = screen.getByTestId('konva-rect');
    expect(rect.getAttribute('data-fill')).toBe('#3b82f6');
  });

  it('displays collaborator display name', () => {
    const longNameCollaborator: CollaboratorInfo = {
      ...mockCollaborator,
      displayName: 'Bob Smith',
    };

    render(
      <RemoteCursor
        collaborator={longNameCollaborator}
        presence={mockPresenceWithCursor}
        gridSize={20}
      />
    );

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-text')).toBe('Bob Smith');
  });

  it('renders with listening disabled for all shapes', () => {
    render(<RemoteCursor {...defaultProps} />);

    const groups = screen.getAllByTestId('konva-group');
    groups.forEach((group) => {
      // Groups have listening={false} passed as prop
      expect(group).toBeInTheDocument();
    });

    const line = screen.getByTestId('konva-line');
    expect(line).toBeInTheDocument();

    const rect = screen.getByTestId('konva-rect');
    expect(rect).toBeInTheDocument();

    const text = screen.getByTestId('konva-text');
    expect(text).toBeInTheDocument();
  });

  it('has displayName set correctly', () => {
    expect(RemoteCursor.displayName).toBe('RemoteCursor');
  });
});
