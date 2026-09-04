/**
 * Renderer theme for the polygon shape layer.
 *
 * Per `docs/spec.md` §8 the border colour and width are decided by the theme,
 * never by the document: `ShapeStyle` only carries `isBorderVisible`. The name
 * annotation is likewise a renderer concern. Keeping these values here (rather
 * than inline in the components) makes the single source obvious and leaves one
 * place to swap when a real theming system lands.
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
  /** Name annotation font size in screen pixels (constant regardless of zoom). */
  readonly annotationFontSize: number;
  /** Name annotation font family. */
  readonly annotationFontFamily: string;
}

export const DEFAULT_SHAPES_LAYER_THEME: ShapesLayerTheme = {
  borderColor: '#334155',
  borderWidth: 1.5,
  hitStrokeWidth: 12,
  annotationColor: '#1f2937',
  annotationFontSize: 12,
  annotationFontFamily:
    "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
};
