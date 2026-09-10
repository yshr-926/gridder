import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { ShapeNameField } from './ShapeNameField';

const rectShape = (id: string, name?: string): EditorShape => ({
  id,
  name,
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
  });
};

describe('ShapeNameField', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_escape_afterEditing_revertsWithoutCommittingOnTheFollowingBlur', async () => {
    const user = userEvent.setup();
    const shape = rectShape('a', 'Table');
    editorSession.dispatch(new CreateShapeCommand(shape));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeNameField shape={shape} />);
    const input = screen.getByLabelText('名前');
    await user.clear(input);
    await user.type(input, 'Desk');
    await user.keyboard('{Escape}');

    expect(input).toHaveValue('Table');
    expect(editorSession.undoDepth).toBe(depthBefore);
    expect(editorSession.getDocument().shapes['a']?.name).toBe('Table');
  });

  it('test_enter_afterEditing_commitsTheNewName', async () => {
    const user = userEvent.setup();
    const shape = rectShape('a', 'Table');
    editorSession.dispatch(new CreateShapeCommand(shape));

    render(<ShapeNameField shape={shape} />);
    const input = screen.getByLabelText('名前');
    await user.clear(input);
    await user.type(input, 'Desk{Enter}');

    expect(editorSession.getDocument().shapes['a']?.name).toBe('Desk');
  });

  it('test_editingAgainAfterEscape_stillCommits', async () => {
    const user = userEvent.setup();
    const shape = rectShape('a', 'Table');
    editorSession.dispatch(new CreateShapeCommand(shape));

    render(<ShapeNameField shape={shape} />);
    const input = screen.getByLabelText('名前');
    await user.clear(input);
    await user.type(input, 'Desk');
    await user.keyboard('{Escape}');

    // The cancel flag must not leak into the next edit.
    await user.clear(input);
    await user.type(input, 'Shelf{Enter}');

    expect(editorSession.getDocument().shapes['a']?.name).toBe('Shelf');
  });
});
