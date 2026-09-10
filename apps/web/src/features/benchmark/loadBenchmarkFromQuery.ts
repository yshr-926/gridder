import type { EditorSession } from '../editor/editorSession';
import { generateBenchmarkDocument } from './generateBenchmarkDocument';

/**
 * Query-parameter loader for issue #57's benchmark fixture: opening the app
 * at `?benchmark=500` resets the session to a deterministic ~500 shape /
 * ~50,000 cell document (spec §14) without any UI, so a developer can jump
 * straight to measuring frame time and input latency in Chrome DevTools.
 * Restricted to `import.meta.env.DEV` and the Playwright build
 * (`VITE_E2E=true`) — the same guard as the `__GRIDDER_EDITOR_SESSION__`
 * exposure in `useEditorSession.ts` — so this never ships in a production
 * build and never touches `App.tsx`. The E2E build is included (issue #61)
 * so the benchmark spec can measure a production-optimised bundle, where the
 * React development build's per-element overhead does not distort the
 * numbers.
 *
 * `?benchmark` (no value, or anything non-numeric) falls back to the
 * generator's own default of 500 shapes / 50,000 cells.
 */
export const loadBenchmarkFromQuery = (
  session: EditorSession,
  location: Pick<Location, 'search'> = window.location
): void => {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== 'true') {
    return;
  }

  const params = new URLSearchParams(location.search);
  if (!params.has('benchmark')) {
    return;
  }

  const rawShapeCount = params.get('benchmark');
  const parsedShapeCount =
    rawShapeCount === null || rawShapeCount === '' ? NaN : Number(rawShapeCount);
  const shapeCount =
    Number.isFinite(parsedShapeCount) && parsedShapeCount > 0
      ? Math.round(parsedShapeCount)
      : undefined;

  // Keep the ~100 cells/shape ratio from spec §14's 500 shapes / 50,000
  // cells baseline when a custom shape count is requested.
  const targetCellCount = shapeCount === undefined ? undefined : shapeCount * 100;

  const { document } = generateBenchmarkDocument({ shapeCount, targetCellCount });
  session.reset(document);
};
