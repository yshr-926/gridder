import { IndexedDbDraftAdapter } from './indexedDbDraftAdapter';
import { NoopDraftAdapter } from './noopDraftAdapter';
import type { DraftStorageAdapter } from './types';

/** Whether this browser exposes IndexedDB (issue #55). */
export const supportsIndexedDb = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

/**
 * Pick the draft storage Adapter for this browser: IndexedDB where
 * available, a no-op Adapter otherwise (see {@link NoopDraftAdapter} for why
 * this skips a `localStorage` fallback). Callers only ever see the shared
 * {@link DraftStorageAdapter} interface.
 */
export const selectDraftStorage = (): DraftStorageAdapter =>
  supportsIndexedDb() ? new IndexedDbDraftAdapter() : new NoopDraftAdapter();
