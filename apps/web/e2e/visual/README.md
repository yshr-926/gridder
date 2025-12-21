# Visual Regression Tests

## Overview

This directory contains visual regression tests for the Gridder application. These tests capture screenshots of the application in various states and compare them against baseline images to detect unintended visual changes.

## Directory Structure

```
e2e/visual/
├── README.md                    # This file
├── visual.spec.ts               # Visual regression test cases
└── visual.spec.ts-snapshots/    # Baseline screenshots (auto-generated)
    ├── initial-state-chromium-darwin.png
    ├── draw-mode-chromium-darwin.png
    └── ...
```

## Running Visual Tests

### Run All Visual Tests

```bash
npm run test:e2e -- e2e/visual/
```

### Run with Specific Browser

```bash
# Chromium only
npm run test:e2e -- e2e/visual/ --project=chromium

# Firefox only
npm run test:e2e -- e2e/visual/ --project=firefox

# WebKit only
npm run test:e2e -- e2e/visual/ --project=webkit
```

### Run in Headed Mode (for debugging)

```bash
npm run test:e2e:headed -- e2e/visual/
```

### Run with UI Mode

```bash
npm run test:e2e:ui -- e2e/visual/
```

## Updating Baseline Screenshots

When you make intentional UI changes, you need to update the baseline screenshots.

### Update All Screenshots

```bash
npm run test:e2e -- e2e/visual/ --update-snapshots
```

### Update Specific Test Screenshots

```bash
# Update only tests matching "draw mode"
npm run test:e2e -- e2e/visual/ --update-snapshots -g "draw mode"
```

### Update for Specific Browser

```bash
npm run test:e2e -- e2e/visual/ --update-snapshots --project=chromium
```

## Screenshot Storage Location

- **Baselines**: `e2e/visual/visual.spec.ts-snapshots/`
- **Test Results**: `test-results/` (generated on test failure)
- **HTML Report**: `playwright-report/` (run `npm run test:e2e:report` to view)

## Tolerance Settings

Each test uses `maxDiffPixelRatio` to allow for minor rendering differences:

| Content Type | Tolerance | Description |
|-------------|-----------|-------------|
| Static UI | 0.01 (1%) | Toolbar, headers, static components |
| Canvas Content | 0.02 (2%) | Canvas with drawn objects, zoom states |

### Why Different Tolerances?

- **Static UI (1%)**: These components should be pixel-perfect across runs
- **Canvas (2%)**: Allows for minor rendering variations in Konva.js canvas

## Test Categories

### Initial State Tests
- `initial-state.png` - Application on first load
- `page-layout.png` - Overall page structure
- `clean-canvas.png` - Canvas after clearing data

### Tool Mode Tests
- `draw-mode.png` - Drawing tool selected
- `select-mode.png` - Selection tool selected
- `eraser-mode.png` - Eraser tool selected

### UI Component Tests
- `toolbar.png` - Toolbar component
- `property-panel.png` - Property panel
- `status-bar.png` - Status bar
- `header.png` - Header component

### Canvas State Tests
- `with-drawn-object.png` - Canvas with shapes
- `object-selected.png` - Selected object highlight
- `after-drag-draw.png` - After drag drawing operation

### Zoom Tests
- `zoomed-in.png` - Canvas zoomed in
- `zoomed-out.png` - Canvas zoomed out

### Interactive Element Tests
- `toolbar-hover.png` - Toolbar button hover state
- `zoom-controls.png` - Zoom control buttons

## CI/CD Integration

Visual tests run automatically in CI. Platform-specific snapshots are generated:

- `*-chromium-linux.png` - Linux CI environment
- `*-chromium-darwin.png` - macOS
- `*-chromium-win32.png` - Windows

### Handling CI Failures

1. Download the test artifacts from the failed CI run
2. Review the `test-results/` directory for diff images
3. If changes are intentional, update baselines locally:
   ```bash
   npm run test:e2e -- e2e/visual/ --update-snapshots
   ```
4. Commit the updated baseline images

## Troubleshooting

### Screenshot Differences Occur

**Common causes:**

1. **Font rendering differences** - OS-dependent font rendering
2. **Anti-aliasing variations** - Browser rendering engine differences
3. **Canvas timing** - Canvas not fully rendered before screenshot
4. **Animation timing** - Screenshots taken during animation

**Solutions:**

1. Increase `maxDiffPixelRatio` tolerance
2. Add `page.waitForTimeout()` before screenshot
3. Create OS-specific baselines
4. Disable animations during tests

### Canvas Not Ready

If canvas screenshots are empty or incomplete:

```typescript
// Ensure canvas is ready
await appPage.waitForCanvasReady();
await appPage.page.waitForTimeout(500);
```

### Flaky Tests

For tests that occasionally fail:

1. Increase wait times before screenshots
2. Use `test.slow()` for complex scenarios
3. Check for asynchronous operations

## Best Practices

1. **Commit baseline images** - Always commit updated baselines with code changes
2. **Review diffs carefully** - Ensure only expected changes are present
3. **Keep tolerances low** - Start with strict tolerances, relax only if needed
4. **Document intentional changes** - Add comments explaining visual changes
5. **Test on multiple browsers** - Run visual tests across all target browsers

## Related Documentation

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Screenshot Best Practices](https://playwright.dev/docs/screenshots)
- [Task 9.4: Visual Regression Tests](../../docs/plan/tasks/phase9/9.4_visual-regression-tests.md)
