import { useEffect } from 'react';
import { cn } from '@/utils';

/**
 * Toast message type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast message interface
 */
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/**
 * Toast Props
 */
interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

/**
 * Toast type styles
 */
const toastStyles: Record<ToastType, { bg: string; icon: string; iconBg: string }> = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
};

/**
 * Toast icons
 */
const ToastIcon = ({ type }: { type: ToastType }) => {
  const style = toastStyles[type];

  const icons: Record<ToastType, React.JSX.Element> = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div
      className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        style.iconBg
      )}
    >
      <span className={style.icon}>{icons[type]}</span>
    </div>
  );
};

/**
 * Toast component
 * Individual toast notification
 */
export const Toast = ({ toast, onRemove }: ToastProps) => {
  const { id, type, message, duration = 3000 } = toast;
  const style = toastStyles[type];

  // Auto-remove after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onRemove(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onRemove]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 border rounded-lg shadow-lg',
        'animate-in slide-in-from-right fade-in duration-300',
        style.bg
      )}
      role="alert"
      aria-live="polite"
    >
      <ToastIcon type={type} />
      <p className="flex-1 text-sm text-gray-700">{message}</p>
      <button
        onClick={() => onRemove(id)}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="閉じる"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * ToastContainer Props
 */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

/**
 * ToastContainer component
 * Container for multiple toast notifications
 */
export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full" aria-label="通知">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};
