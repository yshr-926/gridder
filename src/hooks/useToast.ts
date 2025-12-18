import { create } from 'zustand';
import type { ToastMessage, ToastType } from '@/components/Toast';

/**
 * Toast store state
 */
interface ToastState {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * Generate unique toast ID
 */
const generateToastId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Toast store
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateToastId();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

/**
 * Toast helper functions
 */
interface ToastHelpers {
  /** Show success toast */
  success: (message: string, duration?: number) => void;
  /** Show error toast */
  error: (message: string, duration?: number) => void;
  /** Show warning toast */
  warning: (message: string, duration?: number) => void;
  /** Show info toast */
  info: (message: string, duration?: number) => void;
  /** Show custom toast */
  show: (type: ToastType, message: string, duration?: number) => void;
  /** Remove specific toast */
  dismiss: (id: string) => void;
  /** Clear all toasts */
  clear: () => void;
}

/**
 * useToast hook
 * Provides helper functions to show toast notifications
 */
export const useToast = (): ToastHelpers => {
  const { addToast, removeToast, clearToasts } = useToastStore();

  const show = (type: ToastType, message: string, duration?: number) => {
    addToast({ type, message, duration });
  };

  return {
    success: (message, duration) => show('success', message, duration),
    error: (message, duration) => show('error', message, duration),
    warning: (message, duration) => show('warning', message, duration),
    info: (message, duration) => show('info', message, duration),
    show,
    dismiss: removeToast,
    clear: clearToasts,
  };
};
