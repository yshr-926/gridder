import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbDraftAdapter } from './indexedDbDraftAdapter';
import { NoopDraftAdapter } from './noopDraftAdapter';
import { selectDraftStorage, supportsIndexedDb } from './selectDraftStorage';

describe('selectDraftStorage / supportsIndexedDb', () => {
  const originalIndexedDb = globalThis.indexedDB;

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDb;
  });

  it('test_indexedDbPresent_supportsIndexedDbIsTrue_andSelectsThatAdapter', () => {
    // @ts-expect-error -- a minimal stand-in is enough for the presence check.
    globalThis.indexedDB = {};
    expect(supportsIndexedDb()).toBe(true);
    expect(selectDraftStorage()).toBeInstanceOf(IndexedDbDraftAdapter);
  });

  it('test_indexedDbMissing_supportsIndexedDbIsFalse_andSelectsTheNoopAdapter', () => {
    // @ts-expect-error -- simulating an environment without IndexedDB.
    globalThis.indexedDB = undefined;
    expect(supportsIndexedDb()).toBe(false);
    expect(selectDraftStorage()).toBeInstanceOf(NoopDraftAdapter);
  });
});
