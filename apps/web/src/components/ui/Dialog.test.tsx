import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './Dialog';

describe('ConfirmDialog', () => {
  it('test_open_false_rendersNothing', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="保存されていません"
        description="変更を破棄しますか？"
        confirmLabel="破棄"
        onConfirm={() => {}}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_open_true_rendersTitleAndDescription', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="保存されていません"
        description="変更を破棄しますか？"
        confirmLabel="破棄"
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('保存されていません')).toBeInTheDocument();
    expect(screen.getByText('変更を破棄しますか？')).toBeInTheDocument();
  });

  it('test_confirmButton_callsOnConfirm_andClosesTheDialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="保存されていません"
        description="変更を破棄しますか？"
        confirmLabel="破棄して新規作成"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: '破棄して新規作成' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('test_cancelButton_closesWithoutCallingOnConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="保存されていません"
        description="変更を破棄しますか？"
        confirmLabel="破棄"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('test_customCancelLabel_isUsed', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="t"
        description="d"
        confirmLabel="破棄"
        cancelLabel="戻る"
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument();
  });
});
