/**
 * ポリゴン描画フック
 *
 * 頂点をクリックで配置し、閉じた多角形を塗りつぶす機能を提供します。
 */

import { useState, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { fillPolygon, getPolygonOutline } from './fillPolygon';
import type { FillPolygonResult, Vertex } from './types';
import { generateId } from '@/utils/id';
import { getNextObjectColor } from '@/utils/colorPalette';
import type { CellCoordinate, GridObject } from '@/types';

/**
 * ポリゴン描画フックの戻り値型
 */
export interface UsePolygonDrawingReturn {
  /** 配置済みの頂点配列 */
  vertices: Vertex[];
  /** 描画中かどうか（1つ以上の頂点がある） */
  isDrawing: boolean;
  /** ポリゴンを閉じられるか（3頂点以上） */
  canClose: boolean;

  /**
   * 頂点を追加
   * @param x - X座標（グリッド単位）
   * @param y - Y座標（グリッド単位）
   */
  addVertex: (x: number, y: number) => void;

  /**
   * 最後の頂点を削除（Undo機能）
   */
  removeLastVertex: () => void;

  /**
   * ポリゴンを完成させてオブジェクトを作成
   * @param filled - true: 塗りつぶし, false: 輪郭線のみ
   * @returns 作成されたオブジェクト、または失敗時は null
   */
  completePolygon: (filled?: boolean) => GridObject | null;

  /**
   * ポリゴン描画をキャンセル
   */
  cancel: () => void;

  /**
   * プレビュー用のセル座標を取得（グリッド座標）
   * @param cursorPosition - 現在のカーソル位置
   * @returns プレビュー用のセル座標配列
   */
  previewCells: (cursorPosition: Vertex | null) => CellCoordinate[];
}

/**
 * ポリゴン描画フック
 *
 * 頂点をクリックで配置し、多角形を作成するための機能を提供します。
 * 3つ以上の頂点が配置されると、閉じた多角形として塗りつぶしが可能になります。
 *
 * @returns ポリゴン描画に関する状態と操作
 *
 * @example
 * ```tsx
 * const { vertices, addVertex, completePolygon, cancel } = usePolygonDrawing();
 *
 * // 頂点を追加
 * addVertex(0, 0);
 * addVertex(4, 0);
 * addVertex(2, 3);
 *
 * // 塗りつぶしモードでポリゴンを完成
 * const obj = completePolygon(true);
 * ```
 */
export const usePolygonDrawing = (): UsePolygonDrawingReturn => {
  const [vertices, setVertices] = useState<Vertex[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const addObject = useCanvasStore((state) => state.addObject);
  const defaultDecoration = useCanvasStore((state) => state.defaultDecoration);

  /**
   * 頂点を追加
   */
  const addVertex = useCallback((x: number, y: number) => {
    setVertices((prev) => [...prev, { x, y }]);
    setIsDrawing(true);
  }, []);

  /**
   * 最後の頂点を削除（Undo）
   */
  const removeLastVertex = useCallback(() => {
    setVertices((prev) => {
      const newVertices = prev.slice(0, -1);
      if (newVertices.length === 0) {
        setIsDrawing(false);
      }
      return newVertices;
    });
  }, []);

  /**
   * ポリゴンを完成させる
   */
  const completePolygon = useCallback(
    (filled: boolean = true): GridObject | null => {
      if (vertices.length < 3) {
        return null;
      }

      // 塗りつぶしまたは輪郭線を取得
      const result: FillPolygonResult = filled
        ? fillPolygon(vertices)
        : getPolygonOutline(vertices);

      if (result.cells.length === 0) {
        return null;
      }

      // 新しいオブジェクトを作成
      const newObject: GridObject = {
        id: generateId('obj'),
        cells: result.cells,
        position: result.position,
        rotation: 0,
        color: getNextObjectColor(),
        decoration: { ...defaultDecoration },
      };

      addObject(newObject);

      // 状態をリセット
      setVertices([]);
      setIsDrawing(false);

      return newObject;
    },
    [vertices, addObject, defaultDecoration]
  );

  /**
   * キャンセル
   */
  const cancel = useCallback(() => {
    setVertices([]);
    setIsDrawing(false);
  }, []);

  /**
   * ポリゴンを閉じられるか（3頂点以上）
   */
  const canClose = vertices.length >= 3;

  /**
   * プレビュー用のセル（グリッド座標）
   *
   * カーソル位置を含めた仮の輪郭線を計算し、
   * グリッド座標に変換して返します。
   */
  const previewCells = useCallback(
    (cursorPosition: Vertex | null): CellCoordinate[] => {
      if (vertices.length < 1 || !cursorPosition) return [];

      // 頂点が1つの場合は、頂点からカーソルへの線を表示
      if (vertices.length === 1) {
        const result = getPolygonOutline([vertices[0], cursorPosition]);
        return result.cells.map(([x, y]) => [
          x + result.position.x,
          y + result.position.y,
        ]);
      }

      // 頂点が2つ以上の場合は、カーソルを含めた閉じた形状を表示
      const tempVertices = [...vertices, cursorPosition];
      const result = getPolygonOutline(tempVertices);

      // プレビュー用にグリッド座標に戻す（position を加算）
      return result.cells.map(([x, y]) => [
        x + result.position.x,
        y + result.position.y,
      ]);
    },
    [vertices]
  );

  return {
    // 状態
    vertices,
    isDrawing,
    canClose,

    // 操作
    addVertex,
    removeLastVertex,
    completePolygon,
    cancel,

    // プレビュー
    previewCells,
  };
};
