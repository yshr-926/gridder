import { useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Share2 } from 'lucide-react';
import {
  DEFAULT_SHARE_IMAGE_OPTIONS,
  downloadDataUrl,
  drawingBoundsToCropRect,
  generateShareImageFilename,
  type ShareImageFormat,
} from '@/features/export-image';
import { useDrawingBounds, useEditorDocument } from '@/features/editor';
import { useGridSettingsStore, useSettingsStore } from '@/stores';
import { useToast } from '@/hooks';
import { Tooltip } from '../ui';
import { cn } from '@/utils/cn';
import { ExportStage, type ExportStageHandle } from './ExportStage';

const FORMAT_OPTIONS: readonly ShareImageFormat[] = ['png', 'jpeg'];

const triggerClassName = cn(
  'inline-flex h-control items-center justify-center gap-1.5 rounded-control px-2.5',
  'text-sm font-medium text-white transition-colors duration-fast',
  'bg-accent hover:bg-accent-strong focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
);

const popupClassName = cn(
  'z-40 w-80 origin-[var(--transform-origin)] rounded-panel border border-ui-border bg-surface p-4',
  'transition-[transform,opacity] duration-fast ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:ease-in',
);

const rowLabelClassName = 'text-sm text-ui';

const FORMAT_LABEL: Readonly<Record<ShareImageFormat, string>> = {
  png: 'PNG',
  jpeg: 'JPEG',
};

const MIME_TYPE: Readonly<Record<ShareImageFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/**
 * Share-image export panel (issue #56, spec §10): format (PNG/JPEG), whether
 * to include the grid and dimension annotations, and JPEG quality. Opens from
 * the top bar's "共有" trigger — `Header`'s wiring is added last, once its
 * own concurrent edits (#48, #54) settle.
 *
 * The two include-flags are shared with `SettingsPanel` (`useSettingsStore`)
 * rather than duplicated, so toggling one from either surface stays in sync;
 * format and JPEG quality are per-export choices, kept local to this panel.
 *
 * Rendering happens on a dedicated off-screen `ExportStage` (never the live
 * canvas), so the selection frame, resize handles, cursor, and every other
 * editor-only overlay never appear in the output — only `GridBackground` /
 * `ShapesLayer` / `DimensionLayer`, reused unmodified.
 */
export const SharePanel = () => {
  const document = useEditorDocument();
  const drawingBounds = useDrawingBounds();
  const gridSize = useGridSettingsStore((state) => state.basePixelSize);

  const includeGrid = useSettingsStore((state) => state.includeGridInShareImage);
  const setIncludeGrid = useSettingsStore((state) => state.setIncludeGridInShareImage);
  const includeDimensions = useSettingsStore((state) => state.includeDimensionsInShareImage);
  const setIncludeDimensions = useSettingsStore(
    (state) => state.setIncludeDimensionsInShareImage,
  );

  const [format, setFormat] = useState<ShareImageFormat>(DEFAULT_SHARE_IMAGE_OPTIONS.format);
  const [quality, setQuality] = useState(DEFAULT_SHARE_IMAGE_OPTIONS.quality);
  const [isExporting, setIsExporting] = useState(false);

  const exportStageRef = useRef<ExportStageHandle>(null);
  const toast = useToast();

  const hasContent = drawingBounds !== null;
  const cropRect =
    drawingBounds !== null ? drawingBoundsToCropRect(drawingBounds, gridSize) : null;

  const handleFormatChange = (values: readonly ShareImageFormat[]) => {
    const next = values[0];
    if (next !== undefined) {
      setFormat(next);
    }
  };

  const handleExport = () => {
    if (cropRect === null) {
      return;
    }
    setIsExporting(true);
    try {
      const dataUrl = exportStageRef.current?.toDataUrl({
        mimeType: MIME_TYPE[format],
        quality: format === 'jpeg' ? quality : undefined,
        pixelRatio: DEFAULT_SHARE_IMAGE_OPTIONS.pixelRatio,
      });
      if (dataUrl === null || dataUrl === undefined) {
        toast.error('画像の書き出しに失敗しました');
        return;
      }
      downloadDataUrl(dataUrl, generateShareImageFilename(format));
      toast.success('共有画像を書き出しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Popover.Root>
      <Tooltip content="共有" position="bottom">
        <Popover.Trigger className={triggerClassName} aria-label="共有">
          <Share2 aria-hidden="true" className="size-4" />
          <span>共有</span>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-40">
          <Popover.Popup className={popupClassName} aria-label="共有画像を書き出す">
            <Popover.Title className="text-sm font-semibold text-ui">共有画像</Popover.Title>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-ui-muted">
                  形式
                </span>
                <ToggleGroup
                  value={[format]}
                  onValueChange={(values) => handleFormatChange(values as ShareImageFormat[])}
                  aria-label="書き出し形式"
                  className="mt-2 flex gap-0.5 rounded-control border border-ui-border p-0.5"
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <Toggle
                      key={option}
                      value={option}
                      className={cn(
                        'h-control flex-1 rounded-control px-2 text-sm text-ui-muted transition-colors',
                        'data-[pressed]:bg-accent data-[pressed]:text-white',
                      )}
                    >
                      {FORMAT_LABEL[option]}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </div>

              <label className="flex items-center justify-between gap-4">
                <span className={rowLabelClassName}>グリッドを含める</span>
                <input
                  type="checkbox"
                  checked={includeGrid}
                  onChange={(event) => setIncludeGrid(event.target.checked)}
                  className="size-4 accent-accent"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className={rowLabelClassName}>寸法を含める</span>
                <input
                  type="checkbox"
                  checked={includeDimensions}
                  onChange={(event) => setIncludeDimensions(event.target.checked)}
                  className="size-4 accent-accent"
                />
              </label>

              {format === 'jpeg' && (
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <span className={rowLabelClassName}>JPEG 品質</span>
                    <span className="min-w-[3rem] text-right text-sm tabular-nums text-ui">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={quality}
                    onChange={(event) => setQuality(Number.parseFloat(event.target.value))}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-ui-border accent-accent"
                    aria-label="JPEG 品質"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={!hasContent || isExporting}
                className={cn(
                  'h-control w-full rounded-control bg-accent text-sm font-medium text-white transition-colors',
                  'hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                書き出す
              </button>
              {!hasContent && (
                <p className="text-xs text-ui-muted">図形がないため書き出せません。</p>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>

      {cropRect !== null && (
        <ExportStage
          ref={exportStageRef}
          document={document}
          gridSize={gridSize}
          cropRect={cropRect}
          includeGrid={includeGrid}
          includeDimensions={includeDimensions}
        />
      )}
    </Popover.Root>
  );
};
