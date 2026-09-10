import { describe, expect, it } from 'vitest';
import headersFile from '../../public/_headers?raw';
import { getAllSecurityHeaders } from './security';

/**
 * `public/_headers`（Cloudflare が配信時に付与するヘッダー）を
 * `security.ts` の本番設定と突き合わせる。
 * meta タグと HTTP ヘッダーで CSP が食い違うと、緩い側の許可が無効になり
 * 原因が分かりにくいため、ここで一致を強制する。
 */
const parseHeadersFile = (raw: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  let inRootRule = false;

  for (const line of raw.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      inRootRule = line.trim() === '/*';
      continue;
    }
    if (!inRootRule) continue;
    const separator = line.indexOf(':');
    headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return headers;
};

describe('public/_headers', () => {
  it('test_headersFile_rootRule_matchesProductionSecurityHeaders', () => {
    const fromFile = parseHeadersFile(headersFile);
    const expected = getAllSecurityHeaders('production');

    expect(fromFile).toEqual(expected);
  });
});
