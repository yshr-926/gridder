import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE_IMAGE_OPTIONS, resolveShareImageBackground } from './types';

describe('resolveShareImageBackground', () => {
  it('test_resolveShareImageBackground_pngTransparent_staysTransparent', () => {
    expect(resolveShareImageBackground('png', 'transparent')).toBe('transparent');
  });

  it('test_resolveShareImageBackground_jpegTransparent_paintsWhite', () => {
    expect(resolveShareImageBackground('jpeg', 'transparent')).toBe('white');
  });

  it('test_resolveShareImageBackground_white_unchangedForBothFormats', () => {
    expect(resolveShareImageBackground('png', 'white')).toBe('white');
    expect(resolveShareImageBackground('jpeg', 'white')).toBe('white');
  });
});

describe('DEFAULT_SHARE_IMAGE_OPTIONS', () => {
  it('test_defaults_keepPreIssue67Behaviour_whiteNoMargin2x', () => {
    expect(DEFAULT_SHARE_IMAGE_OPTIONS.format).toBe('png');
    expect(DEFAULT_SHARE_IMAGE_OPTIONS.background).toBe('white');
    expect(DEFAULT_SHARE_IMAGE_OPTIONS.margin).toBe('none');
    expect(DEFAULT_SHARE_IMAGE_OPTIONS.scale).toBe(2);
  });
});
