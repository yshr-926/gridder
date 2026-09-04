import { useEffect } from 'react';
import { rotateSelection } from './rotate';

/**
 * Keyboard shortcut for rotating the selection 90° (issue #47, spec §6.2 /
 * §7): `R` rotates clockwise, `Shift+R` rotates counter-clockwise.
 *
 * Disabled while an editable element (input, textarea, select,
 * contentEditable — e.g. the inspector's name field) has focus, so typing "r"
 * in a text field never hijacks the input.
 */
export const useRotateShortcut = (): void => {
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
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        rotateSelection(event.shiftKey ? 'ccw' : 'cw');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
