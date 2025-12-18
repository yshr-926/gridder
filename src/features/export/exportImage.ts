import type Konva from 'konva';
import type { ImageExportOptions, ImageFormat } from './types';

/**
 * デフォルトのエクスポートオプション
 */
const DEFAULT_OPTIONS: Required<Omit<ImageExportOptions, 'filename'>> = {
  format: 'png',
  quality: 0.92,
  includeBackground: true,
  pixelRatio: 2,
  backgroundColor: 'white',
};

/**
 * タイムスタンプ付き画像ファイル名を生成（UTC時刻を使用）
 * @param format 画像フォーマット
 * @returns ファイル名（例: gridder_20241218_143025.png）
 */
export const generateImageFilename = (format: ImageFormat): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  return `gridder_${timestamp}.${format}`;
};

/**
 * Data URL をダウンロード
 * @param dataURL Data URL 文字列
 * @param filename ファイル名
 */
export const downloadDataURL = (dataURL: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * MIME タイプを取得
 * @param format 画像フォーマット
 * @returns MIME タイプ
 */
const getMimeType = (format: ImageFormat): string => {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png';
};

/**
 * Konva Stage を画像としてエクスポート
 * @param stage Konva Stage インスタンス
 * @param options エクスポートオプション
 * @returns Data URL 文字列
 */
export const exportStageAsImage = (
  stage: Konva.Stage,
  options: ImageExportOptions = { format: 'png' }
): string => {
  const {
    format,
    quality = DEFAULT_OPTIONS.quality,
    includeBackground = DEFAULT_OPTIONS.includeBackground,
    pixelRatio = DEFAULT_OPTIONS.pixelRatio,
    backgroundColor = DEFAULT_OPTIONS.backgroundColor,
  } = options;

  // 現在のステージ設定を保存
  const originalX = stage.x();
  const originalY = stage.y();
  const originalScaleX = stage.scaleX();
  const originalScaleY = stage.scaleY();

  // エクスポート用にステージをリセット（パン・ズームを無効化）
  stage.position({ x: 0, y: 0 });
  stage.scale({ x: 1, y: 1 });

  // Note: 背景色の追加は、呼び出し元（App.tsx）で
  // GridBackground コンポーネントが既に描画しているため、
  // ここでは追加しない。
  // JPEG の場合は GridBackground が白背景を提供する。
  void includeBackground;
  void backgroundColor;

  try {
    // Data URL を生成
    const dataURL = stage.toDataURL({
      mimeType: getMimeType(format),
      quality: format === 'jpeg' ? quality : undefined,
      pixelRatio,
    });

    return dataURL;
  } finally {
    // ステージ設定を復元
    stage.position({ x: originalX, y: originalY });
    stage.scale({ x: originalScaleX, y: originalScaleY });
  }
};

/**
 * Konva Stage を PNG 形式でエクスポートしてダウンロード
 * @param stage Konva Stage インスタンス
 * @param options エクスポートオプション（format は無視）
 */
export const exportAsPNG = (
  stage: Konva.Stage,
  options: Omit<ImageExportOptions, 'format' | 'quality'> = {}
): void => {
  const {
    includeBackground = false, // PNG はデフォルトで透明背景
    pixelRatio = DEFAULT_OPTIONS.pixelRatio,
    filename,
    backgroundColor,
  } = options;

  const dataURL = exportStageAsImage(stage, {
    format: 'png',
    includeBackground,
    pixelRatio,
    backgroundColor,
  });

  const finalFilename = filename || generateImageFilename('png');
  downloadDataURL(dataURL, finalFilename);
};

/**
 * Konva Stage を JPEG 形式でエクスポートしてダウンロード
 * @param stage Konva Stage インスタンス
 * @param options エクスポートオプション（format は無視）
 */
export const exportAsJPEG = (
  stage: Konva.Stage,
  options: Omit<ImageExportOptions, 'format'> = {}
): void => {
  const {
    quality = DEFAULT_OPTIONS.quality,
    pixelRatio = DEFAULT_OPTIONS.pixelRatio,
    filename,
    backgroundColor = DEFAULT_OPTIONS.backgroundColor,
  } = options;

  // JPEG は必ず背景色が必要
  const dataURL = exportStageAsImage(stage, {
    format: 'jpeg',
    quality,
    includeBackground: true,
    pixelRatio,
    backgroundColor,
  });

  const finalFilename = filename || generateImageFilename('jpeg');
  downloadDataURL(dataURL, finalFilename);
};

/**
 * Konva Stage を指定フォーマットでエクスポートしてダウンロード
 * @param stage Konva Stage インスタンス
 * @param options エクスポートオプション
 */
export const exportImage = (
  stage: Konva.Stage,
  options: ImageExportOptions
): void => {
  if (options.format === 'jpeg') {
    exportAsJPEG(stage, options);
  } else {
    exportAsPNG(stage, options);
  }
};
