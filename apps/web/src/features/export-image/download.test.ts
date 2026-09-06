import { describe, expect, it } from 'vitest';
import { generateShareImageFilename } from './download';

describe('generateShareImageFilename', () => {
  it('test_generateShareImageFilename_png_usesPngExtension', () => {
    expect(generateShareImageFilename('png')).toMatch(/^gridder_\d{8}_\d{6}\.png$/);
  });

  it('test_generateShareImageFilename_jpeg_usesJpgExtension', () => {
    expect(generateShareImageFilename('jpeg')).toMatch(/^gridder_\d{8}_\d{6}\.jpg$/);
  });
});
