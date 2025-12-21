/**
 * OfflineNotice コンポーネントテスト
 *
 * オフライン通知コンポーネントの表示テスト。
 * - オフライン時の表示
 * - オンライン復帰時の表示
 * - 自動非表示のテスト
 * - 閉じるボタンのテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { OfflineNotice } from '../OfflineNotice';
import { useCollaborationStore } from '@/stores/collaborationStore';

// Store をリセットするヘルパー
const resetStore = () => {
  useCollaborationStore.setState({
    connectionState: 'connected',
    room: null,
    self: null,
    collaborators: [],
    presences: new Map(),
    error: null,
  });
};

describe('OfflineNotice', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetStore();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should not render when initially connected', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });

      // Act
      const { container } = render(<OfflineNotice />);

      // Assert
      expect(container.firstChild).toBeNull();
    });
  });

  describe('offline state', () => {
    it('should show offline notice when disconnected', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();
    });

    it('should show offline notice when reconnecting', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'reconnecting',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();
    });

    it('should show helpful message about local storage', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      expect(
        screen.getByText('編集内容はローカルに保存され、再接続時に自動で同期されます')
      ).toBeInTheDocument();
    });

    it('should have yellow/warning styling when offline', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50', 'border-yellow-300', 'text-yellow-800');
    });
  });

  describe('reconnection state', () => {
    it('should show reconnected notice after coming back online', () => {
      // Arrange - Start offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      const { rerender } = render(<OfflineNotice />);
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();

      // Act - Come back online
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('オンラインに復帰しました')).toBeInTheDocument();
    });

    it('should show sync completed message after reconnection', () => {
      // Arrange - Start offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      const { rerender } = render(<OfflineNotice />);

      // Act - Come back online
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      // Assert
      expect(screen.getByText('変更が正常に同期されました')).toBeInTheDocument();
    });

    it('should have green/success styling when reconnected', () => {
      // Arrange - Start offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      const { rerender } = render(<OfflineNotice />);

      // Act - Come back online
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-green-50', 'border-green-300', 'text-green-800');
    });

    it('should auto-hide reconnection notice after 3 seconds', () => {
      // Arrange - Start offline then reconnect
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      const { rerender } = render(<OfflineNotice />);

      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      expect(screen.getByText('オンラインに復帰しました')).toBeInTheDocument();

      // Act - Wait 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('should have close button', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('button', { name: '通知を閉じる' })).toBeInTheDocument();
    });

    it('should hide notice when close button is clicked', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      render(<OfflineNotice />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole('button', { name: '通知を閉じる' }));

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should reset wasOffline state when closed while connected', () => {
      // Arrange - Go offline then online
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      const { rerender } = render(<OfflineNotice />);

      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      // Act - Close the notice
      fireEvent.click(screen.getByRole('button', { name: '通知を閉じる' }));

      // Simulate going offline again
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });
      rerender(<OfflineNotice />);

      // Assert - Should show offline notice again
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();
    });
  });

  describe('first connection', () => {
    it('should not show notice on first connection', () => {
      // Arrange - Never been offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connecting',
        });
      });

      const { rerender } = render(<OfflineNotice />);

      // Act - First connection
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);

      // Assert - No "reconnected" notice
      expect(screen.queryByText('オンラインに復帰しました')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });
    });

    it('should have alert role', () => {
      // Act
      render(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live polite', () => {
      // Act
      render(<OfflineNotice />);

      // Assert
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible close button', () => {
      // Act
      render(<OfflineNotice />);

      // Assert
      const closeButton = screen.getByRole('button', { name: '通知を閉じる' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', '通知を閉じる');
    });
  });

  describe('positioning', () => {
    it('should be positioned fixed at top center', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('fixed', 'top-16', 'left-1/2', 'transform', '-translate-x-1/2');
    });

    it('should have high z-index for proper layering', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });

      // Act
      render(<OfflineNotice />);

      // Assert
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('z-50');
    });
  });

  describe('displayName', () => {
    it('should have displayName set for memo optimization', () => {
      expect(OfflineNotice.displayName).toBe('OfflineNotice');
    });
  });

  describe('transition between states', () => {
    it('should handle multiple offline/online cycles', () => {
      // Arrange
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });

      const { rerender } = render(<OfflineNotice />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // First offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });
      rerender(<OfflineNotice />);
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();

      // First reconnect
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'connected',
        });
      });
      rerender(<OfflineNotice />);
      expect(screen.getByText('オンラインに復帰しました')).toBeInTheDocument();

      // Wait for auto-hide
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Second offline
      act(() => {
        useCollaborationStore.setState({
          connectionState: 'disconnected',
        });
      });
      rerender(<OfflineNotice />);
      expect(screen.getByText('オフラインモード')).toBeInTheDocument();
    });
  });
});
