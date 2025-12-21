import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { ParticipantsList } from '../ParticipantsList';
import { useCollaborationStore } from '@/stores/collaborationStore';

// Store をリセットするヘルパー
const resetStore = () => {
  useCollaborationStore.setState({
    connectionState: 'disconnected',
    room: null,
    self: null,
    collaborators: [],
    presences: new Map(),
    error: null,
  });
};

// テスト用のモックユーザー情報
const mockSelf = {
  id: 'user-1',
  displayName: 'TestUser',
  color: '#ef4444',
  connectedAt: '2024-01-01T00:00:00.000Z',
};

const mockCollaborators = [
  {
    id: 'user-2',
    displayName: 'Collaborator1',
    color: '#22c55e',
    connectedAt: '2024-01-01T00:01:00.000Z',
  },
  {
    id: 'user-3',
    displayName: 'Collaborator2',
    color: '#3b82f6',
    connectedAt: '2024-01-01T00:02:00.000Z',
  },
];

describe('ParticipantsList', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('should not render when self is null', () => {
    render(<ParticipantsList />);

    expect(screen.queryByText(/参加者/)).not.toBeInTheDocument();
  });

  it('should render when self exists', () => {
    act(() => {
      useCollaborationStore.setState({ self: mockSelf });
    });

    render(<ParticipantsList />);

    expect(screen.getByText(/参加者/)).toBeInTheDocument();
  });

  it('should show correct participant count', () => {
    act(() => {
      useCollaborationStore.setState({
        self: mockSelf,
        collaborators: mockCollaborators,
      });
    });

    render(<ParticipantsList />);

    // 自分（1）+ 協力者（2）= 3人
    expect(screen.getByText('参加者（3）')).toBeInTheDocument();
  });

  it('should show self with (あなた) suffix', () => {
    act(() => {
      useCollaborationStore.setState({ self: mockSelf });
    });

    render(<ParticipantsList />);

    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('（あなた）')).toBeInTheDocument();
  });

  it('should show collaborators without (あなた) suffix', () => {
    act(() => {
      useCollaborationStore.setState({
        self: mockSelf,
        collaborators: mockCollaborators,
      });
    });

    render(<ParticipantsList />);

    expect(screen.getByText('Collaborator1')).toBeInTheDocument();
    expect(screen.getByText('Collaborator2')).toBeInTheDocument();
    // Only one (あなた) for self
    expect(screen.getAllByText('（あなた）')).toHaveLength(1);
  });

  it('should show color dots for each participant', () => {
    act(() => {
      useCollaborationStore.setState({
        self: mockSelf,
        collaborators: mockCollaborators,
      });
    });

    const { container } = render(<ParticipantsList />);

    // Find color dots by style attribute
    const colorDots = container.querySelectorAll('[style*="background-color"]');
    expect(colorDots.length).toBe(3); // self + 2 collaborators

    // Check each color
    expect(colorDots[0]).toHaveStyle({ backgroundColor: '#ef4444' }); // self
    expect(colorDots[1]).toHaveStyle({ backgroundColor: '#22c55e' }); // collaborator 1
    expect(colorDots[2]).toHaveStyle({ backgroundColor: '#3b82f6' }); // collaborator 2
  });

  it('should render self first in the list', () => {
    act(() => {
      useCollaborationStore.setState({
        self: mockSelf,
        collaborators: mockCollaborators,
      });
    });

    render(<ParticipantsList />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(3);

    // First item should be self (contains あなた)
    expect(listItems[0]).toHaveTextContent('TestUser');
    expect(listItems[0]).toHaveTextContent('（あなた）');
  });

  it('should show only self when no collaborators', () => {
    act(() => {
      useCollaborationStore.setState({
        self: mockSelf,
        collaborators: [],
      });
    });

    render(<ParticipantsList />);

    expect(screen.getByText('参加者（1）')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('should update when store changes', () => {
    const { rerender } = render(<ParticipantsList />);

    // Initially not rendered
    expect(screen.queryByText(/参加者/)).not.toBeInTheDocument();

    // Update store
    act(() => {
      useCollaborationStore.setState({ self: mockSelf });
    });

    rerender(<ParticipantsList />);

    expect(screen.getByText(/参加者/)).toBeInTheDocument();
  });

  it('should have displayName set for memo optimization', () => {
    expect(ParticipantsList.displayName).toBe('ParticipantsList');
  });

  it('should handle long display names with truncation class', () => {
    const longNameSelf = {
      ...mockSelf,
      displayName: 'VeryLongDisplayNameThatShouldBeTruncated',
    };

    act(() => {
      useCollaborationStore.setState({ self: longNameSelf });
    });

    const { container } = render(<ParticipantsList />);

    // Check that truncate class is applied
    const nameElement = container.querySelector('.truncate');
    expect(nameElement).toBeInTheDocument();
  });
});
