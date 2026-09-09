import { describe, expect, it } from 'vitest';
import {
  MAX_SHARE_IMAGE_AREA_PX,
  MAX_SHARE_IMAGE_SIDE_PX,
  formatShareImageSize,
  isShareImageSizeExportable,
  shareImageOutputSize,
  shareImagePreviewScale,
} from './outputSize';

describe('shareImageOutputSize', () => {
  it('test_shareImageOutputSize_scale1_equalsCropRect', () => {
    expect(shareImageOutputSize({ x: 0, y: 0, width: 200, height: 120 }, 1)).toEqual({
      width: 200,
      height: 120,
    });
  });

  it('test_shareImageOutputSize_scale3_multipliesBothSides', () => {
    expect(shareImageOutputSize({ x: -40, y: 20, width: 200, height: 120 }, 3)).toEqual({
      width: 600,
      height: 360,
    });
  });

  it('test_shareImageOutputSize_zeroCropRect_neverBelowOnePixel', () => {
    expect(shareImageOutputSize({ x: 0, y: 0, width: 0, height: 0 }, 2)).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe('isShareImageSizeExportable', () => {
  it('test_isShareImageSizeExportable_withinLimits_true', () => {
    expect(isShareImageSizeExportable({ width: 8192, height: 8192 })).toBe(true);
  });

  it('test_isShareImageSizeExportable_areaOverLimit_false', () => {
    expect(isShareImageSizeExportable({ width: 8192, height: 8193 })).toBe(false);
  });

  it('test_isShareImageSizeExportable_sideOverLimit_false_evenWithSmallArea', () => {
    expect(isShareImageSizeExportable({ width: MAX_SHARE_IMAGE_SIDE_PX + 1, height: 10 })).toBe(
      false,
    );
  });

  it('test_isShareImageSizeExportable_benchmarkDocument_only1xFits', () => {
    // spec §14 baseline: 309 × 361 cells at 20 px.
    const at = (scale: number) => ({ width: 6180 * scale, height: 7220 * scale });
    expect(isShareImageSizeExportable(at(1))).toBe(true);
    expect(isShareImageSizeExportable(at(2))).toBe(false);
    expect(isShareImageSizeExportable(at(3))).toBe(false);
  });

  it('test_MAX_SHARE_IMAGE_AREA_PX_isBelowChromiumCanvasAreaLimit', () => {
    expect(MAX_SHARE_IMAGE_AREA_PX).toBeLessThanOrEqual(16_384 * 16_384);
  });
});

describe('formatShareImageSize', () => {
  it('test_formatShareImageSize_rendersWidthTimesHeightPx', () => {
    expect(formatShareImageSize({ width: 2400, height: 1800 })).toBe('2400 × 1800 px');
  });
});

describe('shareImagePreviewScale', () => {
  const box = { width: 288, height: 200 };

  it('test_shareImagePreviewScale_smallSketch_staysAtOne', () => {
    expect(shareImagePreviewScale({ x: 0, y: 0, width: 100, height: 60 }, box)).toBe(1);
  });

  it('test_shareImagePreviewScale_wideSketch_fitsWidth', () => {
    expect(shareImagePreviewScale({ x: 0, y: 0, width: 2880, height: 200 }, box)).toBeCloseTo(0.1);
  });

  it('test_shareImagePreviewScale_tallSketch_fitsHeight', () => {
    expect(shareImagePreviewScale({ x: 0, y: 0, width: 200, height: 4000 }, box)).toBeCloseTo(0.05);
  });
});
