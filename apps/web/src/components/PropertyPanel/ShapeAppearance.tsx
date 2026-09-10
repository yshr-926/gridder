import { useEffect, useMemo, useRef, useState } from 'react';
import { SHAPE_FILL_PALETTE, type EditorShape, type ShapeFillColor } from '@gridder/editor-core';
import { setShapesBorderVisible, setShapesFill, setShapesOpacity } from '@/features/editor';
import { useOpacityPreviewStore } from '@/stores/opacityPreviewStore';
import { cn } from '@/utils/cn';

interface ShapeAppearanceProps {
  /** Every selected shape. Single- and multi-selection share these controls. */
  readonly shapes: readonly EditorShape[];
}

const OPACITY_STEP = 5;

/** The value shared by every shape, or `null` when they differ. */
const sharedValue = <T,>(
  shapes: readonly EditorShape[],
  pick: (shape: EditorShape) => T
): T | null => {
  if (shapes.length === 0) {
    return null;
  }
  const first = pick(shapes[0]);
  return shapes.every((shape) => pick(shape) === first) ? first : null;
};

/**
 * Fill colour, opacity and border-visibility controls (issue #45, spec §8).
 * These are the common appearance operations, so they render for a single shape
 * and for a multi-selection alike. When selected shapes disagree on a value the
 * control shows a mixed state (no swatch selected, opacity blank).
 *
 * Dragging the opacity slider is one gesture, so it commits one Command
 * (AGENTS.md "commit one Command when the gesture ends"): while the pointer is
 * down, every intermediate step only writes {@link useOpacityPreviewStore},
 * which `ShapesLayer` renders directly on the Konva nodes, and the value
 * reaches the document once on release. A 70→60→50 drag is therefore a single
 * Undo step.
 *
 * A change that arrives with no pointer gesture in progress — an arrow key, or
 * a programmatic set — is already a complete interaction and commits at once,
 * so the document never depends on a release event that may not come. The −/+
 * buttons are each their own discrete gesture and commit immediately too.
 */
export const ShapeAppearance = ({ shapes }: ShapeAppearanceProps) => {
  const currentFill = useMemo(() => sharedValue(shapes, (shape) => shape.style.fill), [shapes]);
  const currentOpacity = useMemo(
    () => sharedValue(shapes, (shape) => shape.style.opacity),
    [shapes]
  );
  const currentBorderVisible = useMemo(
    () => sharedValue(shapes, (shape) => shape.style.isBorderVisible),
    [shapes]
  );

  // Set while the slider is being dragged; `null` once the gesture has ended
  // and the document holds the value again.
  const [draggingPercent, setDraggingPercent] = useState<number | null>(null);
  // Whether the pointer is currently held down on the slider. Only then is a
  // change part of a longer gesture worth coalescing.
  const isPointerDownRef = useRef(false);
  const setPreview = useOpacityPreviewStore((state) => state.setPreview);
  const clearPreview = useOpacityPreviewStore((state) => state.clearPreview);

  const committedPercent = currentOpacity === null ? null : Math.round(currentOpacity * 100);
  const opacityPercent = draggingPercent ?? committedPercent;

  const stepOpacity = (deltaPercent: number) => {
    const basePercent = opacityPercent ?? 100;
    setShapesOpacity(shapes, (basePercent + deltaPercent) / 100);
  };

  const changeOpacity = (percent: number) => {
    if (!isPointerDownRef.current) {
      // Not a drag: commit straight away rather than waiting for a release.
      setDraggingPercent(null);
      clearPreview();
      setShapesOpacity(shapes, percent / 100);
      return;
    }
    setDraggingPercent(percent);
    setPreview(
      shapes.map((shape) => shape.id),
      percent / 100
    );
  };

  // A gesture cut short by the panel closing or the selection changing must
  // not leave a stale preview painted on the canvas; the uncommitted value is
  // simply abandoned, the same way an interrupted drag elsewhere is.
  useEffect(() => clearPreview, [clearPreview]);

  /** End of the slider gesture: drop the preview and commit one Command. */
  const commitOpacity = () => {
    isPointerDownRef.current = false;
    if (draggingPercent === null) {
      return;
    }
    setDraggingPercent(null);
    clearPreview();
    setShapesOpacity(shapes, draggingPercent / 100);
  };

  return (
    <div className="border-b border-ui-border p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ui-muted">外観</h3>

      {/* 塗り色 */}
      <div className="space-y-2">
        <span className="block text-xs font-medium uppercase tracking-wide text-ui-muted">
          塗り色
        </span>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="塗り色">
          {SHAPE_FILL_PALETTE.map((color: ShapeFillColor) => {
            const isActive = currentFill === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => setShapesFill(shapes, color)}
                className={cn(
                  'h-8 w-8 rounded-md border-2 transition-colors',
                  isActive
                    ? 'border-gray-800 ring-2 ring-gray-400'
                    : 'border-transparent hover:border-gray-300'
                )}
                style={{ backgroundColor: color }}
                aria-label={`塗り色を ${color} に変更`}
                aria-pressed={isActive}
              />
            );
          })}
        </div>
      </div>

      {/* 透明度 */}
      <div className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-ui-muted">透明度</span>
          <span className="min-w-[3.5rem] text-right text-sm tabular-nums text-ui">
            {opacityPercent === null ? '—' : `${opacityPercent}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepOpacity(-OPACITY_STEP)}
            disabled={opacityPercent !== null && opacityPercent <= 0}
            className="h-8 w-8 shrink-0 rounded-md border border-gray-300 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="透明度を下げる"
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={OPACITY_STEP}
            value={opacityPercent ?? 100}
            onChange={(event) => changeOpacity(Number(event.target.value))}
            onPointerDown={() => {
              isPointerDownRef.current = true;
            }}
            onPointerUp={commitOpacity}
            onPointerCancel={commitOpacity}
            onBlur={commitOpacity}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200"
            aria-label="透明度"
            aria-valuetext={opacityPercent === null ? '混在' : `${opacityPercent}%`}
          />
          <button
            type="button"
            onClick={() => stepOpacity(OPACITY_STEP)}
            disabled={opacityPercent !== null && opacityPercent >= 100}
            className="h-8 w-8 shrink-0 rounded-md border border-gray-300 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="透明度を上げる"
          >
            +
          </button>
        </div>
      </div>

      {/* 境界線 */}
      <div className="mt-4 flex items-center gap-2">
        <input
          id="shape-border-visible"
          type="checkbox"
          checked={currentBorderVisible === true}
          ref={(node) => {
            if (node) {
              node.indeterminate = currentBorderVisible === null;
            }
          }}
          onChange={(event) => setShapesBorderVisible(shapes, event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="shape-border-visible" className="text-sm text-gray-700">
          境界線を表示
        </label>
      </div>
    </div>
  );
};
