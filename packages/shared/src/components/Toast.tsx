import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion,
  Text as AriaText,
  type ToastProps as AriaToastProps,
} from "react-aria-components/Toast";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { Button } from "./Button";
import { ToastContext } from "./ToastContext";
import {
  toToastRacProps,
  type ToastCanonicalProps,
  type ToastRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/Toast.css";
import "./styles/Toast.css";

export type ToastVariant =
  | ToastRacProps["variant"]
  | "success"
  | "warning"
  | "error";
export type ToastPosition =
  | ToastRacProps["position"]
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

interface ToastContentData {
  title: string;
  description?: string;
  variant: ToastRacProps["variant"];
  size: ToastRacProps["size"];
  className?: string;
  style?: Record<string, unknown>;
  markerProps?: Record<"data-canonical-id" | "data-element-id", string>;
}

type QueuedToast = AriaToastProps<ToastContentData>["toast"];

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
  const queue = useMemo(
    () =>
      new ToastQueue<ToastContentData>({
        maxVisibleToasts: maxToasts,
      }),
    [maxToasts],
  );

  const removeToast = useCallback(
    (id: string) => {
      queue.close(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    },
    [queue],
  );

  const removeAllToasts = useCallback(() => {
    queue.clear();
    setToasts([]);
  }, [queue]);

  const addToast = useCallback(
    (options: ToastOptions): string => {
      let id = "";
      const projectedProps = toToastRacProps({ ...options });
      id = queue.add(toToastContent(projectedProps), {
        timeout: projectedProps.timeout,
        onClose: () => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
          options.onClose?.();
        },
      });

      setToasts((prev) => {
        const next = [...prev, { ...options, id }];
        return next.length > maxToasts ? next.slice(-maxToasts) : next;
      });

      return id;
    },
    [maxToasts, queue],
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, removeAllToasts }}
    >
      {children}
      <ToastRegion queue={queue} position={position} />
    </ToastContext.Provider>
  );
}

export interface ToastRegionProps {
  queue?: ToastQueue<ToastContentData>;
  toasts?: ToastItem[];
  position?: ToastPosition;
  onDismiss?: (id: string) => void;
}

export function ToastRegion({
  queue,
  toasts = [],
  position = "bottom",
  onDismiss: _onDismiss,
}: ToastRegionProps) {
  const fallbackQueue = useMemo(() => {
    const nextQueue = new ToastQueue<ToastContentData>({
      maxVisibleToasts: Math.max(toasts.length, 1),
    });
    for (const toast of toasts) {
      const projectedProps = toToastRacProps({ ...toast });
      nextQueue.add(toToastContent(projectedProps));
    }
    return nextQueue;
  }, [toasts]);

  return (
    <AriaToastRegion
      aria-label="Notifications"
      data-position={normalizeToastPositionAttribute(position)}
      queue={queue ?? fallbackQueue}
    >
      {({ toast }) => <ToastView toast={toast} />}
    </AriaToastRegion>
  );
}

export interface ToastProps extends ToastCanonicalProps {
  toast?: QueuedToast;
  "data-canonical-id"?: string;
  "data-element-id"?: string;
}

export function Toast(props: ToastProps) {
  if (props.toast) {
    return <ToastView toast={props.toast} />;
  }

  return <StandaloneToast {...props} />;
}

function StandaloneToast(props: ToastProps) {
  const projectedProps = toToastRacProps(props);
  const queue = useMemo(() => {
    const nextQueue = new ToastQueue<ToastContentData>({
      maxVisibleToasts: 1,
    });
    nextQueue.add(
      toToastContent(projectedProps, {
        "data-canonical-id": props["data-canonical-id"] ?? "",
        "data-element-id": props["data-element-id"] ?? "",
      }),
    );
    return nextQueue;
  }, [
    projectedProps.title,
    projectedProps.description,
    projectedProps.variant,
    projectedProps.size,
    projectedProps.className,
    projectedProps.style,
    props["data-canonical-id"],
    props["data-element-id"],
  ]);

  return <ToastRegion queue={queue} position={projectedProps.position} />;
}

function ToastView({ toast }: { toast: QueuedToast }) {
  const { title, description, variant, size, className, style, markerProps } =
    toast.content;
  const Icon = getToastIcon(variant);
  const domMarkerProps =
    markerProps?.["data-canonical-id"] && markerProps["data-element-id"]
      ? markerProps
      : {};

  return (
    <AriaToast
      toast={toast}
      {...domMarkerProps}
      className={
        className ? `react-aria-Toast ${className}` : "react-aria-Toast"
      }
      data-size={size}
      data-variant={variant}
      style={style as CSSProperties | undefined}
    >
      <AriaToastContent>
        <span className="toast-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="toast-content">
          <AriaText slot="title" className="toast-title">
            {title}
          </AriaText>
          {description ? (
            <AriaText slot="description" className="toast-description">
              {description}
            </AriaText>
          ) : null}
        </div>
      </AriaToastContent>
      <Button
        slot="close"
        className="toast-close"
        aria-label="Dismiss"
        variant="secondary"
        size="sm"
      >
        <X size={16} />
      </Button>
    </AriaToast>
  );
}

function toToastContent(
  props: ToastRacProps,
  markerProps?: Record<"data-canonical-id" | "data-element-id", string>,
): ToastContentData {
  return {
    title: props.title,
    ...(props.description ? { description: props.description } : {}),
    variant: props.variant,
    size: props.size,
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(props.style ? { style: props.style } : {}),
    ...(markerProps ? { markerProps } : {}),
  };
}

function normalizeToastPositionAttribute(position: ToastPosition): string {
  if (position === "top end") return "top-right";
  if (position === "top start") return "top-left";
  if (position === "top") return "top-center";
  if (position === "bottom end") return "bottom-right";
  if (position === "bottom start") return "bottom-left";
  if (position === "bottom") return "bottom-center";
  return position;
}

function getToastIcon(variant: ToastRacProps["variant"]) {
  if (variant === "positive") return CheckCircle;
  if (variant === "negative") return AlertCircle;
  if (variant === "neutral") return AlertTriangle;
  return Info;
}
