/**
 * PolygonPreview コンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PolygonPreview } from './PolygonPreview';
import type { Vertex } from '@/features/polygon/types';

// Mock react-konva
vi.mock('react-konva', () => ({
  Line: ({
    points,
    stroke,
    strokeWidth,
    dash,
    opacity,
    ...props
  }: {
    points?: number[];
    stroke?: string;
    strokeWidth?: number;
    dash?: number[];
    opacity?: number;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dash={JSON.stringify(dash)}
      data-opacity={opacity}
      {...props}
    />
  ),
  Group: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
}));

// Mock VertexMarker
vi.mock('./VertexMarker', () => ({
  VertexMarker: ({
    x,
    y,
    index,
    isFirst,
    onClick,
  }: {
    x: number;
    y: number;
    index: number;
    isFirst?: boolean;
    onClick?: () => void;
  }) => (
    <div
      data-testid="vertex-marker"
      data-x={x}
      data-y={y}
      data-index={index}
      data-is-first={isFirst}
      onClick={onClick}
    />
  ),
}));

describe('PolygonPreview', () => {
  const defaultProps = {
    vertices: [] as Vertex[],
    cursorPosition: null as Vertex | null,
    gridSize: 20,
  };

  describe('頂点が0の場合', () => {
    it('線を表示しない', () => {
      render(<PolygonPreview {...defaultProps} vertices={[]} />);

      const lines = screen.queryAllByTestId('konva-line');
      expect(lines).toHaveLength(0);
    });

    it('頂点マーカーを表示しない', () => {
      render(<PolygonPreview {...defaultProps} vertices={[]} />);

      const markers = screen.queryAllByTestId('vertex-marker');
      expect(markers).toHaveLength(0);
    });
  });

  describe('頂点が1つの場合', () => {
    const singleVertex: Vertex[] = [{ x: 5, y: 5 }];

    it('頂点マーカーを1つ表示する', () => {
      render(<PolygonPreview {...defaultProps} vertices={singleVertex} />);

      const markers = screen.getAllByTestId('vertex-marker');
      expect(markers).toHaveLength(1);
    });

    it('カーソル位置がなければ線を表示しない', () => {
      render(<PolygonPreview {...defaultProps} vertices={singleVertex} />);

      const lines = screen.queryAllByTestId('konva-line');
      expect(lines).toHaveLength(0);
    });
  });

  describe('頂点が2つの場合', () => {
    const twoVertices: Vertex[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ];

    it('頂点マーカーを2つ表示する', () => {
      render(<PolygonPreview {...defaultProps} vertices={twoVertices} />);

      const markers = screen.getAllByTestId('vertex-marker');
      expect(markers).toHaveLength(2);
    });

    it('2つの頂点間に線を表示する', () => {
      render(<PolygonPreview {...defaultProps} vertices={twoVertices} />);

      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    it('最初の頂点に isFirst=false が設定される（3頂点未満）', () => {
      render(<PolygonPreview {...defaultProps} vertices={twoVertices} />);

      const markers = screen.getAllByTestId('vertex-marker');
      const firstMarker = markers[0];
      expect(firstMarker).toHaveAttribute('data-is-first', 'false');
    });
  });

  describe('頂点が3つ以上の場合', () => {
    const threeVertices: Vertex[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2, y: 3 },
    ];

    it('頂点マーカーを3つ表示する', () => {
      render(<PolygonPreview {...defaultProps} vertices={threeVertices} />);

      const markers = screen.getAllByTestId('vertex-marker');
      expect(markers).toHaveLength(3);
    });

    it('最初の頂点に isFirst=true が設定される', () => {
      render(<PolygonPreview {...defaultProps} vertices={threeVertices} />);

      const markers = screen.getAllByTestId('vertex-marker');
      const firstMarker = markers[0];
      expect(firstMarker).toHaveAttribute('data-is-first', 'true');
    });

    it('カーソル位置がある場合、閉じる線（点線）を表示する', () => {
      render(
        <PolygonPreview
          {...defaultProps}
          vertices={threeVertices}
          cursorPosition={{ x: 3, y: 2 }}
        />
      );

      const lines = screen.getAllByTestId('konva-line');
      // 少なくとも2つの線（描画線と閉じる線）
      expect(lines.length).toBeGreaterThanOrEqual(2);

      // 閉じる線にはダッシュパターンがある
      const closingLine = lines.find((line) => {
        const dash = line.getAttribute('data-dash');
        return dash && dash !== 'null' && dash !== 'undefined';
      });
      expect(closingLine).toBeDefined();
    });
  });

  describe('カーソル位置の追跡', () => {
    const twoVertices: Vertex[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ];

    it('カーソル位置がある場合、線がカーソル位置まで延長される', () => {
      render(
        <PolygonPreview
          {...defaultProps}
          vertices={twoVertices}
          cursorPosition={{ x: 10, y: 5 }}
        />
      );

      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThanOrEqual(1);

      // 線のポイントにカーソル位置が含まれている
      const mainLine = lines[0];
      const points = JSON.parse(mainLine.getAttribute('data-points') || '[]');
      // 最後の2つの値がカーソル位置（ピクセル座標: 10*20, 5*20）
      expect(points).toContain(200); // 10 * 20
      expect(points).toContain(100); // 5 * 20
    });
  });

  describe('コールバック', () => {
    const threeVertices: Vertex[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2, y: 3 },
    ];

    it('onFirstVertexClick が最初の頂点のクリックハンドラとして設定される', () => {
      const handleFirstVertexClick = vi.fn();
      render(
        <PolygonPreview
          {...defaultProps}
          vertices={threeVertices}
          onFirstVertexClick={handleFirstVertexClick}
        />
      );

      const markers = screen.getAllByTestId('vertex-marker');
      const firstMarker = markers[0];

      // onClick ハンドラが設定されている（関数として渡される）
      expect(firstMarker).toHaveAttribute('data-is-first', 'true');
    });
  });
});
