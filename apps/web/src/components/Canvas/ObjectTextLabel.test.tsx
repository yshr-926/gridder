import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectTextLabel } from './ObjectTextLabel';
import type { GridObject, ObjectTextSettings } from '@/types';
import { DEFAULT_TEXT_SETTINGS } from '@/types';

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
}));

describe('ObjectTextLabel', () => {
  const mockObject: GridObject = {
    id: 'test-obj-1',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    position: { x: 5, y: 5 },
    rotation: 0,
    color: '#333333',
    name: 'Test Object',
  };

  const defaultSettings: ObjectTextSettings = {
    ...DEFAULT_TEXT_SETTINGS,
  };

  const defaultProps = {
    object: mockObject,
    gridSize: 20,
    settings: defaultSettings,
  };

  it('オブジェクト名が表示される', () => {
    render(<ObjectTextLabel {...defaultProps} />);

    const text = screen.getByTestId('konva-text');
    expect(text).toBeInTheDocument();
    expect(text.getAttribute('data-text')).toBe('Test Object');
  });

  it('名前がない場合は何も表示されない', () => {
    const objectWithoutName = { ...mockObject, name: undefined };
    render(<ObjectTextLabel {...defaultProps} object={objectWithoutName} />);

    const text = screen.queryByTestId('konva-text');
    expect(text).not.toBeInTheDocument();
  });

  it('空文字列の名前の場合は何も表示されない', () => {
    const objectWithEmptyName = { ...mockObject, name: '' };
    render(<ObjectTextLabel {...defaultProps} object={objectWithEmptyName} />);

    const text = screen.queryByTestId('konva-text');
    expect(text).not.toBeInTheDocument();
  });

  it('テキスト位置（center）が正しく反映される', () => {
    const settings: ObjectTextSettings = {
      ...defaultSettings,
      textPosition: 'center',
    };
    render(<ObjectTextLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    // center position: centerX = (minX + width/2) * gridSize = (0 + 1) * 20 = 20
    // centerY = (minY + height/2) * gridSize = (0 + 1) * 20 = 20
    const x = parseFloat(text.getAttribute('data-x') || '0');
    const y = parseFloat(text.getAttribute('data-y') || '0');
    expect(x).toBe(20); // Center X
    expect(y).toBe(20); // Center Y
  });

  it('テキスト位置（top）が正しく反映される', () => {
    const settings: ObjectTextSettings = {
      ...defaultSettings,
      textPosition: 'top',
      fontSize: 12,
    };
    render(<ObjectTextLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    // top position: y = minY * gridSize - fontSize - 4 = 0 * 20 - 12 - 4 = -16
    const y = parseFloat(text.getAttribute('data-y') || '0');
    expect(y).toBe(-16);
  });

  it('テキスト位置（bottom）が正しく反映される', () => {
    const settings: ObjectTextSettings = {
      ...defaultSettings,
      textPosition: 'bottom',
    };
    render(<ObjectTextLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    // bottom position: y = (maxY + 1) * gridSize + 4 = (1 + 1) * 20 + 4 = 44
    const y = parseFloat(text.getAttribute('data-y') || '0');
    expect(y).toBe(44);
  });

  it('テキスト位置（inside）がcenterと同じになる', () => {
    const settingsInside: ObjectTextSettings = {
      ...defaultSettings,
      textPosition: 'inside',
    };
    const settingsCenter: ObjectTextSettings = {
      ...defaultSettings,
      textPosition: 'center',
    };

    const { rerender } = render(
      <ObjectTextLabel {...defaultProps} settings={settingsInside} />
    );
    const textInside = screen.getByTestId('konva-text');
    const insideX = textInside.getAttribute('data-x');
    const insideY = textInside.getAttribute('data-y');

    rerender(<ObjectTextLabel {...defaultProps} settings={settingsCenter} />);
    const textCenter = screen.getByTestId('konva-text');
    const centerX = textCenter.getAttribute('data-x');
    const centerY = textCenter.getAttribute('data-y');

    expect(insideX).toBe(centerX);
    expect(insideY).toBe(centerY);
  });

  it('グローバル設定（fontSize）が適用される', () => {
    const settings: ObjectTextSettings = {
      ...defaultSettings,
      fontSize: 16,
    };
    render(<ObjectTextLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-fontsize')).toBe('16');
  });

  it('グローバル設定（textColor）が適用される', () => {
    const settings: ObjectTextSettings = {
      ...defaultSettings,
      textColor: '#ff0000',
    };
    render(<ObjectTextLabel {...defaultProps} settings={settings} />);

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-fill')).toBe('#ff0000');
  });

  it('デフォルト設定が正しく適用される', () => {
    render(<ObjectTextLabel {...defaultProps} settings={{} as ObjectTextSettings} />);

    const text = screen.getByTestId('konva-text');
    // Default fontSize is 12
    expect(text.getAttribute('data-fontsize')).toBe('12');
    // Default textColor is #1f2937
    expect(text.getAttribute('data-fill')).toBe('#1f2937');
  });

  it('日本語の名前が表示される', () => {
    const japaneseObject = { ...mockObject, name: 'テーブル' };
    render(<ObjectTextLabel {...defaultProps} object={japaneseObject} />);

    const text = screen.getByTestId('konva-text');
    expect(text.getAttribute('data-text')).toBe('テーブル');
  });
});
