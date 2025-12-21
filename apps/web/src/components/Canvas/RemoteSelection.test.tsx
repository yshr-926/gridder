import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteSelection } from './RemoteSelection';
import type { CollaboratorInfo, Presence } from '@/features/collaboration/types';
import type { GridObject } from '@/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: ({
    x,
    y,
    width,
    height,
    stroke,
    strokeWidth,
    dash,
    ...props
  }: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dash={dash ? JSON.stringify(dash) : undefined}
      {...props}
    />
  ),
}));

// Mock data
const mockCollaborators: CollaboratorInfo[] = [];
const mockPresences = new Map<string, Presence>();
const mockObjects: GridObject[] = [];

// Mock collaborationStore
vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn((selector: (state: { collaborators: CollaboratorInfo[]; presences: Map<string, Presence> }) => unknown) => {
    const state = {
      collaborators: mockCollaborators,
      presences: mockPresences,
    };
    return selector(state);
  }),
}));

// Mock canvasStore
vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: vi.fn((selector: (state: { objects: GridObject[] }) => unknown) => {
    const state = {
      objects: mockObjects,
    };
    return selector(state);
  }),
}));

describe('RemoteSelection', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockCollaborators.length = 0;
    mockPresences.clear();
    mockObjects.length = 0;
  });

  it('renders nothing when there are no collaborators', () => {
    render(<RemoteSelection gridSize={20} />);

    // Should only have the outer group, no selection rects
    const groups = screen.getAllByTestId('konva-group');
    expect(groups).toHaveLength(1);

    expect(screen.queryByTestId('konva-rect')).not.toBeInTheDocument();
  });

  it('renders nothing when collaborators have no selections', () => {
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
      selectedObjectIds: [], // No selections
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteSelection gridSize={20} />);

    expect(screen.queryByTestId('konva-rect')).not.toBeInTheDocument();
  });

  it('renders selection highlight for selected object', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    const testObject: GridObject = {
      id: 'obj-1',
      cells: [[0, 0], [1, 0], [1, 1]],
      position: { x: 5, y: 10 },
      rotation: 0,
      color: '#333333',
    };

    mockCollaborators.push(collaborator);
    mockObjects.push(testObject);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: { x: 5, y: 10 },
      selectedObjectIds: ['obj-1'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteSelection gridSize={20} />);

    const rect = screen.getByTestId('konva-rect');
    expect(rect).toBeInTheDocument();

    // Check stroke color matches collaborator color
    expect(rect.getAttribute('data-stroke')).toBe('#ef4444');

    // Check stroke width
    expect(rect.getAttribute('data-stroke-width')).toBe('2');

    // Check dashed pattern
    expect(rect.getAttribute('data-dash')).toBe('[5,5]');
  });

  it('calculates correct bounding box position', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    // Object with cells at (0,0), (1,0), (1,1) and position (5, 10)
    const testObject: GridObject = {
      id: 'obj-1',
      cells: [[0, 0], [1, 0], [1, 1]],
      position: { x: 5, y: 10 },
      rotation: 0,
      color: '#333333',
    };

    mockCollaborators.push(collaborator);
    mockObjects.push(testObject);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: null,
      selectedObjectIds: ['obj-1'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    const gridSize = 20;
    render(<RemoteSelection gridSize={gridSize} />);

    const rect = screen.getByTestId('konva-rect');

    // minX = 0, minY = 0, maxX = 1, maxY = 1
    // x = (5 + 0) * 20 = 100
    // y = (10 + 0) * 20 = 200
    // width = (1 - 0 + 1) * 20 = 40
    // height = (1 - 0 + 1) * 20 = 40
    expect(rect.getAttribute('data-x')).toBe('100');
    expect(rect.getAttribute('data-y')).toBe('200');
    expect(rect.getAttribute('data-width')).toBe('40');
    expect(rect.getAttribute('data-height')).toBe('40');
  });

  it('renders multiple selection highlights for multiple objects', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    const object1: GridObject = {
      id: 'obj-1',
      cells: [[0, 0]],
      position: { x: 0, y: 0 },
      rotation: 0,
      color: '#333333',
    };

    const object2: GridObject = {
      id: 'obj-2',
      cells: [[0, 0], [1, 0]],
      position: { x: 10, y: 10 },
      rotation: 0,
      color: '#666666',
    };

    mockCollaborators.push(collaborator);
    mockObjects.push(object1, object2);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: null,
      selectedObjectIds: ['obj-1', 'obj-2'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteSelection gridSize={20} />);

    const rects = screen.getAllByTestId('konva-rect');
    expect(rects).toHaveLength(2);

    // Both should have the same collaborator color
    expect(rects[0].getAttribute('data-stroke')).toBe('#ef4444');
    expect(rects[1].getAttribute('data-stroke')).toBe('#ef4444');
  });

  it('renders selections from multiple collaborators', () => {
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

    const object1: GridObject = {
      id: 'obj-1',
      cells: [[0, 0]],
      position: { x: 0, y: 0 },
      rotation: 0,
      color: '#333333',
    };

    const object2: GridObject = {
      id: 'obj-2',
      cells: [[0, 0]],
      position: { x: 5, y: 5 },
      rotation: 0,
      color: '#666666',
    };

    mockCollaborators.push(collaborator1, collaborator2);
    mockObjects.push(object1, object2);

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: null,
      selectedObjectIds: ['obj-1'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    mockPresences.set('user-2', {
      userId: 'user-2',
      cursor: null,
      selectedObjectIds: ['obj-2'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteSelection gridSize={20} />);

    const rects = screen.getAllByTestId('konva-rect');
    expect(rects).toHaveLength(2);

    // Each rect should have different collaborator colors
    const colors = rects.map((rect) => rect.getAttribute('data-stroke'));
    expect(colors).toContain('#ef4444');
    expect(colors).toContain('#3b82f6');
  });

  it('does not render for non-existent object', () => {
    const collaborator: CollaboratorInfo = {
      id: 'user-1',
      displayName: 'Alice',
      color: '#ef4444',
      connectedAt: '2025-01-01T00:00:00Z',
    };

    mockCollaborators.push(collaborator);
    // No objects in mockObjects

    mockPresences.set('user-1', {
      userId: 'user-1',
      cursor: null,
      selectedObjectIds: ['non-existent-obj'],
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(<RemoteSelection gridSize={20} />);

    expect(screen.queryByTestId('konva-rect')).not.toBeInTheDocument();
  });

  it('renders with listening disabled', () => {
    render(<RemoteSelection gridSize={20} />);

    const group = screen.getByTestId('konva-group');
    expect(group).toBeInTheDocument();
    // The Group has listening={false}
  });

  it('has displayName set correctly', () => {
    expect(RemoteSelection.displayName).toBe('RemoteSelection');
  });
});
