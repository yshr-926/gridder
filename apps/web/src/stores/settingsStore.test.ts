import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './settingsStore';

const DEFAULT_STATE = { includeDimensionsInShareImage: true, includeGridInShareImage: true };

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_STATE);
  });

  it('test_useSettingsStore_defaults_includeBothDimensionsAndGrid', () => {
    expect(useSettingsStore.getState()).toMatchObject(DEFAULT_STATE);
  });

  it('test_setIncludeDimensionsInShareImage_updatesOnlyThatFlag', () => {
    useSettingsStore.getState().setIncludeDimensionsInShareImage(false);

    expect(useSettingsStore.getState().includeDimensionsInShareImage).toBe(false);
    expect(useSettingsStore.getState().includeGridInShareImage).toBe(true);
  });

  it('test_setIncludeGridInShareImage_updatesOnlyThatFlag', () => {
    useSettingsStore.getState().setIncludeGridInShareImage(false);

    expect(useSettingsStore.getState().includeGridInShareImage).toBe(false);
    expect(useSettingsStore.getState().includeDimensionsInShareImage).toBe(true);
  });
});
