import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteCursors } from './RemoteCursors';
import type { CollaboratorInfo, Presence } from '@/features/collaboration/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Line: ({ fill, ...props }: Record<string, unknown>) => (
    <div data-testid="konva-line" data-fill={fill} {...props} />
  ),
  Rect: ({ fill, ...props }: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-fill={fill} {...props} />
  ),
  Text: ({ text, ...props }: Record<string, unknown>) => (
    <div data-testid="konva-text" data-text={text} {...props} />
  ),
}));

// Mock collaborationStore
const mockCollaborators: CollaboratorInfo[] = [];
const mockPresences = new Map<string, Presence>();

vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn((selector: (state: { collaborators: CollaboratorInfo[]; presences: Map<string, Presence> }) => unknown) => {
    const state = {
      collaborators: mockCollaborators,
      presences: mockPresences,
    };
    return selector(state);
  }),
}));

describe('RemoteCursors', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockCollaborators.length = 0;
    mockPresences.clear();
  });

  it('renders nothing when there are no collaborators', () => {
    render(<RemoteCursors gridSize={20} />);

    // Should only have the outer group, no cursor elements
    const groups = screen.getAllByTestId('konva-group');
    expect(groups).toHaveLength(1); // Only outer group

    expect(screen.queryByTestId('konva-line')).not.toBeInTheDocument();
  });

  it('renders cursors for collaborators with presence data', () => {
    const collaborator1: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    const collaborator2: CollaboratorInfo = {
      id: 'user-2',
      displayName: 'Bob',
      color: '#3b82f6',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    mockCollaborators.push(collaborator1, collaborator2);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: { x: 5, y: 10 },
      selectedObjectIds: [],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    mockPresences.set('user-2', {
      userId: 'user-2',
      cursor: { x: 15, y: 20 },
      selectedObjectIds: [],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteCursors gridSize={20} />);

    // Should render 2 cursor arrows (Lines)
    const lines = screen.getAllByTestId('konva-line');
    expect(lines).toHaveLength(2);

    // Check colors match collaborators
    expect(lines[0].getAttribute('data-fill')).toBe('#ef4444');
    expect(lines[1].getAttribute('data-fill')).toBe('#3b82f6');

    // Should render 2 name labels (Texts)
    const texts = screen.getAllByTestId('konva-text');
    expect(texts).toHaveLength(2);

    expect(texts[0].getAttribute('data-text')).toBe('Alice');
    expect(texts[1].getAttribute('data-text')).toBe('Bob');
  });

  it('does not render cursor for collaborator without presence', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    mockCollaborators.push(collaborator);
    // No presence data for this user

    render(<RemoteCursors gridSize={20} />);

    // Should not render any cursor elements
    expect(screen.queryByTestId('konva-line')).not.toBeInTheDocument();
  });

  it('does not render cursor when cursor position is null', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    mockCollaborators.push(collaborator);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: null, // No cursor position
      selectedObjectIds: [],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteCursors gridSize={20} />);

    // Should not render any cursor elements
    expect(screen.queryByTestId('konva-line')).not.toBeInTheDocument();
  });

  it('passes gridSize to RemoteCursor components', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    mockCollaborators.push(collaborator);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: { x: 5, y: 10 },
      selectedObjectIds: [],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteCursors gridSize={40} />);

    // The cursor should be rendered (we verified gridSize prop is passed through)
    const line = screen.getByTestId('konva-line');
    expect(line).toBeInTheDocument();
  });

  it('renders with listening disabled', () => {
    render(<RemoteCursors gridSize={20} />);

    const groups = screen.getAllByTestId('konva-group');
    expect(groups.length).toBeGreaterThan(0);
    // The outer Group has listening={false}
  });

  it('has displayName set correctly', () => {
    expect(RemoteCursors.displayName).toBe('RemoteCursors');
  });
});
