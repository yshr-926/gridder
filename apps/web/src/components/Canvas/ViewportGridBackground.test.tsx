import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ViewportGridBackground } from './ViewportGridBackground';
import { useViewportStore } from '@/stores/viewportStore';

const renderCount = { current: 0 };

vi.mock('./GridBackground', () => ({
  GridBackground: (props: Record<string, unknown>) => {
    renderCount.current += 1;
    return (
      <div
        data-testid="grid-background"
        data-start-x={String(props.startX)}
        data-end-x={String(props.endX)}
        data-zoom={String(props.zoom)}
      />
    );
  },
}));

describe('ViewportGridBackground', () => {
  beforeEach(() => {
    useViewportStore.getState().resetViewport();
    renderCount.current = 0;
  });

  it('test_ViewportGridBackground_subPixelPan_doesNotRerenderGrid', () => {
    // Start mid-quantum so neither edge of the range sits on a boundary.
    useViewportStore.getState().setOffset({ x: -50, y: -50 });
    render(<ViewportGridBackground width={800} height={600} gridSize={20} />);
    const after = renderCount.current;

    act(() => {
      // Stays inside the same 5-cell window on every edge: no re-render.
      useViewportStore.getState().panBy({ x: -37, y: -12 });
    });

    expect(renderCount.current).toBe(after);
  });

  it('test_ViewportGridBackground_panAcrossQuantum_shiftsRange', () => {
    render(<ViewportGridBackground width={800} height={600} gridSize={20} />);
    const before = Number(screen.getByTestId('grid-background').getAttribute('data-start-x'));

    act(() => {
      useViewportStore.getState().panBy({ x: -101, y: 0 });
    });

    const after = Number(screen.getByTestId('grid-background').getAttribute('data-start-x'));
    expect(after).toBe(before + 5);
  });

  it('test_ViewportGridBackground_zoom_forwardsScale', () => {
    render(<ViewportGridBackground width={800} height={600} gridSize={20} />);

    act(() => {
      useViewportStore.getState().setScale(2);
    });

    expect(screen.getByTestId('grid-background').getAttribute('data-zoom')).toBe('2');
  });
});
