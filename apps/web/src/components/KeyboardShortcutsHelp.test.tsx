import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

const renderOpen = () => render(<KeyboardShortcutsHelp isOpen onClose={() => {}} />);

describe('KeyboardShortcutsHelp', () => {
  it('test_KeyboardShortcutsHelp_closed_rendersNothing', () => {
    const { container } = render(<KeyboardShortcutsHelp isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('test_KeyboardShortcutsHelp_open_isLabelledDialog', () => {
    renderOpen();
    expect(screen.getByRole('dialog', { name: 'キーボードショートカット' })).toBeInTheDocument();
  });

  // The listed shortcuts drifted from the implementation once already: the
  // dialog advertised D/V/E tool modes, Ctrl+A and arrow keys that no handler
  // ever implemented. These assertions pin the list to the real handlers in
  // useEditShortcuts / useEditorSession / useRotateShortcut / useEditorInteraction.
  it.each([
    'P',
    'Enter',
    'Escape',
    'R',
    'Shift + R',
    'Delete / Backspace',
    'Ctrl/Cmd + C',
    'Ctrl/Cmd + V',
    'Ctrl/Cmd + D',
    'Ctrl/Cmd + Z',
    'Ctrl/Cmd + Shift + Z',
    'Ctrl/Cmd + ]',
    'Ctrl/Cmd + [',
    'Ctrl/Cmd + Shift + ]',
    'Ctrl/Cmd + Shift + [',
    'Ctrl/Cmd + G',
    'Ctrl/Cmd + Shift + G',
  ])('test_KeyboardShortcutsHelp_open_lists_%s', key => {
    renderOpen();
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it.each(['D', 'V', 'E', 'Ctrl/Cmd + A', 'Arrow Keys'])(
    'test_KeyboardShortcutsHelp_open_omitsUnimplemented_%s',
    key => {
      renderOpen();
      expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
  );

  it('test_KeyboardShortcutsHelp_escapeKey_callsOnClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<KeyboardShortcutsHelp isOpen onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
