import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument, EditorSession } from '../editor';
import { loadBenchmarkFromQuery } from './loadBenchmarkFromQuery';

describe('loadBenchmarkFromQuery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('test_loadBenchmarkFromQuery_noBenchmarkParam_leavesSessionUntouched', () => {
    const session = new EditorSession(createEmptyDocument());
    const before = session.getDocument();

    loadBenchmarkFromQuery(session, { search: '' });

    expect(session.getDocument()).toBe(before);
  });

  it('test_loadBenchmarkFromQuery_benchmarkParamWithNoValue_loadsTheDefaultFixture', () => {
    const session = new EditorSession(createEmptyDocument());

    loadBenchmarkFromQuery(session, { search: '?benchmark' });

    expect(session.shapeCount).toBe(500);
  });

  it('test_loadBenchmarkFromQuery_benchmarkParamWithCount_loadsThatManyShapes', () => {
    const session = new EditorSession(createEmptyDocument());

    loadBenchmarkFromQuery(session, { search: '?benchmark=30' });

    expect(session.shapeCount).toBe(30);
  });

  it('test_loadBenchmarkFromQuery_nonNumericValue_fallsBackToDefault', () => {
    const session = new EditorSession(createEmptyDocument());

    loadBenchmarkFromQuery(session, { search: '?benchmark=not-a-number' });

    expect(session.shapeCount).toBe(500);
  });

  it('test_loadBenchmarkFromQuery_resetsHistory_soTheFixtureCannotBeUndoneAway', () => {
    const session = new EditorSession(createEmptyDocument());

    loadBenchmarkFromQuery(session, { search: '?benchmark=10' });

    expect(session.canUndo).toBe(false);
  });

  it('test_loadBenchmarkFromQuery_outsideDev_isANoOp', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_E2E', undefined);
    const session = new EditorSession(createEmptyDocument());
    const before = session.getDocument();

    loadBenchmarkFromQuery(session, { search: '?benchmark=10' });

    expect(session.getDocument()).toBe(before);
  });

  it('test_loadBenchmarkFromQuery_e2eBuild_loadsTheFixture', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_E2E', 'true');
    const session = new EditorSession(createEmptyDocument());

    loadBenchmarkFromQuery(session, { search: '?benchmark=10' });

    expect(session.shapeCount).toBe(10);
  });

  it('test_loadBenchmarkFromQuery_otherUnrelatedQueryParams_isANoOp', () => {
    const session = new EditorSession(createEmptyDocument());
    const before = session.getDocument();

    loadBenchmarkFromQuery(session, { search: '?foo=bar' });

    expect(session.getDocument()).toBe(before);
  });
});
