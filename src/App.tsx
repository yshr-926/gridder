import { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { StatusBar } from './components/StatusBar';
import { GridCanvas } from './components/Canvas';
import type { GridCanvasRef } from './components/Canvas';
import { ImportDialog } from './components/FileOperations';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { ToastContainer } from './components/Toast';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { CommandPalette } from './components/CommandPalette';
import {
  useCanvasKeyboard,
  useKeyboardShortcutsHelp,
  useToastStore,
  useSentryContext,
} from './hooks';
import {
  exportProjectAsJSON,
  exportAsPNG,
  exportAsJPEG,
  createNewProject,
  useAutoSave,
  hasAutoSavedData,
  restoreFromLocalStorage,
  clearLocalStorage,
} from './features/export';

export const App = () => {
  // Canvas への参照（画像エクスポート用）
  const canvasRef = useRef<GridCanvasRef>(null);

  // カーソル位置（Canvas から設定）
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  // インポートダイアログの表示状態
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // コマンドパレットの表示状態
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // キーボードショートカットヘルプダイアログ
  const { isOpen: isHelpOpen, close: closeHelp } = useKeyboardShortcutsHelp();

  // トースト通知
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  // キーボードショートカットを有効化
  useCanvasKeyboard();

  // 自動保存を有効化
  useAutoSave(true);

  // Sentry コンテキスト同期（エラー追跡用）
  useSentryContext();

  // Ctrl+Shift+P でコマンドパレットを開閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 起動時の復元確認
  useEffect(() => {
    if (hasAutoSavedData()) {
      const shouldRestore = window.confirm(
        '前回の作業データがあります。復元しますか？'
      );
      if (shouldRestore) {
        restoreFromLocalStorage();
      } else {
        clearLocalStorage();
      }
    }
  }, []);

  // カーソル位置変更ハンドラ
  const handleCursorPositionChange = useCallback(
    (position: { x: number; y: number } | null) => {
      setCursorPosition(position);
    },
    []
  );

  // 新規プロジェクト作成
  const handleNewProject = useCallback(() => {
    const shouldCreate = window.confirm(
      '新規プロジェクトを作成しますか？現在の作業内容は失われます。'
    );
    if (shouldCreate) {
      createNewProject();
      clearLocalStorage();
    }
  }, []);

  // プロジェクトを開く（インポートダイアログを表示）
  const handleOpenProject = useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  // プロジェクト保存（JSON エクスポート）
  const handleSaveProject = useCallback(() => {
    exportProjectAsJSON();
  }, []);

  // JSON エクスポート（PropertyPanel 用、handleSaveProject と同じ）
  const handleExportJSON = useCallback(() => {
    exportProjectAsJSON();
  }, []);

  // PNG エクスポート
  const handleExportPNG = useCallback(() => {
    const stage = canvasRef.current?.getStage();
    if (stage) {
      exportAsPNG(stage);
    }
  }, []);

  // JPEG エクスポート
  const handleExportJPEG = useCallback(() => {
    const stage = canvasRef.current?.getStage();
    if (stage) {
      exportAsJPEG(stage);
    }
  }, []);

  // インポート成功時のコールバック
  const handleImportSuccess = useCallback(() => {
    console.log('Project imported successfully');
  }, []);

  // インポートダイアログを閉じる
  const handleCloseImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <Header
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
      />

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar (Left) */}
        <Toolbar />

        {/* Canvas (Center) */}
        <main
          className="flex-1 overflow-hidden bg-gray-100"
          role="application"
          aria-label="作図キャンバス"
        >
          <GridCanvas
            ref={canvasRef}
            onCursorPositionChange={handleCursorPositionChange}
          />
        </main>

        {/* PropertyPanel (Right) */}
        <PropertyPanel
          onExportJSON={handleExportJSON}
          onExportPNG={handleExportPNG}
          onExportJPEG={handleExportJPEG}
        />
      </div>

      {/* StatusBar */}
      <StatusBar cursorPosition={cursorPosition} />

      {/* Import Dialog */}
      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={handleCloseImportDialog}
        onImportSuccess={handleImportSuccess}
      />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={closeHelp} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Command Palette (Ctrl+Shift+P) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Performance Overlay (Development only, toggle with Ctrl+Shift+D) */}
      <PerformanceOverlay />
    </div>
  );
};
