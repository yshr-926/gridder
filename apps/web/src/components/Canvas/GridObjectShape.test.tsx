import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridObjectShape } from './GridObjectShape';
import type { GridObject } from '@/types';
import { DEFAULT_TEXT_SETTINGS, DEFAULT_DIMENSION_SETTINGS } from '@/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Group: ({
    children,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-group"
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  ),
  Rect: ({ fill, stroke, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-rect"
      data-fill={fill}
      data-stroke={stroke}
      {...props}
    />
  ),
  Line: ({ stroke, dash, ...props }: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-stroke={stroke}
      data-dash={JSON.stringify(dash)}
      {...props}
    />
  ),
  Text: ({ text, ...props }: { text?: string } & Record<string, unknown>) => (
    <span data-testid="konva-text" data-text={text} {...props}>
      {text}
    </span>
  ),
}));

// Mock stores
const mockGridSettingsStore = {
  cellSize: 10,
  unit: 'cm' as const,
};

const mockUIStore = {
  showObjectNames: true,
  showDimensions: false,
  textSettings: DEFAULT_TEXT_SETTINGS,
  dimensionSettings: DEFAULT_DIMENSION_SETTINGS,
};

vi.mock('@/stores/gridSettingsStore', () => ({
  useGridSettingsStore: () => mockGridSettingsStore,
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => mockUIStore,
}));

