import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Switch } from '@base-ui/react/switch';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Settings2 } from 'lucide-react';
import {
  MAX_ANNOTATION_FONT_SIZE,
  MIN_ANNOTATION_FONT_SIZE,
  type PhysicalUnit,
} from '@gridder/editor-core';
import {
  clearPhysicalScale,
  setAnnotationFontSize,
  setPhysicalScale,
  useEditorDocument,
} from '@/features/editor';
import { useSettingsStore } from '@/stores';
import { Tooltip } from '../ui';
import { cn } from '@/utils/cn';

const UNIT_OPTIONS: readonly PhysicalUnit[] = ['mm', 'cm', 'm'];

const triggerClassName = cn(
  'inline-flex h-control min-w-control items-center justify-center gap-1.5 rounded-control px-2',
  'text-sm font-medium text-ui-muted transition-colors duration-fast',
  'hover:bg-surface-muted hover:text-ui focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'
);

const popupClassName = cn(
  'z-40 w-80 origin-[var(--transform-origin)] rounded-panel border border-ui-border bg-surface p-4',
  'transition-[transform,opacity] duration-fast ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:ease-in'
);

const rowLabelClassName = 'text-sm text-ui';
const sectionLabelClassName = 'text-xs font-medium uppercase tracking-wide text-ui-muted';
const numberInputClassName = cn(
  'h-control w-20 shrink-0 rounded-control border border-ui-border bg-surface px-2 text-sm tabular-nums text-ui',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

/**
 * Clamp a typed annotation font size into the document's range, rounding to
 * whole pixels; `null` when the text is not a number at all (the input is
 * then reset to the committed value instead of guessing).
 */
const parseAnnotationFontSize = (raw: string): number | null => {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(MAX_ANNOTATION_FONT_SIZE, Math.max(MIN_ANNOTATION_FONT_SIZE, Math.round(parsed)));
};

/**
 * Global sketch settings panel (issue #53, spec §8 / §12): real-world scale
 * (enable / value / unit), the sketch-wide annotation font size (issue #66),
 * and the two share-image export flags. Opens from a `Settings2` trigger the
 * caller places in the top bar.
 *
 * The real-world scale and the annotation font size are document data, so
 * every change goes through {@link setPhysicalScale} / {@link clearPhysicalScale}
 * / {@link setAnnotationFontSize} — each exactly one Command, so it is a
 * single Undo step. The two export flags are not document data (spec: they
 * only affect share-image rendering, #56), so they live in `useSettingsStore`
 * with no history.
 *
 * The value column has a fixed width (`tabular-nums` + `min-w`) so typing a
 * longer number or switching units never shifts the row layout, and the
 * popover itself has a fixed width so nothing in the top bar moves either.
 */
export const SettingsPanel = () => {
  const document = useEditorDocument();
  const physicalScale = document.physicalScale;
  const isScaleEnabled = physicalScale !== undefined;
  const committedValue = physicalScale?.valuePerCell ?? 1;
  const unit = physicalScale?.unit ?? 'cm';

  // Local draft so the input can hold an interim value (e.g. briefly empty
  // while retyping) without dispatching a Command on every keystroke. Synced
  // to the committed value during render (not an effect) so Undo/Redo or a
  // change from elsewhere never leaves a stale draft — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [valueDraft, setValueDraft] = useState(String(committedValue));
  const [syncedValue, setSyncedValue] = useState(committedValue);
  if (syncedValue !== committedValue) {
    setSyncedValue(committedValue);
    setValueDraft(String(committedValue));
  }

  // Same draft-and-sync pattern for the annotation font size: the number
  // input holds interim text and commits (clamped to the document's range)
  // on blur / Enter; Undo/Redo re-syncs the draft from the document.
  const committedFontSize = document.annotationFontSize;
  const [fontSizeDraft, setFontSizeDraft] = useState(String(committedFontSize));
  const [syncedFontSize, setSyncedFontSize] = useState(committedFontSize);
  if (syncedFontSize !== committedFontSize) {
    setSyncedFontSize(committedFontSize);
    setFontSizeDraft(String(committedFontSize));
  }

  const includeDimensions = useSettingsStore((state) => state.includeDimensionsInShareImage);
  const setIncludeDimensions = useSettingsStore((state) => state.setIncludeDimensionsInShareImage);
  const includeGrid = useSettingsStore((state) => state.includeGridInShareImage);
  const setIncludeGrid = useSettingsStore((state) => state.setIncludeGridInShareImage);

  const commitValue = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      setPhysicalScale(parsed, unit);
    }
  };

  const handleEnabledChange = (checked: boolean) => {
    if (checked) {
      const parsed = Number.parseFloat(valueDraft);
      setPhysicalScale(Number.isFinite(parsed) && parsed > 0 ? parsed : 1, unit);
    } else {
      clearPhysicalScale();
    }
  };

  const commitFontSize = (raw: string) => {
    const next = parseAnnotationFontSize(raw);
    if (next === null) {
      setFontSizeDraft(String(committedFontSize));
      return;
    }
    // Reflect the clamped value even when it equals the committed one (the
    // document does not change, so the render-time sync would not fire).
    setFontSizeDraft(String(next));
    setAnnotationFontSize(next);
  };

  const handleUnitChange = (values: readonly PhysicalUnit[]) => {
    const nextUnit = values[0];
    if (nextUnit !== undefined && isScaleEnabled) {
      const parsed = Number.parseFloat(valueDraft);
      setPhysicalScale(Number.isFinite(parsed) && parsed > 0 ? parsed : 1, nextUnit);
    }
  };

  return (
    <Popover.Root>
      <Tooltip content="設定" position="bottom">
        <Popover.Trigger className={triggerClassName} aria-label="設定">
          <Settings2 aria-hidden="true" className="size-4" />
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-40">
          <Popover.Popup className={popupClassName} aria-label="スケッチ設定">
            <Popover.Title className="text-sm font-semibold text-ui">スケッチ設定</Popover.Title>

            {/* 実寸スケール */}
            <div className="mt-4 border-t border-ui-border pt-4">
              <div className="flex items-center justify-between gap-4">
                <span className={rowLabelClassName}>実寸スケール</span>
                <Switch.Root
                  checked={isScaleEnabled}
                  onCheckedChange={handleEnabledChange}
                  aria-label="実寸スケールを有効にする"
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full bg-ui-border transition-colors',
                    'data-[checked]:bg-accent'
                  )}
                >
                  <Switch.Thumb
                    className={cn(
                      'block size-4 translate-x-0.5 rounded-full bg-white transition-transform',
                      'data-[checked]:translate-x-[1.125rem]'
                    )}
                  />
                </Switch.Root>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <label
                  htmlFor="settings-panel-scale-value"
                  className="shrink-0 text-sm text-ui-muted"
                >
                  1セル =
                </label>
                <input
                  id="settings-panel-scale-value"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={valueDraft}
                  disabled={!isScaleEnabled}
                  onChange={(event) => setValueDraft(event.target.value)}
                  onBlur={(event) => commitValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  className={numberInputClassName}
                />
                <ToggleGroup
                  value={[unit]}
                  onValueChange={(values) => handleUnitChange(values as PhysicalUnit[])}
                  disabled={!isScaleEnabled}
                  aria-label="単位"
                  className="flex shrink-0 gap-0.5 rounded-control border border-ui-border p-0.5"
                >
                  {UNIT_OPTIONS.map((option) => (
                    <Toggle
                      key={option}
                      value={option}
                      className={cn(
                        'h-control min-w-9 rounded-control px-2 text-sm text-ui-muted transition-colors',
                        'data-[pressed]:bg-accent data-[pressed]:text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                    >
                      {option}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            {/* 注釈（図形名と寸法）の文字サイズ。スケッチ全体で一つの値（#66、spec §8） */}
            <div className="mt-4 border-t border-ui-border pt-4">
              <span className={sectionLabelClassName}>注釈</span>
              <div className="mt-3 flex items-center justify-between gap-4">
                <label htmlFor="settings-panel-annotation-font-size" className={rowLabelClassName}>
                  文字サイズ
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="settings-panel-annotation-font-size"
                    type="number"
                    min={MIN_ANNOTATION_FONT_SIZE}
                    max={MAX_ANNOTATION_FONT_SIZE}
                    step={1}
                    inputMode="numeric"
                    value={fontSizeDraft}
                    onChange={(event) => setFontSizeDraft(event.target.value)}
                    onBlur={(event) => commitFontSize(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                    }}
                    className={numberInputClassName}
                  />
                  {/* 単位は入力に隣接表示し、幅を固定してレイアウトを動かさない（ui-principles §3, §4） */}
                  <span className="w-5 shrink-0 text-sm text-ui-muted">px</span>
                </div>
              </div>
            </div>

            {/* 共有画像 */}
            <div className="mt-4 border-t border-ui-border pt-4">
              <span className={sectionLabelClassName}>共有画像</span>

              <label className="mt-3 flex items-center justify-between gap-4">
                <span className={rowLabelClassName}>寸法を含める</span>
                <input
                  type="checkbox"
                  checked={includeDimensions}
                  onChange={(event) => setIncludeDimensions(event.target.checked)}
                  className="size-4 accent-accent"
                />
              </label>
              <label className="mt-3 flex items-center justify-between gap-4">
                <span className={rowLabelClassName}>グリッドを含める</span>
                <input
                  type="checkbox"
                  checked={includeGrid}
                  onChange={(event) => setIncludeGrid(event.target.checked)}
                  className="size-4 accent-accent"
                />
              </label>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
