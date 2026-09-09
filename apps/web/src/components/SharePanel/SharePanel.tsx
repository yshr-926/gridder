import { useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Share2 } from 'lucide-react';
import {
  DEFAULT_SHARE_IMAGE_OPTIONS,
  MAX_SHARE_IMAGE_AREA_PX,
  SHARE_IMAGE_MARGINS,
  SHARE_IMAGE_SCALES,
  downloadBlob,
  drawingBoundsToCropRect,
  formatShareImageSize,
  generateShareImageFilename,
  isShareImageSizeExportable,
  resolveShareImageBackground,
  shareImageOutputSize,
  shareImagePreviewScale,
  SHARE_IMAGE_MARGIN_CELLS,
  type ShareImageBackground,
  type ShareImageFormat,
  type ShareImageMargin,
  type ShareImageOptions,
} from '@/features/export-image';
import { useDrawingBounds, useEditorDocument } from '@/features/editor';
import { useGridSettingsStore, useSettingsStore } from '@/stores';
import { useToast } from '@/hooks';
import { Tooltip } from '../ui';
import { cn } from '@/utils/cn';
import { ExportStage, type ExportStageHandle } from './ExportStage';

const FORMAT_OPTIONS: readonly ShareImageFormat[] = ['png', 'jpeg'];
const BACKGROUND_OPTIONS: readonly ShareImageBackground[] = ['white', 'transparent'];

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
const sectionLabelClassName = 'text-xs font-medium uppercase tracking-wide text-ui-muted';
const toggleGroupClassName = 'mt-2 flex gap-0.5 rounded-control border border-ui-border p-0.5';
const toggleClassName = cn(
  'h-control flex-1 rounded-control px-2 text-sm text-ui-muted transition-colors',
  'data-[pressed]:bg-accent data-[pressed]:text-white',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

const FORMAT_LABEL: Readonly<Record<ShareImageFormat, string>> = {
  png: 'PNG',
  jpeg: 'JPEG',
};

const BACKGROUND_LABEL: Readonly<Record<ShareImageBackground, string>> = {
  white: '白',
  transparent: '透明',
};

const MARGIN_LABEL: Readonly<Record<ShareImageMargin, string>> = {
  none: 'なし',
  small: '小',
  medium: '中',
};

const MIME_TYPE: Readonly<Record<ShareImageFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/**
 * Preview box inside the popup: the popup's 20rem width minus its 1rem
 * padding on each side, and a fixed height so switching options never moves
 * the controls below it (ui-principles §3).
 */
const PREVIEW_BOX = { width: 288, height: 200 } as const;

/** Side length of the square the area limit corresponds to, for the message. */
const MAX_SQUARE_SIDE_PX = Math.floor(Math.sqrt(MAX_SHARE_IMAGE_AREA_PX));

/** Checkerboard shown behind a transparent preview, the usual alpha cue. */
const checkerboardStyle = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), ' +
    'linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #e5e7eb 75%), ' +
    'linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
} as const;

/** The per-export choices this panel owns; the two include-flags live in `useSettingsStore`. */
type ShareImageChoices = Omit<ShareImageOptions, 'includeGrid' | 'includeDimensions'>;

const DEFAULT_CHOICES: ShareImageChoices = {
  format: DEFAULT_SHARE_IMAGE_OPTIONS.format,
  quality: DEFAULT_SHARE_IMAGE_OPTIONS.quality,
  scale: DEFAULT_SHARE_IMAGE_OPTIONS.scale,
  margin: DEFAULT_SHARE_IMAGE_OPTIONS.margin,
  background: DEFAULT_SHARE_IMAGE_OPTIONS.background,
};

interface SharePanelContentProps {
  readonly choices: ShareImageChoices;
  readonly onChoicesChange: (choices: ShareImageChoices) => void;
}

/**
 * The popup body. Split from {@link SharePanel} so the document subscription
 * (`useEditorDocument`) and the preview `ExportStage` exist only while the
 * popover is open — with the popover closed, a document commit re-renders
 * nothing here (ADR-0005: no canvas work outside what the user is looking at).
 */
