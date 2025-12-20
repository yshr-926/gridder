import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplayNameDialog } from '../DisplayNameDialog';

// localStorage のモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('DisplayNameDialog', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <DisplayNameDialog
        isOpen={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('共同編集に参加')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'display-name-dialog-title');
  });

  it('should show input field with label', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText('表示名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('あなたの名前を入力')).toBeInTheDocument();
  });

  it('should call onCancel when close button is clicked', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByLabelText('閉じる');
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when Escape key is pressed', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when overlay is clicked', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not call onCancel when dialog content is clicked', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const title = screen.getByText('共同編集に参加');
    fireEvent.click(title);

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should submit with entered name when form is submitted', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: 'TestUser' } });

    const submitButton = screen.getByText('参加');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('TestUser');
  });

  it('should save name to localStorage when submitted', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: 'SavedUser' } });

    const submitButton = screen.getByText('参加');
    fireEvent.click(submitButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'gridder_display_name',
      'SavedUser'
    );
  });

  it('should generate default name when submitted with empty input', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('参加');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.stringMatching(/^Guest-[a-z0-9]{4}$/));
  });

  it('should generate default name when submitted with whitespace-only input', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: '   ' } });

    const submitButton = screen.getByText('参加');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.stringMatching(/^Guest-[a-z0-9]{4}$/));
  });

  it('should trim whitespace from name when submitted', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: '  TrimmedName  ' } });

    const submitButton = screen.getByText('参加');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('TrimmedName');
  });

  it('should load saved name from localStorage when opened', () => {
    localStorageMock.getItem.mockReturnValue('SavedName');

    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名') as HTMLInputElement;
    expect(input.value).toBe('SavedName');
  });

  it('should have maxLength attribute on input', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    expect(input).toHaveAttribute('maxLength', '20');
  });

  it('should show max length hint', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/最大20文字/)).toBeInTheDocument();
  });

  it('should handle localStorage error gracefully when loading', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    // Should not throw
    expect(() => {
      render(
        <DisplayNameDialog
          isOpen={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    }).not.toThrow();
  });

  it('should handle localStorage error gracefully when saving', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: 'TestUser' } });

    const submitButton = screen.getByText('参加');

    // Should not throw and still call onSubmit
    expect(() => {
      fireEvent.click(submitButton);
    }).not.toThrow();

    expect(mockOnSubmit).toHaveBeenCalledWith('TestUser');
  });

  it('should submit on Enter key in input', () => {
    render(
      <DisplayNameDialog
        isOpen={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText('表示名');
    fireEvent.change(input, { target: { value: 'EnterUser' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockOnSubmit).toHaveBeenCalledWith('EnterUser');
  });
});
