import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { CollaborationPanel } from '../CollaborationPanel';
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

// テスト用のモックルーム情報
const mockRoom = {
  id: 'room-123',
  createdAt: '2024-01-01T00:00:00.000Z',
  participants: [],
};

// テスト用のモックユーザー情報
const mockSelf = {
  id: 'user-1',
  displayName: 'TestUser',
  color: '#ef4444',
  connectedAt: '2024-01-01T00:00:00.000Z',
};

describe('CollaborationPanel', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('should not render when room is null', () => {
    render(<CollaborationPanel />);

    expect(screen.queryByText(/接続中/)).not.toBeInTheDocument();
    expect(screen.queryByText(/参加者/)).not.toBeInTheDocument();
  });

  it('should render when room exists', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    render(<CollaborationPanel />);

    expect(screen.getByText('接続中')).toBeInTheDocument();
  });

  it('should show green dot and "接続中" for connected state', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    const { container } = render(<CollaborationPanel />);

    expect(screen.getByText('接続中')).toBeInTheDocument();

    // Check for green dot
    const greenDot = container.querySelector('.bg-green-500');
    expect(greenDot).toBeInTheDocument();
  });

  it('should show yellow dot and "接続中..." for connecting state', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        connectionState: 'connecting',
      });
    });

    const { container } = render(<CollaborationPanel />);

    expect(screen.getByText('接続中...')).toBeInTheDocument();

    // Check for yellow dot
    const yellowDot = container.querySelector('.bg-yellow-500');
    expect(yellowDot).toBeInTheDocument();
  });

  it('should show yellow dot and "再接続中..." for reconnecting state', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        connectionState: 'reconnecting',
      });
    });

    const { container } = render(<CollaborationPanel />);

    expect(screen.getByText('再接続中...')).toBeInTheDocument();

    // Check for yellow dot
    const yellowDot = container.querySelector('.bg-yellow-500');
    expect(yellowDot).toBeInTheDocument();
  });

  it('should show red dot and "切断" for disconnected state', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        connectionState: 'disconnected',
      });
    });

    const { container } = render(<CollaborationPanel />);

    expect(screen.getByText('切断')).toBeInTheDocument();

    // Check for red dot
    const redDot = container.querySelector('.bg-red-500');
    expect(redDot).toBeInTheDocument();
  });

  it('should show red dot and "エラー" for error state', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        connectionState: 'error',
      });
    });

    const { container } = render(<CollaborationPanel />);

    expect(screen.getByText('エラー')).toBeInTheDocument();

    // Check for red dot
    const redDot = container.querySelector('.bg-red-500');
    expect(redDot).toBeInTheDocument();
  });

  it('should show error message when error exists', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        connectionState: 'error',
        error: 'パスフレーズが正しくありません',
      });
    });

    render(<CollaborationPanel />);

    expect(screen.getByText('パスフレーズが正しくありません')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should not show error message when error is null', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
        error: null,
      });
    });

    render(<CollaborationPanel />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should include ParticipantsList component', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    render(<CollaborationPanel />);

    // ParticipantsList should show participants header
    expect(screen.getByText(/参加者/)).toBeInTheDocument();
  });

  it('should be positioned absolutely at top-right', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    const { container } = render(<CollaborationPanel />);

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass('absolute', 'top-4', 'right-4');
  });

  it('should have z-index for proper layering', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    const { container } = render(<CollaborationPanel />);

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass('z-10');
  });

  it('should have displayName set for memo optimization', () => {
    expect(CollaborationPanel.displayName).toBe('CollaborationPanel');
  });

  it('should update when connection state changes', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    const { rerender, container } = render(<CollaborationPanel />);

    expect(screen.getByText('接続中')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();

    // Change to disconnected
    act(() => {
      useCollaborationStore.setState({
        connectionState: 'disconnected',
      });
    });

    rerender(<CollaborationPanel />);

    expect(screen.getByText('切断')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('should have correct width', () => {
    act(() => {
      useCollaborationStore.setState({
        room: mockRoom,
        self: mockSelf,
        connectionState: 'connected',
      });
    });

    const { container } = render(<CollaborationPanel />);

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass('w-64');
  });
});
