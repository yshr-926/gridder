/**
 * SyncIndicator コンポーネントテスト
 *
 * 同期状態インジケーターの表示テスト。
 * - 各同期状態での表示確認
 * - 接続状態との連携確認
 * - コンパクトモードのテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { SyncIndicator } from '../SyncIndicator';
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
    syncState: 'idle',
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

describe('SyncIndicator', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('visibility', () => {
    it('should not render when room is null', () => {
      // Arrange & Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should render when room exists and connected', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });

      // Act
      render(<SyncIndicator />);

      // Assert
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('sync states', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
        });
      });
    });

    it('should show green dot and "同期済み" for idle state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          syncState: 'idle',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('同期済み')).toBeInTheDocument();
      const greenDot = container.querySelector('.bg-green-500');
      expect(greenDot).toBeInTheDocument();
    });

    it('should show blue animated dot and "同期中..." for syncing state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          syncState: 'syncing',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('同期中...')).toBeInTheDocument();
      const blueDot = container.querySelector('.bg-blue-500');
      expect(blueDot).toBeInTheDocument();
      expect(blueDot).toHaveClass('animate-pulse');
    });

    it('should show red dot and "同期エラー" for error state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          syncState: 'error',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('同期エラー')).toBeInTheDocument();
      const redDot = container.querySelector('.bg-red-500');
      expect(redDot).toBeInTheDocument();
    });
  });

  describe('connection states', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
        });
      });
    });

    it('should show gray dot and "オフライン" for disconnected state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
          syncState: 'idle',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('オフライン')).toBeInTheDocument();
      const grayDot = container.querySelector('.bg-gray-400');
      expect(grayDot).toBeInTheDocument();
    });

    it('should show yellow animated dot and "接続中..." for connecting state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connecting',
          syncState: 'idle',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('接続中...')).toBeInTheDocument();
      const yellowDot = container.querySelector('.bg-yellow-500');
      expect(yellowDot).toBeInTheDocument();
      expect(yellowDot).toHaveClass('animate-pulse');
    });

    it('should show yellow animated dot and "接続中..." for reconnecting state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'reconnecting',
          syncState: 'idle',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('接続中...')).toBeInTheDocument();
      const yellowDot = container.querySelector('.bg-yellow-500');
      expect(yellowDot).toBeInTheDocument();
    });

    it('should show red dot and "接続エラー" for error connection state', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'error',
          syncState: 'idle',
        });
      });

      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('接続エラー')).toBeInTheDocument();
      const redDot = container.querySelector('.bg-red-500');
      expect(redDot).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });
    });

    it('should show text in default mode', () => {
      // Act
      render(<SyncIndicator />);

      // Assert
      expect(screen.getByText('同期済み')).toBeInTheDocument();
    });

    it('should hide text in compact mode', () => {
      // Act
      render(<SyncIndicator compact={true} />);

      // Assert
      expect(screen.queryByText('同期済み')).not.toBeInTheDocument();
    });

    it('should still show dot in compact mode', () => {
      // Act
      const { container } = render(<SyncIndicator compact={true} />);

      // Assert
      const dot = container.querySelector('.w-2.h-2.rounded-full');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });
    });

    it('should have status role', () => {
      // Act
      render(<SyncIndicator />);

      // Assert
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label with sync state', () => {
      // Act
      render(<SyncIndicator />);

      // Assert
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '同期状態: 同期済み');
    });

    it('should update aria-label when state changes', () => {
      // Arrange
      const { rerender } = render(<SyncIndicator />);

      // Act
      act(() => {
        useCollaborationStore.setState({
          syncState: 'syncing',
        });
      });
      rerender(<SyncIndicator />);

      // Assert
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '同期状態: 同期中...');
    });

    it('should have aria-hidden on the dot', () => {
      // Act
      const { container } = render(<SyncIndicator />);

      // Assert
      const dot = container.querySelector('.w-2.h-2.rounded-full');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('className prop', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });
    });

    it('should apply custom className', () => {
      // Act
      render(<SyncIndicator className="custom-class" />);

      // Assert
      const status = screen.getByRole('status');
      expect(status).toHaveClass('custom-class');
    });

    it('should merge with default classes', () => {
      // Act
      render(<SyncIndicator className="custom-class" />);

      // Assert
      const status = screen.getByRole('status');
      expect(status).toHaveClass('flex', 'items-center', 'gap-1.5', 'custom-class');
    });
  });

  describe('displayName', () => {
    it('should have displayName set for memo optimization', () => {
      expect(SyncIndicator.displayName).toBe('SyncIndicator');
    });
  });

  describe('state updates', () => {
    it('should update when sync state changes', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });

      const { container, rerender } = render(<SyncIndicator />);

      expect(screen.getByText('同期済み')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();

      // Act - Change to syncing
      act(() => {
        useCollaborationStore.setState({
          syncState: 'syncing',
        });
      });
      rerender(<SyncIndicator />);

      // Assert
      expect(screen.getByText('同期中...')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
    });

    it('should update when connection state changes', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          room: mockRoom,
          self: mockSelf,
          connectionState: 'connected',
          syncState: 'idle',
        });
      });

      const { container, rerender } = render(<SyncIndicator />);

      expect(screen.getByText('同期済み')).toBeInTheDocument();

      // Act - Change to disconnected
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });
      rerender(<SyncIndicator />);

      // Assert
      expect(screen.getByText('オフライン')).toBeInTheDocument();
      expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
    });
  });
});
