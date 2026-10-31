/**
 * ADR-295 후속 C2 — the app's toasts as S2 1.8.1 draws them (`@react-spectrum/s2` `Toast.tsx`), on RAC's
 * toast primitives (D1 — `UNSTABLE_ToastRegion` · `UNSTABLE_ToastList` · `UNSTABLE_Toast` — region
 * landmark, `alertdialog`, the close button's name, F6 to the region).
 *
 * - `ToastQueue.<variant>(message, {timeout})`: `neutral` · `info` (absent) · `positive` · `negative` —
 *   a solid color with white text, its icon (`neutral` none). No timeout = the toast stays until closed;
 *   a set one is at least 5s (S2 `addToast`).
 * - One stack (S2 `ToastContainer`): the newest toast on top, the ones behind it a sliver of their color
 *   (three at most); 「Show all」 expands the list over a backdrop with 「Clear all」 · 「Collapse」
 *   (Escape · backdrop collapse it).
 * - Placement: S2 `ToastPlacement` (`top` · `top end` · `bottom` · `bottom end`), 16 from the edge.
 *
 * Its class names are its own (`catalog-toast*`): RAC's default `react-aria-Toast` is the document's Toast
 * node's (the generated sheet), not this. Sizes S2 grows on a touch device (`size()` — min height 56 ·
 * max width 336 · the close button) go inline as the device formula; the color · font come from the
 * theme tokens (`colorTokenToCss` · the `ui` font = `{typography.text-sm}`). The action button (S2
 * `actionLabel` · `onAction` · `shouldCloseOnAction`) is S2's `Button variant="secondary"
 * fillStyle="outline" staticColor="white"` — the document Button's sheet paints it.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext } from "./ToastContext";

/** S2 1.8.1 `SpectrumToastValue.variant`. */
export type ToastVariant = "neutral" | "info" | "positive" | "negative";
/** S2 1.8.1 `ToastPlacement`. */
export type ToastPlacement = "top" | "top end" | "bottom" | "bottom end";

export interface ToastOptions {
  /** The toast's text (S2 `children`). */
  title: string;
  /** Absent = `info` (S2 `toast.content.variant || 'info'`). */
  variant?: ToastVariant;
  /** ms; absent = until closed. A set timeout is at least 5000 (S2); an actionable toast has none. */
  timeout?: number;
  onClose?: () => void;
  /** S2 `ToastOptions.actionLabel` — the action button's text (absent = no button). */
  actionLabel?: string;
  /** S2 `ToastOptions.onAction` — runs when the action button is pressed. */
  onAction?: () => void;
  /** S2 `ToastOptions.shouldCloseOnAction` — the toast closes after its action. */
  shouldCloseOnAction?: boolean;
}

type RegionModule = typeof import("./ToastRegion.lazy");

/** One queued toast as the app's own shape receives it (RAC `MyToastRegion`'s render function's `toast`). */
export interface ToastRenderInput {
  key: string;
  title: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  shouldCloseOnAction?: boolean;
  /** Closes this toast (the shape's close button · its action when `shouldCloseOnAction`). */
  close: () => void;
}
/**
 * The app's toast shape (user 2026-11-01 — RAC `Toast.tsx` `MyToastRegion`: one shape per app, the
 * queue passes data): what the region renders inside RAC's `<Toast>` for each toast instead of the
 * S2 look. Absent = S2's toast.
 */
export type ToastRenderer = (toast: ToastRenderInput) => ReactNode;

interface ToastProviderProps {
  children: ReactNode;
  /** S2 `ToastContainer` `placement` — default `bottom` (S2's). */
  placement?: ToastPlacement;
  renderToast?: ToastRenderer;
}

/**
 * The app's toast queue and region (S2 `ToastQueue` + `ToastContainer`). The region module loads with
 * the first toast; toasts added before it arrives are queued in order then.
 */
export function ToastProvider({
  children,
  placement = "bottom",
  renderToast,
}: ToastProviderProps) {
  const [region, setRegion] = useState<{
    module: RegionModule;
    queue: import("./ToastRegion.lazy").CatalogToastQueue;
  } | null>(null);
  const queue = useRef<import("./ToastRegion.lazy").CatalogToastQueue | null>(
    null,
  );
  const pending = useRef<{ key: string; options: ToastOptions }[]>([]);
  const loading = useRef(false);
  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    void import("./ToastRegion.lazy").then((module) => {
      const next = module.createCatalogToastQueue();
      queue.current = next;
      for (const { options } of pending.current.splice(0)) next.add(options);
      setRegion({ module, queue: next });
    });
  }, []);
  const addToast = useCallback(
    (options: ToastOptions): string => {
      if (queue.current) return queue.current.add(options);
      const key = `pending-toast-${pending.current.length}-${Date.now()}`;
      pending.current.push({ key, options });
      load();
      return key;
    },
    [load],
  );
  const value = useMemo(
    () => ({
      addToast,
      removeToast: (key: string) => {
        pending.current = pending.current.filter((item) => item.key !== key);
        queue.current?.close(key);
      },
      removeAllToasts: () => {
        pending.current = [];
        queue.current?.clear();
      },
    }),
    [addToast],
  );
  const Region = region?.module.ToastRegion;
  return (
    <ToastContext.Provider value={value}>
      {children}
      {Region && region && (
        <Region
          queue={region.queue.queue}
          placement={placement}
          renderToast={renderToast}
        />
      )}
    </ToastContext.Provider>
  );
}
