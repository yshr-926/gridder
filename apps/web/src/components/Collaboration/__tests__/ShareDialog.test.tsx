import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareDialog } from '../ShareDialog';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { apiClient } from '@/services/api/client';

// collaborationStore のモック
vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn(),
}));

// apiClient のモック
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// クリップボード API のモック
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('ShareDialog', () => {
  const mockOnClose = vi.fn();
  const mockRoom = {
    id: 'test-room-id-12345678901234',
    createdAt: new Date().toISOString(),
    participants: [],
  };

  const mockApiGet = apiClient.get as ReturnType<typeof vi.fn>;
  const mockApiPost = apiClient.post as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ hasPassphrase: false });
    vi.mocked(useCollaborationStore).mockReturnValue({
      room: mockRoom,
    } as ReturnType<typeof useCollaborationStore>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<ShareDialog isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('プロジェクトを共有')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'share-dialog-title');
  });

  it('should display share URL', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    const urlInput = screen.getByLabelText('共有URL') as HTMLInputElement;
    expect(urlInput.value).toContain('/room/test-room-id-12345678901234');
  });

  it('should call onClose when close button is clicked', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('閉じる');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when footer close button is clicked', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    // Get all buttons with '閉じる' text and click the footer one (second one)
    const closeButtons = screen.getAllByRole('button', { name: '閉じる' });
    // The footer close button is the second one (the first is the icon button with aria-label)
    fireEvent.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose when dialog content is clicked', () => {
    render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

    const title = screen.getByText('プロジェクトを共有');
    fireEvent.click(title);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  describe('Clipboard copy', () => {
    it('should copy URL to clipboard and show success message', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      const copyButton = screen.getByRole('button', { name: 'コピー' });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('/room/test-room-id-12345678901234')
        );
      });

      expect(screen.getByText('コピー完了')).toBeInTheDocument();
    });

    it('should handle clipboard error gracefully', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
      // Also mock execCommand to fail
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand not available');
      });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      const copyButton = screen.getByRole('button', { name: 'コピー' });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('URLのコピーに失敗しました')).toBeInTheDocument();
      });
    });
  });

  describe('Passphrase check', () => {
    it('should check passphrase status on open', async () => {
      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          '/api/rooms/test-room-id-12345678901234/has-passphrase'
        );
      });
    });

    it('should show passphrase status when set', async () => {
      mockApiGet.mockResolvedValue({ hasPassphrase: true });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(
          screen.getByText('パスフレーズが設定されています')
        ).toBeInTheDocument();
      });
    });

    it('should handle passphrase check API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      // Should not throw error and should gracefully handle
      await waitFor(() => {
        expect(
          screen.queryByText('パスフレーズが設定されています')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Passphrase setting', () => {
    it('should show error when setting passphrase without new passphrase', async () => {
      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const setButton = screen.getByRole('button', { name: '設定' });
      fireEvent.click(setButton);

      expect(
        screen.getByText('新しいパスフレーズを入力してください')
      ).toBeInTheDocument();
    });

    it('should call API to set passphrase', async () => {
      mockApiGet.mockResolvedValueOnce({ hasPassphrase: false });
      mockApiPost.mockResolvedValueOnce({ hasPassphrase: true });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const passphraseInput = screen.getByPlaceholderText('パスフレーズを設定');
      fireEvent.change(passphraseInput, { target: { value: 'testpass123' } });

      const setButton = screen.getByRole('button', { name: '設定' });
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          '/api/rooms/test-room-id-12345678901234/passphrase',
          {
            passphrase: 'testpass123',
            currentPassphrase: undefined,
          }
        );
      });
    });

    it('should show error when changing passphrase without current passphrase', async () => {
      mockApiGet.mockResolvedValue({ hasPassphrase: true });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(
          screen.getByText('パスフレーズが設定されています')
        ).toBeInTheDocument();
      });

      const newPassphraseInput =
        screen.getByPlaceholderText('新しいパスフレーズ');
      fireEvent.change(newPassphraseInput, { target: { value: 'newpass123' } });

      const changeButton = screen.getByRole('button', { name: '変更' });
      fireEvent.click(changeButton);

      expect(
        screen.getByText('現在のパスフレーズを入力してください')
      ).toBeInTheDocument();
    });

    it('should handle passphrase set API error', async () => {
      mockApiGet.mockResolvedValueOnce({ hasPassphrase: false });
      mockApiPost.mockRejectedValueOnce(new Error('Invalid passphrase'));

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const passphraseInput = screen.getByPlaceholderText('パスフレーズを設定');
      fireEvent.change(passphraseInput, { target: { value: 'testpass123' } });

      const setButton = screen.getByRole('button', { name: '設定' });
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid passphrase')).toBeInTheDocument();
      });
    });
  });

  describe('Passphrase clearing', () => {
    it('should show clear passphrase button when passphrase is set', async () => {
      mockApiGet.mockResolvedValue({ hasPassphrase: true });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('パスフレーズを解除')).toBeInTheDocument();
      });
    });

    it('should show error when clearing without current passphrase', async () => {
      mockApiGet.mockResolvedValue({ hasPassphrase: true });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('パスフレーズを解除')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('パスフレーズを解除');
      fireEvent.click(clearButton);

      expect(
        screen.getByText('解除するには現在のパスフレーズが必要です')
      ).toBeInTheDocument();
    });

    it('should call API to clear passphrase', async () => {
      mockApiGet.mockResolvedValueOnce({ hasPassphrase: true });
      mockApiPost.mockResolvedValueOnce({ hasPassphrase: false });

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('パスフレーズを解除')).toBeInTheDocument();
      });

      const currentPassphraseInput = screen.getByPlaceholderText(
        '現在のパスフレーズ'
      );
      fireEvent.change(currentPassphraseInput, {
        target: { value: 'currentpass' },
      });

      const clearButton = screen.getByText('パスフレーズを解除');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          '/api/rooms/test-room-id-12345678901234/passphrase',
          {
            passphrase: null,
            currentPassphrase: 'currentpass',
          }
        );
      });
    });
  });

  describe('No room connected', () => {
    it('should display empty URL when room is null', () => {
      vi.mocked(useCollaborationStore).mockReturnValue({
        room: null,
      } as ReturnType<typeof useCollaborationStore>);

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      const urlInput = screen.getByLabelText('共有URL') as HTMLInputElement;
      expect(urlInput.value).toBe('');
    });

    it('should disable copy button when room is null', () => {
      vi.mocked(useCollaborationStore).mockReturnValue({
        room: null,
      } as ReturnType<typeof useCollaborationStore>);

      render(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      const copyButton = screen.getByRole('button', { name: 'コピー' });
      expect(copyButton).toBeDisabled();
    });
  });

  describe('State reset on close', () => {
    it('should reset state when dialog closes', () => {
      const { rerender } = render(
        <ShareDialog isOpen={true} onClose={mockOnClose} />
      );

      // Simulate some state changes
      const passphraseInput = screen.getByPlaceholderText('パスフレーズを設定');
      fireEvent.change(passphraseInput, { target: { value: 'testpass' } });

      // Close dialog
      rerender(<ShareDialog isOpen={false} onClose={mockOnClose} />);

      // Reopen dialog
      rerender(<ShareDialog isOpen={true} onClose={mockOnClose} />);

      // State should be reset
      const newPassphraseInput = screen.getByPlaceholderText(
        'パスフレーズを設定'
      ) as HTMLInputElement;
      expect(newPassphraseInput.value).toBe('');
    });
  });
});
