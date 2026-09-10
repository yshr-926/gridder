import { resolveDrawingBounds, type ResolvedDrawingBounds } from '@gridder/editor-core';
import { useEditorDocument } from './useEditorSession';

/**
 * Live drawing-range rectangle for the current document (issue #46, spec §4).
 *
 * Always read the range through {@link resolveDrawingBounds} rather than
 * `document.drawingBounds` directly: in `auto` mode the document's stored
 * min/max is stale (see that function's doc comment), and this hook is what
 * keeps every consumer — the canvas layer, the header's "fit to content"
 * button, and any future inspector / export code (#56) — looking at the same
 * derived value. `null` means nothing should be drawn (auto mode with zero
 * shapes).
 */
export const useDrawingBounds = (): ResolvedDrawingBounds | null => {
  const document = useEditorDocument();
  return resolveDrawingBounds(document);
};
