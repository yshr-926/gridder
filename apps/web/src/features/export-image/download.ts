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
 * Trigger a browser download of a Blob through a temporary object URL.
 *
 * A Blob rather than a data URL (issue #67): `canvas.toBlob` encodes off the
 * main thread and hands back the bytes directly, whereas `toDataURL`
 * encodes synchronously and then base64-expands a raster that, at the
 * sizes `MAX_SHARE_IMAGE_AREA_PX` allows, would be a string of tens of
 * megabytes held in memory for the lifetime of the anchor.
 *
 * TODO(#54 follow-up): route this through the `features/file` `FileAdapter`
 * once it grows a binary save path — that interface is currently shaped for
 * JSON `content: string` only (`save` / `saveAs` write text), so a share
 * image can't go through it without changing that file, which is out of
 * this issue's scope. This is a minimal, self-contained substitute.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    // The click has already handed the URL to the download machinery; the
    // revoke is deferred a tick so a browser that resolves the anchor
    // asynchronously still finds the object alive.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};
