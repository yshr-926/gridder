import { useShallow } from 'zustand/react/shallow';
import { useViewportStore } from '@/stores/viewportStore';
import { visibleCellRange } from '@/features/viewport';
import { GridBackground } from './GridBackground';

/**
 * How coarsely the visible cell range is quantised before it reaches
 * `GridBackground` (issue #61). The grid lines are regenerated only when the
 * viewport crosses a boundary this many cells apart — five matches the major
 * grid-line period — instead of on every sub-pixel pan frame. The extra
 * off-screen lines this draws are at most 2 × 5 per axis.
 */
export const GRID_RANGE_QUANTUM_CELLS = 5;

interface ViewportGridBackgroundProps {
  /** Canvas width in screen pixels. */
  width: number;
  /** Canvas height in screen pixels. */
  height: number;
  /** Pixel size of one grid cell. */
  gridSize: number;
}

/**
 * `GridBackground` bound to the live viewport store. This is the only piece
 * of the canvas tree that subscribes to `offset`, and it does so through a
 * quantised selector: a pan that stays within the same 5-cell window changes
 * nothing here, so neither this component nor `GridBackground` re-renders.
 * The Stage itself moves via `useStageViewport`, not via React.
 */
export const ViewportGridBackground = ({
  width,
  height,
  gridSize,
}: ViewportGridBackgroundProps) => {
  const range = useViewportStore(
    useShallow(state =>
      visibleCellRange(
        { scale: state.scale, offset: state.offset },
        { width, height },
        gridSize,
        GRID_RANGE_QUANTUM_CELLS
      )
    )
  );
  const zoom = useViewportStore(state => state.scale);

  return (
    <GridBackground
      startX={range.startX}
      startY={range.startY}
      endX={range.endX}
      endY={range.endY}
      gridSize={gridSize}
      zoom={zoom}
    />
  );
};
