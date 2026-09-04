import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { editorSession } from '@/features/editor';
import { useSettingsStore } from '@/stores';
import { SettingsPanel } from './SettingsPanel';

const reset = () => {
  // Wrapped in act: a previous test's SettingsPanel may still be mounted
  // when this runs in afterEach, so the resulting re-render must be flushed
  // inside React's test harness.
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSettingsStore.setState({
      includeDimensionsInShareImage: true,
      includeGridInShareImage: true,
    });
  });
};

const openPanel = async () => {
  const user = userEvent.setup();
  render(<SettingsPanel />);
  await user.click(screen.getByRole('button', { name: '設定' }));
  return user;
};

describe('SettingsPanel', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_SettingsPanel_trigger_hasAccessibleName', () => {
    render(<SettingsPanel />);
    expect(screen.getByRole('button', { name: '設定' })).toBeInTheDocument();
  });

  it('test_SettingsPanel_noScale_switchIsOff_andInputsDisabled', async () => {
    await openPanel();

    expect(screen.getByRole('switch', { name: '実寸スケールを有効にする' })).not.toBeChecked();
    expect(screen.getByLabelText('1セル =')).toBeDisabled();
  });

  it('test_SettingsPanel_togglingSwitchOn_dispatchesSetPhysicalScaleCommand', async () => {
    const user = await openPanel();

    await user.click(screen.getByRole('switch', { name: '実寸スケールを有効にする' }));

    expect(editorSession.getDocument().physicalScale).toBeDefined();
    expect(editorSession.canUndo).toBe(true);
  });

  it('test_SettingsPanel_togglingSwitchOff_clearsPhysicalScale_andIsUndoable', async () => {
    const user = await openPanel();
    await user.click(screen.getByRole('switch', { name: '実寸スケールを有効にする' }));
    await user.click(screen.getByRole('switch', { name: '実寸スケールを有効にする' }));

    expect(editorSession.getDocument().physicalScale).toBeUndefined();

    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().physicalScale).toBeDefined();
  });

  it('test_SettingsPanel_changingValue_onBlur_updatesPhysicalScale', async () => {
    const user = await openPanel();
    await user.click(screen.getByRole('switch', { name: '実寸スケールを有効にする' }));

    const input = screen.getByLabelText('1セル =');
    await user.clear(input);
    await user.type(input, '25');
    await user.tab();

    expect(editorSession.getDocument().physicalScale?.valuePerCell).toBe(25);
  });

  it('test_SettingsPanel_changingUnit_updatesPhysicalScale', async () => {
    const user = await openPanel();
    await user.click(screen.getByRole('switch', { name: '実寸スケールを有効にする' }));

    await user.click(screen.getByRole('button', { name: 'm' }));

    expect(editorSession.getDocument().physicalScale?.unit).toBe('m');
  });

  it('test_SettingsPanel_toggleIncludeDimensions_updatesSettingsStore', async () => {
    const user = await openPanel();

    await user.click(screen.getByLabelText('寸法を含める'));

    expect(useSettingsStore.getState().includeDimensionsInShareImage).toBe(false);
  });

  it('test_SettingsPanel_toggleIncludeGrid_updatesSettingsStore', async () => {
    const user = await openPanel();

    await user.click(screen.getByLabelText('グリッドを含める'));

    expect(useSettingsStore.getState().includeGridInShareImage).toBe(false);
  });
});
