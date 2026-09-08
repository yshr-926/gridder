/**
 * PROTOTYPE (issue #63) — floating bottom bar that cycles the variants.
 * Deliberately high-contrast so it is obviously not part of the design under review.
 */
import { useEffect } from 'react';

interface PrototypeSwitcherProps {
  readonly keys: readonly string[];
  readonly labels: readonly string[];
  readonly current: number;
  readonly onChange: (index: number) => void;
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

export const PrototypeSwitcher = ({ keys, labels, current, onChange }: PrototypeSwitcherProps) => {
  const count = keys.length;
  const prev = () => onChange((current - 1 + count) % count);
  const next = () => onChange((current + 1) % count);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onChange((current - 1 + count) % count);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onChange((current + 1) % count);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, count, onChange]);

  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-gray-900 px-2 py-1.5 text-sm text-white shadow-lg">
        <button
          type="button"
          onClick={prev}
          className="h-7 w-7 rounded-full hover:bg-gray-700"
          aria-label="前の案"
        >
          ←
        </button>
        <span className="min-w-56 text-center font-medium">
          {keys[current]} <span className="font-normal text-gray-300">{labels[current]}</span>
        </span>
        <button
          type="button"
          onClick={next}
          className="h-7 w-7 rounded-full hover:bg-gray-700"
          aria-label="次の案"
        >
          →
        </button>
      </div>
    </div>
  );
};
