import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbDraftAdapter } from './indexedDbDraftAdapter';

/**
 * Drives `IndexedDbDraftAdapter` against a minimal in-memory fake of the
 * `indexedDB` global (issue #55) — jsdom does not implement IndexedDB, and
 * this project has no IndexedDB polyfill dependency, so the fake below
 * implements just the request/transaction/object-store surface the adapter
 * actually calls (`open`, `onupgradeneeded`, `transaction`, `objectStore`,
 * `get` / `put` / `delete`), enough to exercise its real code path rather
 * than mocking the adapter's own methods.
 */

interface FakeRequest<T> {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
  result: T;
  error: Error | null;
}

const microtask = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFakeIndexedDb = () => {
  const store = new Map<string, unknown>();
  let storeCreated = false;

  const makeRequest = <T>(compute: () => T, shouldFail = false): FakeRequest<T> => {
    const request: FakeRequest<T> = {
      onsuccess: null,
      onerror: null,
      result: undefined as unknown as T,
      error: null,
    };
    void microtask().then(() => {
      if (shouldFail) {
        request.error = new Error('fake failure');
        request.onerror?.();
        return;
      }
      request.result = compute();
      request.onsuccess?.();
    });
    return request;
  };

  const fakeObjectStore = {
    get: (key: string) => makeRequest(() => store.get(key)),
    put: (value: unknown, key: string) =>
      makeRequest(() => {
        store.set(key, value);
        return key;
      }),
    delete: (key: string) =>
      makeRequest(() => {
        store.delete(key);
        return undefined;
      }),
  };

  const fakeDatabase = {
    objectStoreNames: { contains: () => storeCreated },
    createObjectStore: () => {
      storeCreated = true;
      return fakeObjectStore;
    },
    transaction: () => ({
      objectStore: () => fakeObjectStore,
    }),
    close: () => {},
  };

  const open = vi.fn(() => {
    const request: FakeRequest<typeof fakeDatabase> & { onupgradeneeded: (() => void) | null } = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: fakeDatabase,
      error: null,
    };
    void microtask().then(() => {
      if (!storeCreated) {
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });
    return request;
  });

  return { open, store };
};

describe('IndexedDbDraftAdapter', () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    const fake = createFakeIndexedDb();
    // @ts-expect-error -- assigning a minimal fake, not the full IDBFactory surface.
    globalThis.indexedDB = fake;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDb;
  });

  it('test_load_noDraftSaved_resolvesNull', async () => {
    const adapter = new IndexedDbDraftAdapter();
    await expect(adapter.load()).resolves.toBeNull();
  });

  it('test_save_thenLoad_roundTripsTheContent', async () => {
    const adapter = new IndexedDbDraftAdapter();
    await adapter.save('{"formatVersion":1}');
    await expect(adapter.load()).resolves.toBe('{"formatVersion":1}');
  });

  it('test_save_overwritesThePreviousDraft', async () => {
    const adapter = new IndexedDbDraftAdapter();
    await adapter.save('{"a":1}');
    await adapter.save('{"a":2}');
    await expect(adapter.load()).resolves.toBe('{"a":2}');
  });

  it('test_clear_removesTheDraft', async () => {
    const adapter = new IndexedDbDraftAdapter();
    await adapter.save('{"a":1}');
    await adapter.clear();
    await expect(adapter.load()).resolves.toBeNull();
  });

  it('test_clear_withNoDraft_isANoOp', async () => {
    const adapter = new IndexedDbDraftAdapter();
    await expect(adapter.clear()).resolves.toBeUndefined();
  });
});
