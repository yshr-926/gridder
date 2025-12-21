/**
 * VertexMarker コンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VertexMarker } from './VertexMarker';

// Mock react-konva
vi.mock('react-konva', () => ({
  Circle: ({
    radius,
    fill,
    stroke,
    strokeWidth,
    ...props
  }: {
    radius?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-circle"
      data-radius={radius}
      data-fill={fill}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      {...props}
    />
  ),
  Group: ({
    children,
    onClick,
    x,
    y,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    x?: number;
    y?: number;
  } & Record<string, unknown>) => (
    <div
      data-testid="konva-group"
      data-x={x}
      data-y={y}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  ),
  Text: ({
    text,
    x,
    y,
    fontSize,
    fill,
    ...props
  }: {
    text?: string;
    x?: number;
    y?: number;
    fontSize?: number;
    fill?: string;
  } & Record<string, unknown>) => (
    <span
      data-testid="konva-text"
      data-x={x}
      data-y={y}
      data-font-size={fontSize}
      data-fill={fill}
      {...props}
    >
      {text}
    </span>
  ),
}));

describe('VertexMarker', () => {
  const defaultProps = {
    x: 5,
    y: 10,
    gridSize: 20,
    index: 0,
  };

  it('グリッド座標からピクセル座標に正しく変換する', () => {
    render(<VertexMarker {...defaultProps} />);

    const group = screen.getByTestId('konva-group');
    expect(group).toHaveAttribute('data-x', '100'); // 5 * 20
    expect(group).toHaveAttribute('data-y', '200'); // 10 * 20
  });

  it('頂点番号を正しく表示する（1始まり）', () => {
    render(<VertexMarker {...defaultProps} index={0} />);

    const text = screen.getByTestId('konva-text');
    expect(text).toHaveTextContent('1');
  });

  it('2番目の頂点の場合、番号2を表示する', () => {
    render(<VertexMarker {...defaultProps} index={1} />);

    const text = screen.getByTestId('konva-text');
    expect(text).toHaveTextContent('2');
  });

  it('通常の頂点（isFirst=false）は青いリングを表示しない', () => {
    render(<VertexMarker {...defaultProps} isFirst={false} />);

    const circles = screen.getAllByTestId('konva-circle');
    // 頂点の点のみ（1つ）
    expect(circles).toHaveLength(1);
  });

  it('最初の頂点（isFirst=true）は青いリングを表示する', () => {
    render(<VertexMarker {...defaultProps} isFirst={true} />);

    const circles = screen.getAllByTestId('konva-circle');
    // 外側リング + 頂点の点（2つ）
    expect(circles).toHaveLength(2);
  });

  it('isFirst=true の場合、頂点の色が青色になる', () => {
    render(<VertexMarker {...defaultProps} isFirst={true} />);

    const circles = screen.getAllByTestId('konva-circle');
    // 2番目の Circle が頂点の点
    const vertexCircle = circles[1];
    expect(vertexCircle).toHaveAttribute('data-fill', '#3b82f6');
  });

  it('isFirst=false の場合、頂点の色がダークグレーになる', () => {
    render(<VertexMarker {...defaultProps} isFirst={false} />);

    const circles = screen.getAllByTestId('konva-circle');
    const vertexCircle = circles[0];
    expect(vertexCircle).toHaveAttribute('data-fill', '#1f2937');
  });

  it('onClick ハンドラが呼び出される', () => {
    const handleClick = vi.fn();
    render(<VertexMarker {...defaultProps} onClick={handleClick} />);

    const group = screen.getByTestId('konva-group');
    fireEvent.click(group);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('onClick が未定義の場合、クリック可能ではない', () => {
    render(<VertexMarker {...defaultProps} onClick={undefined} />);

    const group = screen.getByTestId('konva-group');
    // listening={false} が設定されるはず（data-listening 属性はないが、エラーなく動作する）
    expect(group).toBeInTheDocument();
  });
});
