import { describe, expect, it } from 'vitest';
import { getCSPHeader, getMetaCSPHeader } from './security';

describe('getMetaCSPHeader', () => {
  it('test_getMetaCSPHeader_production_omitsFrameAncestors', () => {
    const meta = getMetaCSPHeader('production');

    expect(meta).not.toContain('frame-ancestors');
    expect(getCSPHeader('production')).toContain("frame-ancestors 'none'");
  });

  it('test_getMetaCSPHeader_production_keepsOtherDirectives', () => {
    const meta = getMetaCSPHeader('production');

    expect(meta).toContain("default-src 'self'");
    expect(meta).toContain("script-src 'self'");
    expect(meta).toContain("object-src 'none'");
    expect(meta).toContain("base-uri 'self'");
  });
});
