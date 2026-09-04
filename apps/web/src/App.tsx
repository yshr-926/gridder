import { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { PropertyPanel } from './components/PropertyPanel';
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
import { useCanvasStore } from './stores';
import { fitDrawingBoundsToContent, useEditorDocument, useEditorHistory } from './features/editor';
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

  // インポートダイアログの表示状態
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // コマンドパレットの表示状態
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // キーボードショートカットヘルプダイアログ
  const { isOpen: isHelpOpen, close: closeHelp } = useKeyboardShortcutsHelp();

  // トースト通知
  const toasts = useToastStore(state => state.toasts);
  const removeToast = useToastStore(state => state.removeToast);

  // キーボードショートカットを有効化
  useCanvasKeyboard();

  // 自動保存を有効化
  useAutoSave(true);

  // Sentry コンテキスト同期（エラー追跡用）
  useSentryContext();

  // ポリゴン文書（editor-core）とその Undo/Redo 履歴（#42）
  const editorDocument = useEditorDocument();
  const { undo: handleUndo, redo: handleRedo, canUndo, canRedo } = useEditorHistory();
  const toolMode = useCanvasStore(state => state.toolMode);
  const setToolMode = useCanvasStore(state => state.setToolMode);

  // Ctrl+Shift+P でコマンドパレットを開閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'P') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 起動時の復元確認
  useEffect(() => {
    if (hasAutoSavedData()) {
      const shouldRestore = window.confirm('前回の作業データがあります。復元しますか？');
      if (shouldRestore) {
        restoreFromLocalStorage();
      } else {
        clearLocalStorage();
      }
    }
  }, []);

  // 新規スケッチ作成
  const handleNewSketch = useCallback(() => {
    const shouldCreate = window.confirm(
      '新しいスケッチを作成しますか？現在の作業内容は失われます。'
    );
    if (shouldCreate) {
      createNewProject();
      clearLocalStorage();
    }
  }, []);

  // スケッチを開く（インポートダイアログを表示）
  const handleOpenSketch = useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  // スケッチ保存（JSON エクスポート）
  const handleSaveSketch = useCallback(() => {
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

  const handleAddPolygon = useCallback(() => {
    setToolMode('polygon');
  }, [setToolMode]);

  // インポート成功時のコールバック
  const handleImportSuccess = useCallback(() => {
    console.log('Project imported successfully');
  }, []);

  // インポートダイアログを閉じる
  const handleCloseImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-canvas text-ui">
      <Header
        onNewSketch={handleNewSketch}
        onOpenSketch={handleOpenSketch}
        onSaveSketch={handleSaveSketch}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddPolygon={handleAddPolygon}
        isAddingPolygon={toolMode === 'polygon'}
        onSharePNG={handleExportPNG}
        onShareJPEG={handleExportJPEG}
        onFitDrawingBoundsToContent={fitDrawingBoundsToContent}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          className="relative min-w-0 flex-1 overflow-hidden bg-canvas"
          role="application"
          aria-label="作図キャンバス"
        >
          <GridCanvas ref={canvasRef} editorDocument={editorDocument} />
        </main>

        <PropertyPanel />
      </div>

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

      <PerformanceOverlay />
    </div>
  );
};
