import type { ReactNode } from 'react';
import { cn } from '@/utils';

/**
 * EmptyState Props
 */
interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Action configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional class name */
  className?: string;
}

/**
 * Default empty state icon
 */
const DefaultIcon = () => (
  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

/**
 * EmptyState component
 * Displays a placeholder when there's no content
 */
export const EmptyState = ({ title, description, icon, action, className }: EmptyStateProps) => {
  return (
    <div
      className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div className="mb-4">{icon ?? <DefaultIcon />}</div>

      {/* Title */}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>

      {/* Description */}
      {description && <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-4 py-2',
            'text-sm font-medium text-white',
            'bg-gray-800 rounded-md',
            'hover:bg-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
            'transition-colors'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/**
 * EmptyCanvas component
 * Specific empty state for when there are no objects on canvas
 */
interface EmptyCanvasProps {
  onStartDrawing?: () => void;
}

export const EmptyCanvas = ({ onStartDrawing }: EmptyCanvasProps) => {
  return (
    <EmptyState
      title="オブジェクトがありません"
      description="描画ツールを選択して、グリッド上をクリックして描画を開始してください。"
      icon={
        <svg
          className="w-16 h-16 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      }
      action={
        onStartDrawing
          ? {
              label: '描画ツールを選択',
              onClick: onStartDrawing,
            }
          : undefined
      }
      className="absolute inset-0 pointer-events-none"
    />
  );
};
