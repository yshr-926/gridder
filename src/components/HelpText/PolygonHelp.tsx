/**
 * PolygonHelp コンポーネント
 *
 * ポリゴン描画モード時に操作方法を表示するヘルプテキスト。
 * 頂点数に応じて適切なガイダンスを表示する。
 */

import { memo } from 'react';

/**
 * PolygonHelp Props
 */
interface PolygonHelpProps {
  /** 配置済みの頂点数 */
  vertexCount: number;
  /** ポリゴンを閉じられるか（3頂点以上） */
  canClose: boolean;
}

/**
 * ポリゴン描画ヘルプコンポーネント
 *
 * 画面上部に表示される操作ガイド。
 * 頂点数に応じて異なるメッセージを表示する。
 */
export const PolygonHelp = memo(({ vertexCount, canClose }: PolygonHelpProps) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded shadow-lg z-10">
      <div className="text-sm font-mono">
        {/* 頂点が0の場合 */}
        {vertexCount === 0 && (
          <p>クリックで頂点を配置してください</p>
        )}

        {/* 頂点が1-2の場合 */}
        {vertexCount > 0 && vertexCount < 3 && (
          <p>
            頂点: {vertexCount} / 最低3つの頂点が必要です
          </p>
        )}

        {/* 頂点が3以上の場合（閉じられる） */}
        {canClose && (
          <div>
            <p>頂点: {vertexCount}</p>
            <p className="text-blue-400">
              最初の頂点をクリックして完成 / Enter
            </p>
          </div>
        )}

        {/* キーボードショートカット */}
        <div className="mt-2 text-xs text-gray-400">
          <p>Backspace: 最後の頂点を削除</p>
          <p>Escape: キャンセル</p>
        </div>
      </div>
    </div>
  );
});

PolygonHelp.displayName = 'PolygonHelp';
