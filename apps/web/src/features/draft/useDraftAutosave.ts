import { useEffect } from 'react';
import { startDraftAutosave } from './draftAutosave';
import type { DraftStorageAdapter } from './types';

/**
 * Mounts {@link startDraftAutosave} for the component's lifetime (issue #55).
 * `storage` should be a stable reference (e.g. from `useMemo`) — a new
 * instance on every render would restart the subscription each time.
 */
export const useDraftAutosave = (storage: DraftStorageAdapter): void => {
  useEffect(() => {
    return startDraftAutosave(storage);
  }, [storage]);
};
