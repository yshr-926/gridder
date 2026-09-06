import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  const props = {
    onNewSketch: vi.fn(),
    onOpenSketch: vi.fn(),
    onSaveSketch: vi.fn(),
    onSaveSketchAs: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: false,
    onAddPolygon: vi.fn(),
    isAddingPolygon: false,
    onSharePNG: vi.fn(),
    onShareJPEG: vi.fn(),
    onFitDrawingBoundsToContent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides accessible names for every top-bar button', () => {
    render(<Header {...props} />);

    expect(screen.getByRole('button', { name: 'ファイル' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'やり直す' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ポリゴンを追加' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '内容に合わせる' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '共有' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '設定' })).toBeInTheDocument();
  });

  it('invokes history and polygon actions', async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);

    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    await user.click(screen.getByRole('button', { name: 'ポリゴンを追加' }));

    expect(props.onUndo).toHaveBeenCalledOnce();
    expect(props.onAddPolygon).toHaveBeenCalledOnce();
  });

  it('invokes the fit-to-content action', async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);

    await user.click(screen.getByRole('button', { name: '内容に合わせる' }));

    expect(props.onFitDrawingBoundsToContent).toHaveBeenCalledOnce();
  });

  it('opens the file menu and invokes its actions', async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);

    await user.click(screen.getByRole('button', { name: 'ファイル' }));
    await user.click(await screen.findByRole('menuitem', { name: '新規スケッチ' }));

    expect(props.onNewSketch).toHaveBeenCalledOnce();
  });

  it('invokes save and save-as from the file menu', async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);

    await user.click(screen.getByRole('button', { name: 'ファイル' }));
    await user.click(await screen.findByRole('menuitem', { name: '保存' }));
    expect(props.onSaveSketch).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'ファイル' }));
    await user.click(await screen.findByRole('menuitem', { name: '名前を付けて保存' }));
    expect(props.onSaveSketchAs).toHaveBeenCalledOnce();
  });

  it('delegates top-bar tooltips to Base UI', () => {
    render(<Header {...props} />);

    expect(screen.getByRole('button', { name: 'ポリゴンを追加' })).toHaveAttribute(
      'data-base-ui-tooltip-trigger'
    );
    expect(screen.getByRole('button', { name: '設定' })).toHaveAttribute(
      'data-base-ui-tooltip-trigger'
    );
  });
});
