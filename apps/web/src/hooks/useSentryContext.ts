import { useEffect } from 'react';
import { setSentryContext, isSentryInitialized } from '@/config/sentry';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';

/**
 * Hook to automatically sync application state with Sentry context
 * This provides additional debugging information when errors occur
 */
export const useSentryContext = (): void => {
  const objects = useCanvasStore((state) => state.objects);
  const toolMode = useCanvasStore((state) => state.toolMode);
  const selectedObjectId = useCanvasStore((state) => state.selectedObjectId);

  const cellSize = useGridSettingsStore((state) => state.cellSize);
  const unit = useGridSettingsStore((state) => state.unit);
  const zoom = useGridSettingsStore((state) => state.zoom);

  // Update canvas context when relevant state changes
  useEffect(() => {
    if (!isSentryInitialized()) return;

    setSentryContext('canvas', {
      objectCount: objects.length,
      toolMode,
      hasSelection: selectedObjectId !== null,
    });
  }, [objects.length, toolMode, selectedObjectId]);

  // Update grid settings context when relevant state changes
  useEffect(() => {
    if (!isSentryInitialized()) return;

    setSentryContext('gridSettings', {
      cellSize,
      unit,
      zoom,
    });
  }, [cellSize, unit, zoom]);
};
