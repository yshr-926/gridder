import { BringToFront, ChevronDown, ChevronUp, Copy, SendToBack, Trash2 } from 'lucide-react';
import {
  bringForward,
  bringToFront,
  deleteSelection,
  duplicateSelection,
  sendBackward,
  sendToBack,
} from '@/features/editor';
import { IconButton, Tooltip, TooltipProvider } from '../ui';

/**
 * Z-order and duplicate/delete controls for the selection (issue #51, spec §7).
 * These apply to single and multi-selections alike; each click dispatches one
 * editor-core Command (or a CompositeCommand for a multi-selection) so it is a
 * single Undo step. Delete has no confirmation dialog per ui-principles §5.
 */
export const ShapeStructureActions = () => (
  <div className="border-b border-ui-border p-4">
    <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ui-muted">配置</h3>
    <TooltipProvider>
      <div className="flex gap-1" role="group" aria-label="重なり順">
        <Tooltip content="最背面へ">
          <IconButton
            icon={<SendToBack aria-hidden="true" className="size-4" />}
            label="最背面へ"
            size="sm"
            onClick={sendToBack}
          />
        </Tooltip>
        <Tooltip content="背面へ">
          <IconButton
            icon={<ChevronDown aria-hidden="true" className="size-4" />}
            label="背面へ"
            size="sm"
            onClick={sendBackward}
          />
        </Tooltip>
        <Tooltip content="前面へ">
          <IconButton
            icon={<ChevronUp aria-hidden="true" className="size-4" />}
            label="前面へ"
            size="sm"
            onClick={bringForward}
          />
        </Tooltip>
        <Tooltip content="最前面へ">
          <IconButton
            icon={<BringToFront aria-hidden="true" className="size-4" />}
            label="最前面へ"
            size="sm"
            onClick={bringToFront}
          />
        </Tooltip>
      </div>
      <div className="mt-2 flex gap-1">
        <Tooltip content="複製 (Cmd/Ctrl+D)">
          <IconButton
            icon={<Copy aria-hidden="true" className="size-4" />}
            label="複製"
            size="sm"
            onClick={duplicateSelection}
          />
        </Tooltip>
        <Tooltip content="削除 (Delete)">
          <IconButton
            icon={<Trash2 aria-hidden="true" className="size-4" />}
            label="削除"
            size="sm"
            onClick={deleteSelection}
          />
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
);
