import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type Konva from 'konva';
import { useViewportStore } from '@/stores/viewportStore';
import { useStageViewport } from './useStageViewport';

const createStageStub = () => {
  const stage = {
    position: vi.fn(),
    scale: vi.fn(),
    batchDraw: vi.fn(),
  };
  return { ref: { current: stage as unknown as Konva.Stage }, stage };
};

describe('useStageViewport', () => {
  beforeEach(() => {
    useViewportStore.getState().resetViewport();
  });

  it('test_useStageViewport_mount_appliesCurrentTransformToStage', () => {
    useViewportStore.getState().setOffset({ x: 12, y: -8 });
    useViewportStore.getState().setScale(2);
    const { ref, stage } = createStageStub();

    renderHook(() => useStageViewport(ref));

    expect(stage.position).toHaveBeenLastCalledWith({ x: 12, y: -8 });
    expect(stage.scale).toHaveBeenLastCalledWith({ x: 2, y: 2 });
    expect(stage.batchDraw).toHaveBeenCalled();
  });

  it('test_useStageViewport_pan_updatesStageWithoutRerender', () => {
    const { ref, stage } = createStageStub();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      useStageViewport(ref);
    });
    const rendersAfterMount = renders;

    useViewportStore.getState().panBy({ x: 5, y: 7 });

    expect(stage.position).toHaveBeenLastCalledWith({ x: 5, y: 7 });
    expect(renders).toBe(rendersAfterMount);
  });

  it('test_useStageViewport_unrelatedStoreChange_doesNotRedraw', () => {
    const { ref, stage } = createStageStub();
    renderHook(() => useStageViewport(ref));
    stage.batchDraw.mockClear();

    // Same offset object and scale: nothing for the Stage to do.
    useViewportStore.setState({});

    expect(stage.batchDraw).not.toHaveBeenCalled();
  });

  it('test_useStageViewport_unmount_stopsApplying', () => {
    const { ref, stage } = createStageStub();
    const { unmount } = renderHook(() => useStageViewport(ref));
    unmount();
    stage.position.mockClear();

    useViewportStore.getState().panBy({ x: 1, y: 1 });

    expect(stage.position).not.toHaveBeenCalled();
  });
});
