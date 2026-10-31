import { createContext, useContext } from "react";
import type { ToastOptions } from "./Toast";

export interface ToastContextValue {
  /** Queues a toast (S2 `ToastQueue.<variant>`) — its key. */
  addToast: (options: ToastOptions) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * useToast hook - Access toast functionality
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
