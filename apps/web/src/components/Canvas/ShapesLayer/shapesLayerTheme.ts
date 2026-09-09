/**
 * Renderer theme for the polygon shape layer.
 *
 * Per `docs/spec.md` §8 the border colour and width are decided by the theme,
 * never by the document: `ShapeStyle` only carries `isBorderVisible`. The name
 * annotation's colour and font family are likewise renderer concerns; its
 * *size* is not — it is the sketch-wide `EditorDocument.annotationFontSize`
 * (issue #66), so it has no theme entry and no theme default. Keeping the
 * remaining values here (rather than inline in the components) makes the
 * single source obvious and leaves one place to swap when a real theming
 * system lands.
 */
export interface ShapesLayerTheme {
  /** Stroke colour for a shape whose border is visible. */
  readonly borderColor: string;
  /** Stroke width in screen pixels (kept constant regardless of zoom). */
  readonly borderWidth: number;
  /**
   * Extra invisible hit width added around a shape's outline so thin shapes
   * stay grabbable. Screen pixels.
   */
  readonly hitStrokeWidth: number;
  /** Name annotation colour. */
  readonly annotationColor: string;
  /** Name annotation font family. */
  readonly annotationFontFamily: string;
}

export const DEFAULT_SHAPES_LAYER_THEME: ShapesLayerTheme = {
  borderColor: '#334155',
  borderWidth: 1.5,
  hitStrokeWidth: 12,
  annotationColor: '#1f2937',
  annotationFontFamily:
    "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
};
