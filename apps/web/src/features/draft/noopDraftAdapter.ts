import type { DraftStorageAdapter } from './types';

/**
 * A {@link DraftStorageAdapter} that does nothing (issue #55). Selected only
 * when `window.indexedDB` is unavailable (e.g. some private-browsing modes) —
 * crash recovery is simply unavailable there rather than falling back to
 * `localStorage`, since spec's 50,000-cell sizing reference is exactly the
 * case `localStorage`'s ~5–10MB per-origin cap can't reliably hold. Losing
 * crash recovery in that narrow case is a strictly better outcome than a
 * save silently failing (or throwing) partway through a large document.
 */
export class NoopDraftAdapter implements DraftStorageAdapter {
  async save(): Promise<void> {}
  async load(): Promise<string | null> {
    return null;
  }
  async clear(): Promise<void> {}
}
