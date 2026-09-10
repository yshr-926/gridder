import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, generateShareImageFilename } from './download';

describe('generateShareImageFilename', () => {
  it('test_generateShareImageFilename_png_usesPngExtension', () => {
    expect(generateShareImageFilename('png')).toMatch(/^gridder_\d{8}_\d{6}\.png$/);
  });

  it('test_generateShareImageFilename_jpeg_usesJpgExtension', () => {
    expect(generateShareImageFilename('jpeg')).toMatch(/^gridder_\d{8}_\d{6}\.jpg$/);
  });
});

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('test_downloadBlob_clicksAnchorWithObjectUrl_thenRevokesIt', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let clicked: { href: string; download: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked = { href: this.href, download: this.download };
    });

    downloadBlob(new Blob(['x'], { type: 'image/png' }), 'gridder.png');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual({ href: 'blob:mock-url', download: 'gridder.png' });
    expect(revokeSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});
