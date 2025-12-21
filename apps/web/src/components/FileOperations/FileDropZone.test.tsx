import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDropZone } from './FileDropZone';

describe('FileDropZone', () => {
  const mockOnFileDrop = vi.fn();

  beforeEach(() => {
    mockOnFileDrop.mockClear();
  });

  it('should render drop zone', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    expect(screen.getByText(/ファイルをドラッグ/)).toBeInTheDocument();
    expect(screen.getByText(/クリックして選択/)).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');
    expect(dropZone).toHaveAttribute('aria-label', 'ファイルをドロップまたはクリックして選択');
    expect(dropZone).toHaveAttribute('tabIndex', '0');
  });

  it('should call onFileDrop when file is dropped', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockOnFileDrop).toHaveBeenCalledWith(file);
  });

  it('should show visual feedback on drag over', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');

    fireEvent.dragOver(dropZone);

    // ドラッグ中はテキストが変わる
    expect(screen.getByText('ファイルをドロップ')).toBeInTheDocument();
  });

  it('should clear visual feedback on drag leave', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');

    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);

    expect(screen.getByText(/ファイルをドラッグ/)).toBeInTheDocument();
  });

  it('should trigger file input on click', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');
    const fileInput = document.querySelector('input[type="file"]');

    expect(fileInput).not.toBeNull();

    // クリックイベントをシミュレート
    const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');
    fireEvent.click(dropZone);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should trigger file input on Enter key', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const dropZone = screen.getByRole('button');
    const fileInput = document.querySelector('input[type="file"]');

    const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');
    fireEvent.keyDown(dropZone, { key: 'Enter' });

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should call onFileDrop when file is selected via input', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'test.json', { type: 'application/json' });

    // ファイル選択をシミュレート
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    expect(mockOnFileDrop).toHaveBeenCalledWith(file);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} disabled />);

    const dropZone = screen.getByRole('button');
    expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    expect(dropZone).toHaveAttribute('tabIndex', '-1');
  });

  it('should not call onFileDrop when disabled', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} disabled />);

    const dropZone = screen.getByRole('button');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockOnFileDrop).not.toHaveBeenCalled();
  });

  it('should accept custom accept prop', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} accept=".txt" />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute('accept', '.txt');
  });

  it('should apply custom className', () => {
    render(<FileDropZone onFileDrop={mockOnFileDrop} className="custom-class" />);

    const dropZone = screen.getByRole('button');
    expect(dropZone).toHaveClass('custom-class');
  });
});
