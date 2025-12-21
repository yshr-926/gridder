/**
 * PolygonHelp コンポーネントのテスト
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PolygonHelp } from './PolygonHelp';

describe('PolygonHelp', () => {
  describe('頂点数が0の場合', () => {
    it('頂点配置のガイダンスを表示する', () => {
      render(<PolygonHelp vertexCount={0} canClose={false} />);

      expect(screen.getByText('クリックで頂点を配置してください')).toBeInTheDocument();
    });

    it('閉じるためのガイダンスを表示しない', () => {
      render(<PolygonHelp vertexCount={0} canClose={false} />);

      expect(screen.queryByText(/最初の頂点をクリック/)).not.toBeInTheDocument();
    });
  });

  describe('頂点数が1の場合', () => {
    it('最低3頂点必要のメッセージを表示する', () => {
      render(<PolygonHelp vertexCount={1} canClose={false} />);

      expect(screen.getByText('頂点: 1 / 最低3つの頂点が必要です')).toBeInTheDocument();
    });
  });

  describe('頂点数が2の場合', () => {
    it('最低3頂点必要のメッセージを表示する', () => {
      render(<PolygonHelp vertexCount={2} canClose={false} />);

      expect(screen.getByText('頂点: 2 / 最低3つの頂点が必要です')).toBeInTheDocument();
    });
  });

  describe('頂点数が3以上の場合（canClose=true）', () => {
    it('頂点数を表示する', () => {
      render(<PolygonHelp vertexCount={3} canClose={true} />);

      expect(screen.getByText('頂点: 3')).toBeInTheDocument();
    });

    it('閉じるためのガイダンスを表示する', () => {
      render(<PolygonHelp vertexCount={3} canClose={true} />);

      expect(
        screen.getByText('最初の頂点をクリックして完成 / Enter')
      ).toBeInTheDocument();
    });

    it('頂点数が5の場合も正しく表示する', () => {
      render(<PolygonHelp vertexCount={5} canClose={true} />);

      expect(screen.getByText('頂点: 5')).toBeInTheDocument();
    });
  });

  describe('キーボードショートカットのヘルプ', () => {
    it('Backspace ショートカットを表示する', () => {
      render(<PolygonHelp vertexCount={0} canClose={false} />);

      expect(screen.getByText('Backspace: 最後の頂点を削除')).toBeInTheDocument();
    });

    it('Escape ショートカットを表示する', () => {
      render(<PolygonHelp vertexCount={0} canClose={false} />);

      expect(screen.getByText('Escape: キャンセル')).toBeInTheDocument();
    });

    it('頂点数に関わらずショートカットを表示する', () => {
      render(<PolygonHelp vertexCount={5} canClose={true} />);

      expect(screen.getByText('Backspace: 最後の頂点を削除')).toBeInTheDocument();
      expect(screen.getByText('Escape: キャンセル')).toBeInTheDocument();
    });
  });

  describe('スタイリング', () => {
    it('ルートコンテナが absolute positioning を持つ', () => {
      const { container } = render(<PolygonHelp vertexCount={0} canClose={false} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('absolute');
    });

    it('ルートコンテナが中央寄せされている', () => {
      const { container } = render(<PolygonHelp vertexCount={0} canClose={false} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('left-1/2');
      expect(rootDiv).toHaveClass('-translate-x-1/2');
    });

    it('背景色が暗い色である', () => {
      const { container } = render(<PolygonHelp vertexCount={0} canClose={false} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('bg-gray-900');
    });

    it('テキスト色が白である', () => {
      const { container } = render(<PolygonHelp vertexCount={0} canClose={false} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('text-white');
    });
  });
});
