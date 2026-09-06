import { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { PropertyPanel } from './components/PropertyPanel';
import { GridCanvas } from './components/Canvas';
import type { GridCanvasRef } from './components/Canvas';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { ToastContainer } from './components/Toast';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmDialog } from './components/ui';
import {
  useCanvasKeyboard,
  useKeyboardShortcutsHelp,
  useToastStore,
  useSentryContext,
} from './hooks';
import { fitDrawingBoundsToContent, useEditorDocument, useEditorHistory } from './features/editor';
import { useBeforeUnload, useFileMenu } from './features/file';

export const App = () => {
  // Canvas への参照（画像エクスポート用）
  const canvasRef = useRef<GridCanvasRef>(null);

  // コマンドパレットの表示状態
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // キーボードショートカットヘルプダイアログ
  const { isOpen: isHelpOpen, close: closeHelp } = useKeyboardShortcutsHelp();

  // トースト通知
  const toasts = useToastStore(state => state.toasts);
  const removeToast = useToastStore(state => state.removeToast);

  // キーボードショートカットを有効化
  useCanvasKeyboard();

  // Sentry コンテキスト同期（エラー追跡用）
  useSentryContext();

  // 保存ファイルの新規/開く/保存/名前を付けて保存（issue #54, spec §9）と、
  // 未保存の変更があるページ離脱を確認する beforeunload。
  const fileMenu = useFileMenu();
  useBeforeUnload();

  // ポリゴン文書（editor-core）とその Undo/Redo 履歴（#42）
  const editorDocument = useEditorDocument();
  const { undo: handleUndo, redo: handleRedo, canUndo, canRedo } = useEditorHistory();

  // ポリゴン作成モード（editor-core の creatingPolygon 状態、#48）。
  // GridCanvas 内の interaction controller が唯一の情報源で、ここでは
  // 上部バーの pressed 表示のためだけに反映する。
  const [isCreatingPolygon, setIsCreatingPolygon] = useState(false);

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

  const handleAddPolygon = useCallback(() => {
    canvasRef.current?.startPolygonCreation();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-canvas text-ui">
      <Header
        onNewSketch={fileMenu.requestNew}
        onOpenSketch={fileMenu.requestOpen}
        onSaveSketch={fileMenu.save}
        onSaveSketchAs={fileMenu.saveAs}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddPolygon={handleAddPolygon}
        isAddingPolygon={isCreatingPolygon}
        onFitDrawingBoundsToContent={fitDrawingBoundsToContent}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          className="relative min-w-0 flex-1 overflow-hidden bg-canvas"
          role="application"
          aria-label="作図キャンバス"
        >
          <GridCanvas
            ref={canvasRef}
            editorDocument={editorDocument}
            onCreatingPolygonChange={setIsCreatingPolygon}
          />
        </main>

        <PropertyPanel />
      </div>

      {/* 保存されていない変更を破棄する確認（issue #54, spec §9） */}
      <ConfirmDialog
        open={fileMenu.pendingConfirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            fileMenu.cancelDiscard();
          }
        }}
        title="保存されていない変更があります"
        description={
          fileMenu.pendingConfirmAction === 'open'
            ? 'このまま別のファイルを開くと、現在の変更は失われます。'
            : 'このまま新しいスケッチを作成すると、現在の変更は失われます。'
        }
        confirmLabel="破棄して続ける"
        destructive
        onConfirm={fileMenu.confirmDiscard}
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
