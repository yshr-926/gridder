import type { DraftStorageAdapter } from './types';

/**
 * IndexedDB-backed {@link DraftStorageAdapter} (issue #55, spec §9 crash
 * recovery draft).
 *
 * IndexedDB over `localStorage`: a sketch with roughly 50,000 cells' worth of
 * geometry (spec's sizing reference) serializes to a JSON document that can
 * run into several megabytes once every shape's vertices, styles, and names
 * are included. `localStorage` caps out around 5–10MB *per origin, shared
 * with everything else the app ever stores there* in most browsers, with no
 * way to request more; IndexedDB's quota is a large, browser-managed share
 * of available disk space (typically many hundreds of MB or more), so a
 * large sketch's draft is never at realistic risk of hitting the ceiling.
 * IndexedDB's API is also asynchronous, which matters less for correctness
 * here than the capacity headroom, but avoids blocking the main thread on
 * writes of that size the way a synchronous `localStorage.setItem` would.
 *
 * Uses its own database and store name — entirely separate from the retired
 * `features/export/autoSave.ts`'s `localStorage` keys (`gridder_autosave`,
 * `gridder_autosave_time`) — so this never reads, writes, or clears that
 * module's data; the two coexist harmlessly until #59 removes the old one.
 */

const DATABASE_NAME = 'gridder-draft';
const DATABASE_VERSION = 1;
const STORE_NAME = 'draft';
/** Single fixed key: this store ever holds at most one draft (the current sketch). */
const DRAFT_KEY = 'current';

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open the draft database.'));
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = run(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Draft store transaction failed.'));
    });
  } finally {
    database.close();
  }
};

/**
 * The Adapter `selectDraftStorage` constructs when `window.indexedDB` exists
 * (essentially every browser Gridder targets — ADR-0004). Every method opens
 * and closes its own connection rather than holding one for the object's
 * lifetime, since a draft write happens at most once per debounce window
 * (seconds apart) and there is no benefit to keeping a handle open between
 * calls.
 */
export class IndexedDbDraftAdapter implements DraftStorageAdapter {
  async save(content: string): Promise<void> {
    await runTransaction('readwrite', (store) => store.put(content, DRAFT_KEY));
  }

  async load(): Promise<string | null> {
    const result = await runTransaction<string | undefined>('readonly', (store) =>
      store.get(DRAFT_KEY)
    );
    return result ?? null;
  }

  async clear(): Promise<void> {
    await runTransaction('readwrite', (store) => store.delete(DRAFT_KEY));
  }
}
