import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { clearClipboardForTests } from '@/features/editor/clipboard';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';
import { ShapeStructureActions } from './ShapeStructureActions';

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

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
    clearClipboardForTests();
  });
};

describe('ShapeStructureActions', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_duplicateButton_duplicatesSelection', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');

    render(<ShapeStructureActions />);
    await user.click(screen.getByRole('button', { name: '複製' }));

    expect(editorSession.getDocument().zOrder).toHaveLength(2);
  });

  it('test_deleteButton_deletesSelection_withoutConfirmation', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    useSelectionStore.getState().selectOnly('a');

    render(<ShapeStructureActions />);
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(editorSession.getDocument().zOrder).toEqual([]);
  });

  it('test_bringToFrontButton_movesShapeToFront', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().selectOnly('a');

    render(<ShapeStructureActions />);
    await user.click(screen.getByRole('button', { name: '最前面へ' }));

    expect(editorSession.getDocument().zOrder).toEqual(['b', 'a']);
  });

  it('test_sendToBackButton_movesShapeToBack', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    useSelectionStore.getState().selectOnly('b');

    render(<ShapeStructureActions />);
    await user.click(screen.getByRole('button', { name: '最背面へ' }));

    expect(editorSession.getDocument().zOrder).toEqual(['b', 'a']);
  });
});
