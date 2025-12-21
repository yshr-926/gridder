import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateImageFilename,
  downloadDataURL,
  exportStageAsImage,
  exportAsPNG,
  exportAsJPEG,
} from './exportImage';

// Konva Stage のモック
const createMockStage = () => {
  const stage = {
    x: vi.fn().mockReturnValue(100),
    y: vi.fn().mockReturnValue(50),
    scaleX: vi.fn().mockReturnValue(1.5),
    scaleY: vi.fn().mockReturnValue(1.5),
    width: vi.fn().mockReturnValue(800),
    height: vi.fn().mockReturnValue(600),
    position: vi.fn(),
    scale: vi.fn(),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
    getLayers: vi.fn().mockReturnValue([]),
  };

  return stage;
};

describe('exportImage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateImageFilename', () => {
    it('should generate PNG filename with timestamp', () => {
      vi.setSystemTime(new Date('2024-12-18T14:30:25.000Z'));
      const filename = generateImageFilename('png');
      expect(filename).toBe('gridder_20241218_143025.png');
    });

    it('should generate JPEG filename with timestamp', () => {
      vi.setSystemTime(new Date('2024-01-01T09:05:30.000Z'));
      const filename = generateImageFilename('jpeg');
      expect(filename).toBe('gridder_20240101_090530.jpeg');
    });
  });

  describe('downloadDataURL', () => {
    it('should create link and trigger download', () => {
      const mockClick = vi.fn();
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: mockClick,
      };

      vi.spyOn(document, 'createElement').mockReturnValue(
        mockLink as unknown as HTMLAnchorElement
      );
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      downloadDataURL('data:image/png;base64,test', 'test.png');

      expect(mockLink.href).toBe('data:image/png;base64,test');
      expect(mockLink.download).toBe('test.png');
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('exportStageAsImage', () => {
    it('should export stage as PNG', () => {
      const stage = createMockStage();

      const dataURL = exportStageAsImage(stage as unknown as import('konva').default.Stage, {
        format: 'png',
      });

      expect(dataURL).toBe('data:image/png;base64,test');
      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/png',
          pixelRatio: 2,
        })
      );
    });

    it('should export stage as JPEG', () => {
      const stage = createMockStage();

      exportStageAsImage(stage as unknown as import('konva').default.Stage, {
        format: 'jpeg',
        quality: 0.8,
      });

      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/jpeg',
          quality: 0.8,
          pixelRatio: 2,
        })
      );
    });

    it('should restore stage position and scale after export', () => {
      const stage = createMockStage();

      exportStageAsImage(stage as unknown as import('konva').default.Stage, {
        format: 'png',
      });

      // リセット（エクスポート用）
      expect(stage.position).toHaveBeenCalledWith({ x: 0, y: 0 });
      expect(stage.scale).toHaveBeenCalledWith({ x: 1, y: 1 });

      // 復元
      expect(stage.position).toHaveBeenCalledWith({ x: 100, y: 50 });
      expect(stage.scale).toHaveBeenCalledWith({ x: 1.5, y: 1.5 });
    });

    it('should use custom pixelRatio', () => {
      const stage = createMockStage();

      exportStageAsImage(stage as unknown as import('konva').default.Stage, {
        format: 'png',
        pixelRatio: 3,
      });

      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          pixelRatio: 3,
        })
      );
    });

    it('should use default options', () => {
      const stage = createMockStage();

      exportStageAsImage(stage as unknown as import('konva').default.Stage);

      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/png',
          pixelRatio: 2,
        })
      );
    });
  });

  describe('exportAsPNG', () => {
    it('should export and download PNG', () => {
      const stage = createMockStage();
      const mockClick = vi.fn();

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        style: { display: '' },
        click: mockClick,
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      vi.setSystemTime(new Date('2024-12-18T14:30:25.000Z'));

      exportAsPNG(stage as unknown as import('konva').default.Stage);

      expect(mockClick).toHaveBeenCalled();
      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/png',
        })
      );
    });

    it('should use custom filename', () => {
      const stage = createMockStage();
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockReturnValue(
        mockLink as unknown as HTMLAnchorElement
      );
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      exportAsPNG(stage as unknown as import('konva').default.Stage, {
        filename: 'custom.png',
      });

      expect(mockLink.download).toBe('custom.png');
    });
  });

  describe('exportAsJPEG', () => {
    it('should export and download JPEG with quality', () => {
      const stage = createMockStage();
      const mockClick = vi.fn();

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        style: { display: '' },
        click: mockClick,
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      exportAsJPEG(stage as unknown as import('konva').default.Stage, {
        quality: 0.8,
      });

      expect(mockClick).toHaveBeenCalled();
      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/jpeg',
          quality: 0.8,
        })
      );
    });

    it('should use default quality if not specified', () => {
      const stage = createMockStage();

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      exportAsJPEG(stage as unknown as import('konva').default.Stage);

      expect(stage.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 0.92,
        })
      );
    });

    it('should use custom filename', () => {
      const stage = createMockStage();
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockReturnValue(
        mockLink as unknown as HTMLAnchorElement
      );
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      exportAsJPEG(stage as unknown as import('konva').default.Stage, {
        filename: 'custom.jpeg',
      });

      expect(mockLink.download).toBe('custom.jpeg');
    });
  });
});
