import type { EditorShape, PhysicalScale } from '@gridder/editor-core';
import { formatDimension, shapeCellSize } from '@/features/editor';

interface ShapeDimensionsProps {
  readonly shape: EditorShape;
  readonly physicalScale: PhysicalScale | undefined;
}

/**
 * Read-only width / height for a single selected shape (issue #45, spec §8).
 * Values come from the polygon's bounding box: cell counts when the sketch has
 * no real-world scale, unit-suffixed lengths once one is set. The value column
 * uses `tabular-nums` and a fixed min-width so digit changes don't shift the
 * layout.
 */
export const ShapeDimensions = ({ shape, physicalScale }: ShapeDimensionsProps) => {
  const { widthCells, heightCells } = shapeCellSize(shape.polygon);

  const rows: readonly { readonly label: string; readonly value: string }[] = [
    { label: '幅', value: formatDimension(widthCells, physicalScale) },
    { label: '高さ', value: formatDimension(heightCells, physicalScale) },
  ];

  return (
    <div className="border-b border-ui-border p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ui-muted">寸法</h3>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between text-sm">
            <dt className="text-ui-muted">{row.label}</dt>
            <dd className="min-w-[6rem] text-right tabular-nums text-ui">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
