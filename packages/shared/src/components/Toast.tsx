import { useCallback, useState, ReactNode } from "react";
import { Button } from "./Button";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { ToastContext } from "./ToastContext";

import "./styles/Toast.css";

/**
 * Toast types and interfaces
 */
export type ToastVariant = "info" | "success" | "warning" | "error";
export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  timeout?: number;
  onClose?: () => void;
}

export interface ToastItem extends ToastOptions {
  id: string;
}

/**
 * ToastProvider - Provides toast context to children
 */
interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = "top-right",
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (options: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = options.timeout ?? 5000;

      setToasts((prev) => {
        const newToasts = [...prev, { ...options, id }];
        // Limit max toasts
        if (newToasts.length > maxToasts) {
          return newToasts.slice(-maxToasts);
        }
        return newToasts;
      });

      // Auto dismiss
      if (timeout > 0) {
        setTimeout(() => {
          removeToast(id);
          options.onClose?.();
        }, timeout);
      }

      return id;
    },
    [maxToasts, removeToast],
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, removeAllToasts }}
    >
      {children}
      <ToastRegion
        toasts={toasts}
        position={position}
        onDismiss={removeToast}
      />
    </ToastContext.Provider>
  );
}

/**
 * ToastRegion - Container for displaying toasts
 */
interface ToastRegionProps {
  toasts: ToastItem[];
  position: ToastPosition;
  onDismiss: (id: string) => void;
}

function ToastRegion({ toasts, position, onDismiss }: ToastRegionProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="react-aria-ToastRegion"
      data-position={position}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Toast - Individual toast notification
 */
interface ToastProps {
  toast: ToastItem;
  onDismiss: () => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const { title, description, variant = "info" } = toast;

  const Icon = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
  }[variant];

  return (
    <div
      className="react-aria-Toast"
      data-variant={variant}
      role="alert"
      aria-atomic="true"
    >
      <div className="toast-icon">
        <Icon size={20} />
      </div>
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {description && <div className="toast-description">{description}</div>}
      </div>
      <Button
        className="toast-close"
        aria-label="Dismiss"
        onPress={onDismiss}
        variant="secondary"
        size="sm"
      >
        <X size={16} />
      </Button>
    </div>
  );
}

export { Toast, ToastRegion };
