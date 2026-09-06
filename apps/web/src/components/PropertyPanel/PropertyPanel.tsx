import { RotateCcw, RotateCw } from 'lucide-react';
import { IconButton, Tooltip, TooltipProvider } from '../ui';
import { rotateSelection, useSelectedShapes } from '@/features/editor';
import { ShapeAppearance } from './ShapeAppearance';
import { ShapeDimensions } from './ShapeDimensions';
import { ShapeNameField } from './ShapeNameField';
import { ShapeStructureActions } from './ShapeStructureActions';

/**
 * Right-hand contextual inspector (issue #45, spec §12 / ui-principles §7).
 *
 * Reads the polygon document through {@link useSelectedShapes} — the retired
 * `canvasStore` is no longer involved. It renders only when something is
 * selected; a single selection gets name, dimensions and appearance, a
 * multi-selection or a group (issue #52, spec §7 / ui-principles §7) gets the
 * common appearance controls only. Every edit goes through an editor-core
 * Command so each change is a single Undo step.
 *
 * The panel is an overlay-free fixed-width column so digit / label changes never
 * move the canvas. Its entrance transition is `animate-inspector-in`
 * (150ms ease-out); `prefers-reduced-motion` disables it via the global rule in
 * `index.css`.
 */
export const PropertyPanel = () => {
  const { shapes, primaryShape, physicalScale, isGroupSelection } = useSelectedShapes();

  if (shapes.length === 0) {
    return null;
  }

  const isSingle = shapes.length === 1;
  const singleShape = isSingle ? (primaryShape ?? shapes[0]) : null;
  const heading = isSingle
    ? '選択中の図形'
    : isGroupSelection
      ? 'グループを選択中'
      : `${shapes.length} 図形を選択中`;

  return (
    <aside
      className="flex w-inspector shrink-0 animate-inspector-in flex-col overflow-y-auto border-l border-ui-border bg-surface"
      role="complementary"
      aria-label="図形インスペクター"
    >
      <div className="flex items-center justify-between border-b border-ui-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ui">{heading}</h2>
        {/* Rotation (issue #47, spec §6.2 / §7): pivots on the whole
            selection's bounding box, so single and multi-selections both get
            the same two buttons. */}
        <TooltipProvider>
          <div className="flex gap-1" role="group" aria-label="回転">
            <Tooltip content="反時計回りに90度回転 (Shift+R)">
              <IconButton
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                label="反時計回りに90度回転"
                size="sm"
                onClick={() => rotateSelection('ccw')}
              />
            </Tooltip>
            <Tooltip content="時計回りに90度回転 (R)">
              <IconButton
                icon={<RotateCw aria-hidden="true" className="size-4" />}
                label="時計回りに90度回転"
                size="sm"
                onClick={() => rotateSelection('cw')}
              />
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <div className="flex-1">
        {singleShape !== null && (
          <>
            <ShapeNameField shape={singleShape} />
            <ShapeDimensions shape={singleShape} physicalScale={physicalScale} />
          </>
        )}
        <ShapeAppearance shapes={shapes} />
        <ShapeStructureActions />
      </div>
    </aside>
  );
};
