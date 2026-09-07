import { useEffect, type RefObject } from 'react';
import type Konva from 'konva';
import { useViewportStore } from '@/stores/viewportStore';

/**
 * Drive a Konva `Stage`'s position and scale straight from the viewport
 * store, outside React (issue #61, spec §14).
 *
 * A pan is nothing but the Stage's `x` / `y`; routing it through React props
 * re-rendered `GridCanvas` and every shape node under it on each pointer
 * move. This hook subscribes to the store once, and on every `offset` /
 * `scale` change applies the transform to the Stage and queues a Konva
 * redraw — no React render is involved. Components that genuinely depend on
 * `scale` (zoom-invariant overlays and annotations) still subscribe to it
 * themselves; nothing needs `offset` as a prop any more (pointer handlers
 * read `readViewportTransform()` at event time).
 *
 * The Stage must therefore be rendered *without* `x` / `y` / `scaleX` /
 * `scaleY` props: react-konva only touches attributes that appear in its
 * props, so leaving them out keeps the two writers from fighting.
 */
export const useStageViewport = (stageRef: RefObject<Konva.Stage | null>): void => {
  useEffect(() => {
    const apply = (state: { scale: number; offset: { x: number; y: number } }): void => {
      const stage = stageRef.current;
      if (stage === null) {
        return;
      }
      stage.position({ x: state.offset.x, y: state.offset.y });
      stage.scale({ x: state.scale, y: state.scale });
      stage.batchDraw();
    };
    apply(useViewportStore.getState());
    return useViewportStore.subscribe((state, previous) => {
      if (state.offset !== previous.offset || state.scale !== previous.scale) {
        apply(state);
      }
    });
  }, [stageRef]);
};
