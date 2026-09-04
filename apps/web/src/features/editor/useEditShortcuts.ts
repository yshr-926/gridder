import { useEffect } from 'react';
import {
  bringForward,
  bringToFront,
  copySelection,
  deleteSelection,
  duplicateSelection,
  pasteClipboard,
  sendBackward,
  sendToBack,
} from './editCommands';

/**
 * Keyboard shortcuts for multi-shape editing (issue #51, spec §7):
 *
 * - `Cmd/Ctrl+C` copy, `Cmd/Ctrl+V` paste, `Cmd/Ctrl+D` duplicate
 * - `Delete` / `Backspace` delete selection
 * - `Cmd/Ctrl+]` / `Cmd/Ctrl+[` bring forward / send backward
 * - `Cmd/Ctrl+Shift+]` / `Cmd/Ctrl+Shift+[` bring to front / send to back
 *
 * Disabled while an editable element (input, textarea, select, contentEditable
 * — e.g. the inspector's name field) has focus, so typing "c", "v", "d" or
 * pressing Delete in a text field never hijacks the input.
 */
export const useEditShortcuts = (): void => {
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      switch (event.key) {
        case 'c':
        case 'C':
          event.preventDefault();
          copySelection();
          break;
        case 'v':
        case 'V':
          event.preventDefault();
          pasteClipboard();
          break;
        case 'd':
        case 'D':
          event.preventDefault();
          duplicateSelection();
          break;
        case ']':
          event.preventDefault();
          if (event.shiftKey) {
            bringToFront();
          } else {
            bringForward();
          }
          break;
        case '[':
          event.preventDefault();
          if (event.shiftKey) {
            sendToBack();
          } else {
            sendBackward();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
