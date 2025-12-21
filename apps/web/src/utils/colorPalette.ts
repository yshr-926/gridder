/**
 * オブジェクトカラーパレット定義
 * 新規オブジェクト作成時に自動で異なる色を割り当てるための機能
 */

/**
 * 12色のカラーパレット（Tailwind CSS 500系の色）
 */
export const OBJECT_COLOR_PALETTE = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#84cc16', // lime-500
  '#0ea5e9', // sky-500
] as const;

/**
 * カラーパレットの色の型
 */
export type ObjectColor = (typeof OBJECT_COLOR_PALETTE)[number];

/**
 * 色がパレット内の色かどうかを判定する型ガード
 */
export const isPaletteColor = (color: string): color is ObjectColor => {
  return (OBJECT_COLOR_PALETTE as readonly string[]).includes(color);
};

/**
 * 使用済みの色を追跡し、次に使用すべき色を決定するクラス
 */
export class ColorPaletteManager {
  private usedColors: Map<string, number> = new Map();

  /**
   * 次に使用すべき色を取得（最も使用回数の少ない色）
   * 使用回数が同じ場合はパレット内で先に定義された色を優先
   */
  getNextColor(): string {
    let minUsage = Infinity;
    let nextColor: string = OBJECT_COLOR_PALETTE[0];

    for (const color of OBJECT_COLOR_PALETTE) {
      const usage = this.usedColors.get(color) ?? 0;
      if (usage < minUsage) {
        minUsage = usage;
        nextColor = color;
      }
    }

    return nextColor;
  }

  /**
   * 色の使用を記録
   * パレット外の色（カスタム色）の場合は記録しない
   */
  recordColorUsage(color: string): void {
    if (!isPaletteColor(color)) {
      return;
    }
    const currentUsage = this.usedColors.get(color) ?? 0;
    this.usedColors.set(color, currentUsage + 1);
  }

  /**
   * 色の使用を解除（オブジェクト削除時）
   * 使用回数が0以下にならないようにする
   */
  releaseColor(color: string): void {
    if (!isPaletteColor(color)) {
      return;
    }
    const currentUsage = this.usedColors.get(color) ?? 0;
    if (currentUsage > 0) {
      this.usedColors.set(color, currentUsage - 1);
    }
  }

  /**
   * 現在の使用状況から初期化
   */
  initializeFromObjects(objects: { color: string }[]): void {
    this.reset();
    for (const obj of objects) {
      this.recordColorUsage(obj.color);
    }
  }

  /**
   * リセット
   */
  reset(): void {
    this.usedColors.clear();
  }

  /**
   * 現在の使用状況を取得（デバッグ用）
   */
  getUsageStats(): Map<string, number> {
    return new Map(this.usedColors);
  }
}

/**
 * シングルトンインスタンス
 */
export const colorPaletteManager = new ColorPaletteManager();

/**
 * 次のオブジェクト色を取得し、使用を記録するヘルパー関数
 */
export const getNextObjectColor = (): string => {
  const color = colorPaletteManager.getNextColor();
  colorPaletteManager.recordColorUsage(color);
  return color;
};
