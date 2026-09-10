import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useViewportStore } from '@/stores/viewportStore';

interface PanGesture {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
};

/** Give middle-button and Space + primary-button pans priority over canvas tools. */
export const useViewportPan = () => {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panGestureRef = useRef<PanGesture | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat && !isEditableTarget(event.target)) {
        event.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false);
    };

    const handleBlur = () => setIsSpacePressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const updatePan = useCallback((event: ReactPointerEvent<HTMLDivElement>, gesture: PanGesture) => {
    useViewportStore.getState().setOffset({
      x: gesture.startOffsetX + event.clientX - gesture.startClientX,
      y: gesture.startOffsetY + event.clientY - gesture.startClientY,
    });
  }, []);

  const handlePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const isMiddleButton = event.button === 1;
      const isSpaceDrag = isSpacePressed && event.button === 0;
      if (!isMiddleButton && !isSpaceDrag) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const offset = useViewportStore.getState().offset;
      panGestureRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      };
      setIsPanning(true);
    },
    [isSpacePressed]
  );

  const handleMouseDownCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 1 && !(isSpacePressed && event.button === 0)) return;

      // Prevent the compatibility mouse event from reaching a Konva shape.
      event.preventDefault();
      event.stopPropagation();
    },
    [isSpacePressed]
  );

  const handlePointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = panGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      updatePan(event, gesture);
    },
    [updatePan]
  );

  const finishPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = panGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      updatePan(event, gesture);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panGestureRef.current = null;
      setIsPanning(false);
    },
    [updatePan]
  );

  const cancelPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    panGestureRef.current = null;
    setIsPanning(false);
  }, []);

  const handleAuxClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button === 1) event.preventDefault();
  }, []);

  return {
    isPanning,
    isSpacePressed,
    isViewportInteracting: isPanning || isSpacePressed,
    handlePointerDownCapture,
    handlePointerMoveCapture,
    handlePointerUpCapture: finishPan,
    handlePointerCancelCapture: cancelPan,
    handleMouseDownCapture,
    handleAuxClick,
  };
};
