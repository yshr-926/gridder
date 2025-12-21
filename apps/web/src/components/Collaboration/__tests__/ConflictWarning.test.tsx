/**
 * ConflictWarning コンポーネントテスト
 *
 * 編集競合警告コンポーネントの表示テスト。
 * - 競合検出のテスト
 * - 警告表示/非表示のテスト
 * - 閉じるボタンのテスト
 * - 自動非表示のテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { ConflictWarning } from '../ConflictWarning';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useCanvasStore } from '@/stores/canvasStore';
import type { Presence } from '@/features/collaboration/types';

// Store をリセットするヘルパー
const resetStores = () => {
  useCollaborationStore.setState({
    connectionState: 'disconnected',
    room: null,
    self: null,
    collaborators: [],
    presences: new Map(),
    error: null,
  });

  useCanvasStore.getState().clearObjects();
  useCanvasStore.getState().clearSelection();
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

// テスト用のコラボレーター情報
const mockCollaborator = {
  id: 'user-2',
  displayName: 'OtherUser',
  color: '#3b82f6',
  connectedAt: '2024-01-01T00:00:00.000Z',
};

// テスト用のプレゼンス情報
const createMockPresence = (
  userId: string,
  selectedObjectIds: string[] = []
): Presence => ({
  userId,
  cursor: null,
  selectedObjectIds,
  updatedAt: new Date().toISOString(),
});

describe('ConflictWarning', () => {
  beforeEach(() => {
    resetStores();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetStores();
    vi.useRealTimers();
  });

  describe('visibility', () => {
    it('should not render when room is null', () => {
      // Arrange & Act
      const { container } = render(<ConflictWarning />);

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should not render when no conflicts exist', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        // 自分は別のオブジェクトを選択
        useCanvasStore.getState().selectObjects(['obj-2']);
      });

      // Act
      const { container } = render(<ConflictWarning />);

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should render when conflict exists', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        // 同じオブジェクトを選択（競合）
        useCanvasStore.getState().selectObjects(['obj-1']);
      });

      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('編集競合の可能性')).toBeInTheDocument();
    });
  });

  describe('conflict detection', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
        });
      });
    });

    it('should show conflict user name', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });

      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByText(/OtherUser/)).toBeInTheDocument();
      expect(screen.getByText(/が同じオブジェクトを編集中です/)).toBeInTheDocument();
    });

    it('should show multiple conflict users', () => {
      // Arrange
      const anotherCollaborator = {
        id: 'user-3',
        displayName: 'AnotherUser',
        color: '#22c55e',
        connectedAt: '2024-01-01T00:00:00.000Z',
      };

      act(() => {
        useCollaborationStore.setState({
          collaborators: [mockCollaborator, anotherCollaborator],
          presences: new Map([
            ['user-2', createMockPresence('user-2', ['obj-1'])],
            ['user-3', createMockPresence('user-3', ['obj-1'])],
          ]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });

      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByText(/AnotherUser, OtherUser/)).toBeInTheDocument();
    });

    it('should detect conflict for multiple selected objects', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-2'])]]),
        });
        // 複数オブジェクトを選択、そのうち1つが競合
        useCanvasStore.getState().selectObjects(['obj-1', 'obj-2', 'obj-3']);
      });

      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('dismiss functionality', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });
    });

    it('should have close button', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('button', { name: '警告を閉じる' })).toBeInTheDocument();
    });

    it('should dismiss when close button is clicked', () => {
      // Arrange
      render(<ConflictWarning />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole('button', { name: '警告を閉じる' }));

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('auto-hide functionality', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });
    });

    it('should not auto-hide when autoHideMs is 0', async () => {
      // Arrange
      render(<ConflictWarning autoHideMs={0} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Act
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should auto-hide after specified time', () => {
      // Arrange
      render(<ConflictWarning autoHideMs={3000} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Act
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not auto-hide before specified time', () => {
      // Arrange
      render(<ConflictWarning autoHideMs={3000} />);

      // Act
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });
    });

    it('should have alert role', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live polite', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible close button', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      const closeButton = screen.getByRole('button', { name: '警告を閉じる' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', '警告を閉じる');
    });
  });

  describe('styling', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });
    });

    it('should be positioned fixed at bottom-right', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('fixed', 'bottom-4', 'right-4');
    });

    it('should have warning style (yellow)', () => {
      // Act
      render(<ConflictWarning />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50', 'border-yellow-300');
    });

    it('should apply custom className', () => {
      // Act
      render(<ConflictWarning className="custom-class" />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });
  });

  describe('displayName', () => {
    it('should have displayName set for memo optimization', () => {
      expect(ConflictWarning.displayName).toBe('ConflictWarning');
    });
  });

  describe('conflict state changes', () => {
    it('should appear when conflict starts', () => {
      // Arrange - No conflict initially
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-2'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });

      const { rerender } = render(<ConflictWarning />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Act - Conflict starts
      act(() => {
        useCollaborationStore.setState({
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
      });
      rerender(<ConflictWarning />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should disappear when conflict ends', () => {
      // Arrange - Conflict exists
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          collaborators: [mockCollaborator],
          presences: new Map([['user-2', createMockPresence('user-2', ['obj-1'])]]),
        });
        useCanvasStore.getState().selectObjects(['obj-1']);
      });

      const { rerender } = render(<ConflictWarning />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Act - Conflict ends (other user deselects)
      act(() => {
        useCollaborationStore.setState({
          presences: new Map([['user-2', createMockPresence('user-2', [])]]),
        });
      });
      rerender(<ConflictWarning />);

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
