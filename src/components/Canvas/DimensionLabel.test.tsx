import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DimensionLabel, EdgeDimensionLabels } from './DimensionLabel';
import type { GridObject, DimensionSettings } from '@/types';
import { DEFAULT_DIMENSION_SETTINGS } from '@/types';
import type { EdgeInfo } from '@/utils/dimension';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="konva-group">{children}</div>
  ),
  Text: ({
    text,
    fontSize,
    fill,
    x,
    y,
    ...props
  }: {
    text?: string;
    fontSize?: number;
    fill?: string;
    x?: number;
    y?: number;
  } & Record<string, unknown>) => (
    <span
      data-testid="konva-text"
      data-text={text}
      data-fontsize={fontSize}
      data-fill={fill}
      data-x={x}
      data-y={y}
      {...props}
    >
      {text}
    </span>
  ),
  Line: ({
    points,
    stroke,
    strokeWidth,
    ...props
  }: {
    points?: number[];
    stroke?: string;
    strokeWidth?: number;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-strokewidth={strokeWidth}
      {...props}
    />
  ),
}));

describe('DimensionLabel', () => {
  const mockObject: GridObject = {
    id: 'test-obj-1',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    position: { x: 0, y: 0 },
    rotation: 0,
    color: '#333333',
  };

  const defaultSettings: DimensionSettings = {
    ...DEFAULT_DIMENSION_SETTINGS,
    displayMode: 'size',
  };

  const defaultProps = {
    object: mockObject,
    gridSize: 20,
    cellSize: 10, // 10cm per cell
    unit: 'cm' as const,
    settings: defaultSettings,
  };

  it('displayMode="none" で何も表示されない', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'none',
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const texts = screen.queryAllByTestId('konva-text');
    expect(texts.length).toBe(0);
  });

  it('displayMode="size" でサイズラベルが表示される', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'size',
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const texts = screen.getAllByTestId('konva-text');
    expect(texts.length).toBeGreaterThan(0);

    // Should show size label (e.g., "20cm x 20cm")
    const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
    expect(sizeLabel).toBeInTheDocument();
    expect(sizeLabel?.getAttribute('data-text')).toBe('20cm x 20cm');
  });

  it('displayMode="edges" で辺ラベルが表示される', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'edges',
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const texts = screen.getAllByTestId('konva-text');
    // For a 2x2 square, we have 4 edges, each showing their length
    expect(texts.length).toBe(4);
  });

  it('displayMode="both" で両方が表示される', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'both',
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const texts = screen.getAllByTestId('konva-text');
    // Size label + edge labels
    expect(texts.length).toBeGreaterThan(1);

    // Should have size label
    const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
    expect(sizeLabel).toBeInTheDocument();
  });

  it('寸法線の表示がオンの場合に表示される', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'size',
      showDimensionLines: true,
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const lines = screen.getAllByTestId('konva-line');
    // Width line and height line
    expect(lines.length).toBe(2);
  });

  it('寸法線の表示がオフの場合に非表示', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'size',
      showDimensionLines: false,
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const lines = screen.queryAllByTestId('konva-line');
    expect(lines.length).toBe(0);
  });

  it('フォントサイズが設定に従って変わる', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'size',
      fontSize: 14,
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-fontsize')).toBe('14');
  });

  it('テキスト色が設定に従って変わる', () => {
    const settings: DimensionSettings = {
      ...defaultSettings,
      displayMode: 'size',
      textColor: '#ff0000',
    };
    render(<DimensionLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-fill')).toBe('#ff0000');
  });

  it('単位がcm以外でも正しく表示される（m）', () => {
    render(<DimensionLabel {...defaultProps} unit="m" />);

    const texts = screen.getAllByTestId('konva-text');
    const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
    expect(sizeLabel?.getAttribute('data-text')).toBe('20m x 20m');
  });

  it('単位がcm以外でも正しく表示される（mm）', () => {
    render(<DimensionLabel {...defaultProps} unit="mm" />);

    const texts = screen.getAllByTestId('konva-text');
    const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
    expect(sizeLabel?.getAttribute('data-text')).toBe('20mm x 20mm');
  });

  it('デフォルト設定が正しく適用される', () => {
    render(
      <DimensionLabel
        {...defaultProps}
        settings={{} as DimensionSettings}
      />
    );

    const texts = screen.getAllByTestId('konva-text');
    expect(texts.length).toBeGreaterThan(0);

    // Default fontSize is 10
    const text = texts[0];
    expect(text.getAttribute('data-fontsize')).toBe('10');
    // Default textColor is #6b7280
    expect(text.getAttribute('data-fill')).toBe('#6b7280');
  });
});

describe('EdgeDimensionLabels', () => {
  const mockEdges: EdgeInfo[] = [
    {
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 },
      lengthCells: 2,
      lengthReal: 20,
      direction: 'horizontal',
    },
    {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 2 },
      lengthCells: 2,
      lengthReal: 20,
      direction: 'vertical',
    },
  ];

  const defaultProps = {
    edges: mockEdges,
    gridSize: 20,
    fontSize: 10,
    textColor: '#6b7280',
  };

  it('各辺のラベルが表示される', () => {
    render(<EdgeDimensionLabels {...defaultProps} />);

    const texts = screen.getAllByTestId('konva-text');
    expect(texts.length).toBe(2);
  });

  it('水平辺と垂直辺の両方のラベルが表示される', () => {
    render(<EdgeDimensionLabels {...defaultProps} />);

    const texts = screen.getAllByTestId('konva-text');
    texts.forEach((text) => {
      expect(text.getAttribute('data-text')).toBe('20');
    });
  });

  it('空の辺配列で何も表示されない', () => {
    render(<EdgeDimensionLabels {...defaultProps} edges={[]} />);

    const texts = screen.queryAllByTestId('konva-text');
    expect(texts.length).toBe(0);
  });

  it('フォントサイズが適用される', () => {
    render(<EdgeDimensionLabels {...defaultProps} fontSize={14} />);

    const texts = screen.getAllByTestId('konva-text');
    texts.forEach((text) => {
      expect(text.getAttribute('data-fontsize')).toBe('14');
    });
  });

  it('テキスト色が適用される', () => {
    render(<EdgeDimensionLabels {...defaultProps} textColor="#ff0000" />);

    const texts = screen.getAllByTestId('konva-text');
    texts.forEach((text) => {
      expect(text.getAttribute('data-fill')).toBe('#ff0000');
    });
  });
});
