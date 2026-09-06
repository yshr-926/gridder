import type { ShareImageFormat } from './types';

/**
 * Timestamped filename for a share-image export, e.g. `gridder_20260905_143025.png`.
 * UTC, so it's stable across the exporter's timezone.
 */
export const generateShareImageFilename = (format: ShareImageFormat): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  return `gridder_${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
};

/**
 * Trigger a browser download of a data URL.
 *
 * TODO(#54 follow-up): route this through the `features/file` `FileAdapter`
 * once it grows a binary/data-URL save path — that interface is currently
 * shaped for JSON `content: string` only (`save` / `saveAs` write text), so a
 * share image can't go through it without changing that file, which is out
 * of this issue's scope. This is a minimal, self-contained substitute.
 */
export const downloadDataUrl = (dataUrl: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
};