const SharePanelContent = ({ choices, onChoicesChange }: SharePanelContentProps) => {
  const document = useEditorDocument();
  const drawingBounds = useDrawingBounds();
  const gridSize = useGridSettingsStore((state) => state.basePixelSize);

  const includeGrid = useSettingsStore((state) => state.includeGridInShareImage);
  const setIncludeGrid = useSettingsStore((state) => state.setIncludeGridInShareImage);
  const includeDimensions = useSettingsStore((state) => state.includeDimensionsInShareImage);
  const setIncludeDimensions = useSettingsStore(
    (state) => state.setIncludeDimensionsInShareImage,
  );

  const [isExporting, setIsExporting] = useState(false);
  const exportStageRef = useRef<ExportStageHandle>(null);
  const toast = useToast();

  const { format, quality, scale, margin, background } = choices;
  const effectiveBackground = resolveShareImageBackground(format, background);

  const hasContent = drawingBounds !== null;
  const cropRect =
    drawingBounds !== null
      ? drawingBoundsToCropRect(drawingBounds, gridSize, SHARE_IMAGE_MARGIN_CELLS[margin])
      : null;
  const outputSize = cropRect !== null ? shareImageOutputSize(cropRect, scale) : null;
  const isExportable = outputSize !== null && isShareImageSizeExportable(outputSize);
  const previewScale = cropRect !== null ? shareImagePreviewScale(cropRect, PREVIEW_BOX) : 1;

  const update = (patch: Partial<ShareImageChoices>) => onChoicesChange({ ...choices, ...patch });

  const handleFormatChange = (values: readonly ShareImageFormat[]) => {
    const next = values[0];
    if (next !== undefined) {
      update({ format: next });
    }
  };

  const handleBackgroundChange = (values: readonly ShareImageBackground[]) => {
    const next = values[0];
    if (next !== undefined) {
      update({ background: next });
    }
  };

  // `Toggle` values are strings, so the numeric scale round-trips through
  // its label ("1", "2", "3") and is validated against the known scales.
  const handleScaleChange = (values: readonly string[]) => {
    const next = SHARE_IMAGE_SCALES.find((option) => String(option) === values[0]);
    if (next !== undefined) {
      update({ scale: next });
    }
  };

  const handleMarginChange = (values: readonly ShareImageMargin[]) => {
    const next = values[0];
    if (next !== undefined) {
      update({ margin: next });
    }
  };

  const handleExport = async () => {
    if (cropRect === null || !isExportable) {
      return;
    }
    setIsExporting(true);
    try {
      const blob = await exportStageRef.current?.toBlob({
        mimeType: MIME_TYPE[format],
        quality: format === 'jpeg' ? quality : undefined,
        scale,
      });
      if (blob === null || blob === undefined) {
        toast.error('画像の書き出しに失敗しました');
        return;
      }
      downloadBlob(blob, generateShareImageFilename(format));
      toast.success('共有画像を書き出しました');
    } catch {
      toast.error('画像の書き出しに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* プレビュー（#67 項目 2）。箱の高さを固定し、下の操作面を動かさない */}
      <div
        data-testid="share-image-preview"
        className="flex items-center justify-center overflow-hidden rounded-control border border-ui-border bg-surface-muted"
        style={{ height: PREVIEW_BOX.height + 2 }}
      >
        {cropRect !== null ? (
          <div
            className="border border-ui-border"
            style={effectiveBackground === 'transparent' ? checkerboardStyle : undefined}
          >
            <ExportStage
              ref={exportStageRef}
              document={document}
              gridSize={gridSize}
              cropRect={cropRect}
              includeGrid={includeGrid}
              includeDimensions={includeDimensions}
              background={effectiveBackground}
              scale={scale}
              previewScale={previewScale}
            />
          </div>
        ) : (
          <p className="text-xs text-ui-muted">図形がないため書き出せません。</p>
        )}
      </div>

      <div>
        <span className={sectionLabelClassName}>形式</span>
        <ToggleGroup
          value={[format]}
          onValueChange={(values) => handleFormatChange(values as ShareImageFormat[])}
          aria-label="書き出し形式"
          className={toggleGroupClassName}
        >
          {FORMAT_OPTIONS.map((option) => (
            <Toggle key={option} value={option} className={toggleClassName}>
              {FORMAT_LABEL[option]}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      {/* 背景（#67 項目 6）。JPEG は透明を持てないので白に固定し、選択肢を無効化する */}
      <div>
        <span className={sectionLabelClassName}>背景</span>
        <ToggleGroup
          value={[effectiveBackground]}
          onValueChange={(values) => handleBackgroundChange(values as ShareImageBackground[])}
          aria-label="背景"
          className={toggleGroupClassName}
        >
          {BACKGROUND_OPTIONS.map((option) => (
            <Toggle
              key={option}
              value={option}
              disabled={format === 'jpeg' && option === 'transparent'}
              className={toggleClassName}
            >
              {BACKGROUND_LABEL[option]}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      {/* 解像度（#67 項目 1）。上限を超える倍率は選べず、出力サイズを常に表示する */}
      <div>
        <span className={sectionLabelClassName}>解像度</span>
        <ToggleGroup
          value={[String(scale)]}
          onValueChange={(values) => handleScaleChange(values as string[])}
          aria-label="解像度"
          className={toggleGroupClassName}
        >
          {SHARE_IMAGE_SCALES.map((option) => (
            <Toggle
              key={option}
              value={String(option)}
              disabled={
                cropRect !== null &&
                !isShareImageSizeExportable(shareImageOutputSize(cropRect, option))
              }
              className={toggleClassName}
            >
              {option}x
            </Toggle>
          ))}
        </ToggleGroup>
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className={rowLabelClassName}>出力サイズ</span>
          <span
            data-testid="share-image-output-size"
            className="min-w-[8rem] text-right text-sm tabular-nums text-ui"
          >
            {outputSize !== null ? formatShareImageSize(outputSize) : '—'}
          </span>
        </div>
        {outputSize !== null && !isExportable && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            上限（{MAX_SQUARE_SIDE_PX} × {MAX_SQUARE_SIDE_PX} px 相当）を超えるため書き出せません。解像度か余白を下げてください。
          </p>
        )}
      </div>

      {/* 余白（#67 項目 3）。セル単位なので、グリッドを含めるとき余白にもグリッドが続く */}
      <div>
        <span className={sectionLabelClassName}>余白</span>
        <ToggleGroup
          value={[margin]}
          onValueChange={(values) => handleMarginChange(values as ShareImageMargin[])}
          aria-label="余白"
          className={toggleGroupClassName}
        >
          {SHARE_IMAGE_MARGINS.map((option) => (
            <Toggle key={option} value={option} className={toggleClassName}>
              {MARGIN_LABEL[option]}
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
            onChange={(event) => update({ quality: Number.parseFloat(event.target.value) })}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-ui-border accent-accent"
            aria-label="JPEG 品質"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={!hasContent || !isExportable || isExporting}
        className={cn(
          'h-control w-full rounded-control bg-accent text-sm font-medium text-white transition-colors',
          'hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isExporting ? '書き出し中…' : '書き出す'}
      </button>
    </div>
  );
};

/**
 * Share-image export panel (issue #56 / #67, spec §10): a live preview,
 * format (PNG/JPEG), background (white / transparent PNG), output scale
 * with the resulting pixel size, margin, whether to include the grid and
 * dimension annotations, and JPEG quality. Opens from the top bar's "共有"
 * trigger.
 *
 * The two include-flags are shared with `SettingsPanel` (`useSettingsStore`)
 * rather than duplicated, so toggling one from either surface stays in sync;
 * the per-export choices (format, quality, scale, margin, background) are
 * kept here so they survive closing and reopening the popover but are not
 * document data and are not persisted.
 *
 * Rendering happens on a dedicated preview `ExportStage` (never the live
 * canvas), so the selection frame, resize handles, cursor, and every other
 * editor-only overlay never appear in the output — only `GridBackground` /
 * `ShapesLayer` / `DimensionLayer`, reused unmodified.
 */
export const SharePanel = () => {
  const [choices, setChoices] = useState<ShareImageChoices>(DEFAULT_CHOICES);

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
            <SharePanelContent choices={choices} onChoicesChange={setChoices} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