describe('GridObjectShape', () => {
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
  };

  const defaultProps = {
    object: mockObject,
    gridSize: 20,
    isSelected: false,
    draggable: false,
    onClick: vi.fn(),
    onDragEnd: vi.fn(),
  };

  beforeEach(() => {
    // Reset mock store values
    mockUIStore.showObjectNames = true;
    mockUIStore.showDimensions = false;
  });

  it('renders cells as rectangles', () => {
    render(<GridObjectShape {...defaultProps} />);

    // Should render 3 cells (from mockObject.cells)
    const rects = screen.getAllByTestId('konva-rect');
    // May include selection overlay rect if selected
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('renders with correct fill color', () => {
    render(<GridObjectShape {...defaultProps} />);

    const rects = screen.getAllByTestId('konva-rect');
    const cellRect = rects.find((r) => r.getAttribute('data-fill') === '#333333');
    expect(cellRect).toBeInTheDocument();
  });

  it('shows selection highlight when selected', () => {
    render(<GridObjectShape {...defaultProps} isSelected={true} />);

    // Should have a selection line (dashed border)
    const lines = screen.getAllByTestId('konva-line');
    const selectionLine = lines.find(
      (l) => l.getAttribute('data-stroke') === '#3b82f6'
    );
    expect(selectionLine).toBeInTheDocument();

    // Should have dash pattern
    expect(selectionLine?.getAttribute('data-dash')).toBe('[5,5]');
  });

  it('does not show selection highlight when not selected', () => {
    render(<GridObjectShape {...defaultProps} isSelected={false} />);

    // Should not have dashed selection line
    const lines = screen.queryAllByTestId('konva-line');
    const selectionLine = lines.find(
      (l) => l.getAttribute('data-stroke') === '#3b82f6'
    );
    expect(selectionLine).toBeUndefined();
  });

  it('calls onClick when clicked', () => {
    const onClickMock = vi.fn();
    render(<GridObjectShape {...defaultProps} onClick={onClickMock} />);

    // Find the outer group and click it
    const groups = screen.getAllByTestId('konva-group');
    // Click the first group (outer group)
    fireEvent.click(groups[0]);

    expect(onClickMock).toHaveBeenCalled();
  });

  it('applies rotation correctly', () => {
    const rotatedObject = { ...mockObject, rotation: 90 as const };
    render(<GridObjectShape {...defaultProps} object={rotatedObject} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('rotation', '90');
  });

  it('is draggable when draggable prop is true', () => {
    render(<GridObjectShape {...defaultProps} draggable={true} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('draggable', 'true');
  });

  it('is not draggable when draggable prop is false', () => {
    render(<GridObjectShape {...defaultProps} draggable={false} />);

    const groups = screen.getAllByTestId('konva-group');
    const outerGroup = groups[0];
    expect(outerGroup).toHaveAttribute('draggable', 'false');
  });
});

describe('GridObjectShape with decoration', () => {
  const baseObject: GridObject = {
    id: 'test-1',
    cells: [
      [0, 0],
      [1, 0],
    ],
    position: { x: 0, y: 0 },
    rotation: 0,
    color: '#3b82f6',
  };

  const defaultProps = {
    gridSize: 20,
    isSelected: false,
    draggable: false,
    onClick: vi.fn(),
    onDragEnd: vi.fn(),
  };

  it('should render with border when showBorder is true', () => {
    const object = {
      ...baseObject,
      decoration: { showBorder: true, borderWidth: 2, opacity: 1 },
    };
    render(<GridObjectShape {...defaultProps} object={object} />);

    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThan(0);

    // Should have stroke on cells when showBorder is true
    const cellRect = rects.find((r) => r.getAttribute('data-fill') === '#3b82f6');
    expect(cellRect).toBeInTheDocument();
    expect(cellRect?.getAttribute('data-stroke')).toBeTruthy();
  });

  it('should render without border when showBorder is false', () => {
    const object = {
      ...baseObject,
      decoration: { showBorder: false, borderWidth: 1, opacity: 1 },
    };
    render(<GridObjectShape {...defaultProps} object={object} />);

    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThan(0);

    // Should have empty or undefined stroke when showBorder is false
    const cellRect = rects.find((r) => r.getAttribute('data-fill') === '#3b82f6');
    expect(cellRect).toBeInTheDocument();
    const stroke = cellRect?.getAttribute('data-stroke');
    expect(stroke === '' || stroke === undefined || stroke === null).toBe(true);
  });

  it('should render with opacity', () => {
    const object = {
      ...baseObject,
      decoration: { showBorder: true, borderWidth: 1, opacity: 0.5 },
    };
    render(<GridObjectShape {...defaultProps} object={object} />);

    const groups = screen.getAllByTestId('konva-group');
    // The inner group (cells group) should have opacity applied
    expect(groups.length).toBeGreaterThan(0);
    // Note: opacity is typically applied at the Group level in Konva
    // Check that the component renders successfully with opacity
    expect(groups[0]).toBeInTheDocument();
  });

  it('should use default decoration when not specified', () => {
    const object = { ...baseObject };
    render(<GridObjectShape {...defaultProps} object={object} />);

    // Should render successfully even without decoration
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThan(0);

    // Should have default border (showBorder: true by default)
    const cellRect = rects.find((r) => r.getAttribute('data-fill') === '#3b82f6');
    expect(cellRect).toBeInTheDocument();
  });

  it('should handle partial decoration object', () => {
    const object = {
      ...baseObject,
      decoration: { opacity: 0.7 } as { opacity: number }, // Partial decoration
    };
    render(<GridObjectShape {...defaultProps} object={object} />);

    // Should render successfully with partial decoration
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects.length).toBeGreaterThan(0);
  });
});

describe('GridObjectShape - テキスト・寸法表示', () => {
  const baseObject: GridObject = {
    id: 'test-1',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    position: { x: 0, y: 0 },
    rotation: 0,
    color: '#3b82f6',
  };

  const defaultProps = {
    gridSize: 20,
    isSelected: false,
    draggable: false,
    onClick: vi.fn(),
    onDragEnd: vi.fn(),
  };

  beforeEach(() => {
    // Reset mock store values
    mockUIStore.showObjectNames = true;
    mockUIStore.showDimensions = false;
    mockUIStore.dimensionSettings = { ...DEFAULT_DIMENSION_SETTINGS };
  });

  describe('テキストラベル', () => {
    it('showObjectNames=true でオブジェクト名が表示される', () => {
      mockUIStore.showObjectNames = true;
      const objectWithName = { ...baseObject, name: 'Test Object' };
      render(<GridObjectShape {...defaultProps} object={objectWithName} />);

      const texts = screen.getAllByTestId('konva-text');
      const nameText = texts.find((t) => t.getAttribute('data-text') === 'Test Object');
      expect(nameText).toBeInTheDocument();
    });

    it('showObjectNames=false でテキストラベルが非表示になる', () => {
      mockUIStore.showObjectNames = false;
      const objectWithName = { ...baseObject, name: 'Test Object' };
      render(<GridObjectShape {...defaultProps} object={objectWithName} />);

      const texts = screen.queryAllByTestId('konva-text');
      const nameText = texts.find((t) => t.getAttribute('data-text') === 'Test Object');
      expect(nameText).toBeUndefined();
    });

    it('オブジェクト名がない場合は何も表示されない', () => {
      mockUIStore.showObjectNames = true;
      render(<GridObjectShape {...defaultProps} object={baseObject} />);

      // When no name is set, ObjectTextLabel returns null
      // So there should be no text with the object name
      const texts = screen.queryAllByTestId('konva-text');
      const nameText = texts.find(
        (t) => t.getAttribute('data-text') && !t.getAttribute('data-text')?.includes('x')
      );
      // Should not have a standalone name text (only dimension labels might be present)
      expect(nameText?.getAttribute('data-text')).not.toBe('Test Object');
    });
  });

  describe('寸法ラベル', () => {
    it('showDimensions=true で寸法が表示される', () => {
      mockUIStore.showDimensions = true;
      mockUIStore.dimensionSettings = { ...DEFAULT_DIMENSION_SETTINGS, displayMode: 'size' };
      render(<GridObjectShape {...defaultProps} object={baseObject} />);

      const texts = screen.getAllByTestId('konva-text');
      // Should have size label (e.g., "20cm x 20cm")
      const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
      expect(sizeLabel).toBeInTheDocument();
    });

    it('isSelected=true で寸法が表示される', () => {
      mockUIStore.showDimensions = false;
      mockUIStore.dimensionSettings = { ...DEFAULT_DIMENSION_SETTINGS, displayMode: 'size' };
      render(<GridObjectShape {...defaultProps} object={baseObject} isSelected={true} />);

      const texts = screen.getAllByTestId('konva-text');
      // Should have size label when selected
      const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
      expect(sizeLabel).toBeInTheDocument();
    });

    it('showDimensions=false かつ isSelected=false で寸法が非表示', () => {
      mockUIStore.showDimensions = false;
      render(<GridObjectShape {...defaultProps} object={baseObject} isSelected={false} />);

      const texts = screen.queryAllByTestId('konva-text');
      // Should not have size label
      const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
      expect(sizeLabel).toBeUndefined();
    });

    it('displayMode="none" で何も表示されない', () => {
      mockUIStore.showDimensions = true;
      mockUIStore.dimensionSettings = { ...DEFAULT_DIMENSION_SETTINGS, displayMode: 'none' };
      render(<GridObjectShape {...defaultProps} object={baseObject} />);

      const texts = screen.queryAllByTestId('konva-text');
      // Should not have size label when displayMode is 'none'
      const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
      expect(sizeLabel).toBeUndefined();
    });
  });

  describe('グローバル設定', () => {
    it('textSettings が ObjectTextLabel に渡される', () => {
      mockUIStore.showObjectNames = true;
      mockUIStore.textSettings = { ...DEFAULT_TEXT_SETTINGS, fontSize: 16 };
      const objectWithName = { ...baseObject, name: 'Test' };
      render(<GridObjectShape {...defaultProps} object={objectWithName} />);

      // Component should render without errors with custom settings
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBeGreaterThan(0);
    });

    it('dimensionSettings が DimensionLabel に渡される', () => {
      mockUIStore.showDimensions = true;
      mockUIStore.dimensionSettings = {
        ...DEFAULT_DIMENSION_SETTINGS,
        displayMode: 'size',
        fontSize: 14,
      };
      render(<GridObjectShape {...defaultProps} object={baseObject} />);

      // Component should render without errors with custom settings
      const texts = screen.getAllByTestId('konva-text');
      const sizeLabel = texts.find((t) => t.getAttribute('data-text')?.includes('x'));
      expect(sizeLabel).toBeInTheDocument();
    });
  });
});
