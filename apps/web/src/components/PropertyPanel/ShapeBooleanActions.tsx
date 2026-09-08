import { SquaresSubtract, SquaresUnite } from 'lucide-react';
import { combineSelection, subtractSelection } from '@/features/editor';
import { IconButton, Tooltip, TooltipProvider } from '../ui';

/**
 * Combine / subtract controls for a multi-selection (issue #62, spec §7,
 * ADR-0006). Rendered only when two or more shapes are selected — the only
 * selection these operations apply to (ui-principles §7: show just the
 * operations valid for the current selection). Each click dispatches one
 * editor-core Command, so each is a single Undo step; a combine that cannot
 * yield one connected shape is refused with a toast instead of a dialog
 * (ui-principles §5).
 */
export const ShapeBooleanActions = () => (
  <div className="border-b border-ui-border p-4">
    <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ui-muted">形状</h3>
    <TooltipProvider>
      <div className="flex gap-1" role="group" aria-label="結合とくり抜き">
        <Tooltip content="結合（選択した図形を 1 つにする）">
          <IconButton
            icon={<SquaresUnite aria-hidden="true" className="size-4" />}
            label="結合"
            size="sm"
            onClick={combineSelection}
          />
        </Tooltip>
        <Tooltip content="くり抜き（最前面の図形を型にして他の図形から引く）">
          <IconButton
            icon={<SquaresSubtract aria-hidden="true" className="size-4" />}
            label="くり抜き"
            size="sm"
            onClick={subtractSelection}
          />
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
);
