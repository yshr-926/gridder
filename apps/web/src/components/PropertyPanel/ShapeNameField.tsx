import { useState } from 'react';
import type { EditorShape } from '@gridder/editor-core';
import { renameShape } from '@/features/editor';

interface ShapeNameFieldProps {
  readonly shape: EditorShape;
}

/**
 * Name field for a single selected shape (issue #45). The input is locally
 * controlled while editing and commits a {@link RenameShapeCommand} on blur or
 * Enter; Escape reverts to the document value without a Command.
 *
 * Re-syncing the draft when the document name changes elsewhere (undo, editing
 * a different shape) is done during render per
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes,
 * not in a `useEffect`, so switching shapes never flashes a stale value.
 */
export const ShapeNameField = ({ shape }: ShapeNameFieldProps) => {
  const committedName = shape.name ?? '';

  const [draft, setDraft] = useState(committedName);
  const [syncedFor, setSyncedFor] = useState<{ shapeId: string; name: string }>({
    shapeId: shape.id,
    name: committedName,
  });

  if (syncedFor.shapeId !== shape.id || syncedFor.name !== committedName) {
    setSyncedFor({ shapeId: shape.id, name: committedName });
    setDraft(committedName);
  }

  const commit = () => {
    if (draft.trim() === committedName.trim()) {
      return;
    }
    renameShape(shape.id, draft);
  };

  return (
    <div className="border-b border-ui-border p-4">
      <label
        htmlFor="shape-name"
        className="mb-2 block text-xs font-medium uppercase tracking-wide text-ui-muted"
      >
        名前
      </label>
      <input
        id="shape-name"
        type="text"
        value={draft}
        placeholder="名前を入力"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(committedName);
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};
