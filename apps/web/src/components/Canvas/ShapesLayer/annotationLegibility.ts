/**
 * Whether a shape is big enough on screen for its name to be legible.
 *
 * Spec §8 says the name is shown "常時" (always); this reads that as "always,
 * while it can be read" (issue #61 scope 4). Once the shape's smaller screen
 * dimension is under one line of the label's font — e.g. a one-cell-wide
 * shape at zoom 0.5 with the 12 px default — the text would be larger than
 * the thing it labels and unreadable against its neighbours anyway, so the
 * annotation is skipped. Zooming back in restores it. This keeps a zoomed-out
 * view of the spec §14 baseline (500 shapes) from drawing 500 unreadable
 * labels every frame.
 */
export const isAnnotationLegible = (
  boxWidthCells: number,
  boxHeightCells: number,
  gridSize: number,
  scale: number,
  fontSize: number
): boolean => Math.min(boxWidthCells, boxHeightCells) * gridSize * scale >= fontSize;
