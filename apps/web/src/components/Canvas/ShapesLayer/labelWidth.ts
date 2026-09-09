/**
 * East Asian wide characters — kana, CJK ideographs, and full-width forms —
 * which take a full em in every font the annotation stack falls back to,
 * versus roughly 0.6 em for Latin letters, digits, and punctuation.
 */
// U+3000 (ideographic space) to U+30FF (katakana), CJK ideographs, and full-width forms.
const WIDE_CHARACTER = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

const WIDE_EM = 1;
const NARROW_EM = 0.6;

/**
 * Rough width of a label in pixels, used to centre it without measuring text
 * on a canvas. Wide characters count as a full em (issue #67 item 5: with
 * every character at 0.6 em, "6 セル × 9 セル" came out a third too narrow,
 * and a Konva `Text` sized to that estimate wrapped or clipped its last
 * characters in the share image). The result deliberately errs wide — a box
 * slightly larger than the text is invisible, a smaller one is not.
 */
export const estimateLabelWidth = (text: string, fontSize: number): number => {
  let ems = 0;
  for (const character of text) {
    ems += WIDE_CHARACTER.test(character) ? WIDE_EM : NARROW_EM;
  }
  return ems * fontSize;
};
