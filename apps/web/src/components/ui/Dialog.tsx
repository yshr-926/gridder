import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { cn } from '@/utils';
import { Button } from './Button';

/**
 * Confirmation dialog built on Base UI's Dialog primitive (issue #54,
 * ui-principles §7). Deliberately narrow — a title, a message, and up to two
 * actions — rather than a general-purpose modal, since the only use in this
 * release is confirming a destructive action (new sketch / open a file while
 * the current one has unsaved changes). `Dialog.Close` renders inside the
 * popup per Base UI's guidance so touch screen readers can dismiss a modal
 * dialog.
 */
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Label for the destructive/primary action, e.g. "保存せずに続ける". */
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red) rather than the default dark primary. */
  destructive?: boolean;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel = 'キャンセル',
  destructive = false,
}: ConfirmDialogProps) => (
  <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/40',
          'transition-opacity duration-fast',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
        )}
      />
      <BaseDialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2',
          'rounded-lg border border-ui-border bg-surface p-5 shadow-lg',
          'transition-[transform,opacity] duration-fast ease-out',
          'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
        )}
      >
        <BaseDialog.Title className="text-sm font-semibold text-ui">{title}</BaseDialog.Title>
        <BaseDialog.Description className="mt-2 text-sm text-ui-muted">
          {description}
        </BaseDialog.Description>
        <div className="mt-5 flex justify-end gap-2">
          <BaseDialog.Close render={<Button variant="secondary">{cancelLabel}</Button>} />
          <BaseDialog.Close
            render={
              <Button
                variant="primary"
                className={destructive ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500' : undefined}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            }
          />
        </div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
);
