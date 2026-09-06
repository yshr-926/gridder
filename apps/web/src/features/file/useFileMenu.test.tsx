import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { ConfirmDialog } from '@/components/ui';
import { createEmptyDocument, editorSession } from '@/features/editor';
import { resetDirtyTrackingForTests } from './dirtyTracking';
import { useFileMenu } from './useFileMenu';

/**
 * The confirmation dialog itself is unit-tested in `components/ui/Dialog.test.tsx`;
 * this file checks the thing issue #54 actually needs verified end-to-end —
 * that `useFileMenu` only shows it when the sketch is dirty, and that
 * confirming or cancelling drives the right file operation.
 */

const openSketchFileMock = vi.fn<(adapter: unknown) => Promise<boolean>>(async () => true);
const saveSketchMock = vi.fn<(adapter: unknown) => Promise<boolean>>(async () => true);
const saveSketchAsMock = vi.fn<(adapter: unknown) => Promise<boolean>>(async () => true);
const startNewSketchMock = vi.fn(() => {
  editorSession.reset(createEmptyDocument());
});

vi.mock('./fileSession', () => ({
  openSketchFile: (adapter: unknown) => openSketchFileMock(adapter),
  saveSketch: (adapter: unknown) => saveSketchMock(adapter),
  saveSketchAs: (adapter: unknown) => saveSketchAsMock(adapter),
  startNewSketch: () => startNewSketchMock(),
}));

vi.mock('./selectFileAdapter', () => ({
  selectFileAdapter: () => ({
    hasAssociatedFile: false,
    save: vi.fn(),
    saveAs: vi.fn(),
    open: vi.fn(),
  }),
}));

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

/** Minimal Header-menu stand-in: exercises `useFileMenu` wired to `ConfirmDialog` the way the Header will. */
const FileMenuHarness = () => {
  const menu = useFileMenu();
  return (
    <div>
      <button onClick={menu.requestNew}>新規</button>
      <button onClick={menu.requestOpen}>開く</button>
      <button onClick={menu.save}>保存</button>
      <button onClick={menu.saveAs}>名前を付けて保存</button>
      <ConfirmDialog
        open={menu.pendingConfirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            menu.cancelDiscard();
          }
        }}
        title="保存されていない変更があります"
        description="このまま続けると変更は失われます。"
        confirmLabel="破棄して続ける"
        onConfirm={menu.confirmDiscard}
      />
    </div>
  );
};

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    resetDirtyTrackingForTests();
  });
  vi.clearAllMocks();
};

describe('useFileMenu', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_requestNew_documentNotDirty_startsImmediately_noDialog', async () => {
    const user = userEvent.setup();
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '新規' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(startNewSketchMock).toHaveBeenCalledTimes(1);
  });

  it('test_requestNew_documentDirty_showsConfirmDialog_beforeStartingNew', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '新規' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(startNewSketchMock).not.toHaveBeenCalled();
  });

  it('test_confirmDiscard_afterDirtyRequestNew_startsNewSketch_andClosesDialog', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    render(<FileMenuHarness />);
    await user.click(screen.getByRole('button', { name: '新規' }));

    await user.click(screen.getByRole('button', { name: '破棄して続ける' }));

    expect(startNewSketchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_cancelDiscard_afterDirtyRequestNew_doesNotStartNew_closesDialog', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    render(<FileMenuHarness />);
    await user.click(screen.getByRole('button', { name: '新規' }));

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(startNewSketchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_requestOpen_documentDirty_showsConfirmDialog_confirmOpensFile', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '開く' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(openSketchFileMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '破棄して続ける' }));
    expect(openSketchFileMock).toHaveBeenCalledTimes(1);
  });

  it('test_requestOpen_documentNotDirty_opensImmediately_noDialog', async () => {
    const user = userEvent.setup();
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '開く' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openSketchFileMock).toHaveBeenCalledTimes(1);
  });

  it('test_save_delegatesToFileSession_withoutAnyConfirmation', async () => {
    const user = userEvent.setup();
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(saveSketchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_saveAs_delegatesToFileSession_withoutAnyConfirmation', async () => {
    const user = userEvent.setup();
    render(<FileMenuHarness />);

    await user.click(screen.getByRole('button', { name: '名前を付けて保存' }));

    expect(saveSketchAsMock).toHaveBeenCalledTimes(1);
  });
});
