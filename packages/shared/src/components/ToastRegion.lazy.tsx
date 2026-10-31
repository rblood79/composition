/**
 * ADR-295 후속 C2 — the toast region (RAC toast primitives + S2's look), loaded with the first toast
 * (`Toast.tsx` `ToastProvider`) so a page that shows none does not carry it in its first bundle.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  UNSTABLE_ToastList as RACToastList,
  UNSTABLE_ToastQueue as RACToastQueue,
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_ToastStateContext as RACToastStateContext,
  type QueuedToast,
} from "react-aria-components/Toast";
import { Button } from "react-aria-components/Button";
import { Text } from "react-aria-components/Text";
import { useLocale } from "react-aria-components/I18nProvider";
import { ChevronDown, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { colorTokenToCss } from "../catalog/resolvers/colorTokenToCss";
import {
  catalogDeviceLength,
  catalogDeviceScaledCss,
} from "../catalog/runtime/deviceTypography";

import type { ToastOptions, ToastPlacement, ToastVariant } from "./Toast";

interface ToastValue {
  title: string;
  variant: ToastVariant;
}

/** S2 `addToast` — "Minimum time of 5s" (Spectrum toast options). */
const MIN_TIMEOUT = 5000;

const BACKGROUND: Record<ToastVariant, string> = {
  neutral: colorTokenToCss("{color.neutral-subdued}"),
  info: colorTokenToCss("{color.informative}"),
  positive: colorTokenToCss("{color.positive}"),
  negative: colorTokenToCss("{color.negative}"),
};
const WHITE = colorTokenToCss("{color.white}", "white");
const ICONS: Partial<Record<ToastVariant, typeof Info>> = {
  info: Info,
  positive: CircleCheck,
  negative: TriangleAlert,
};

/** The queue the provider fills (S2 `getGlobalToastQueue` — every toast visible, the stack shows them). */
export function createCatalogToastQueue() {
  const queue = new RACToastQueue<ToastValue>({ maxVisibleToasts: Infinity });
  return {
    queue,
    add: ({
      title,
      variant = "info",
      timeout,
      onClose,
    }: ToastOptions): string =>
      queue.add(
        { title, variant },
        {
          ...(timeout ? { timeout: Math.max(timeout, MIN_TIMEOUT) } : {}),
          ...(onClose ? { onClose } : {}),
        },
      ),
    close: (key: string) => queue.close(key),
    clear: () => queue.clear(),
  };
}
export type CatalogToastQueue = ReturnType<typeof createCatalogToastQueue>;

/** S2 `intlMessages` (`toast.showAll` · `toast.clearAll` · `toast.collapse`) — en-US · ko-KR. */
const MESSAGES = {
  en: { showAll: "Show all", clearAll: "Clear all", collapse: "Collapse" },
  ko: { showAll: "모두 표시", clearAll: "모두 지우기", collapse: "접기" },
} as const;
function useMessages() {
  const { locale } = useLocale();
  return locale.toLowerCase().startsWith("ko") ? MESSAGES.ko : MESSAGES.en;
}

interface StackValue {
  expanded: boolean;
  toggle: () => void;
  count: number;
  placement: "top" | "bottom";
}
const StackContext = createContext<StackValue>({
  expanded: false,
  toggle: () => {},
  count: 0,
  placement: "bottom",
});

/** S2 `ToastContainer`: the region at its placement, the stack, and the expanded list's controls. */
export function ToastRegion({
  queue,
  placement,
}: {
  queue: RACToastQueue<ToastValue>;
  placement: ToastPlacement;
}) {
  const [side, align = "center"] = placement.split(" ") as [
    "top" | "bottom",
    "end" | undefined,
  ];
  const subscribe = useCallback(
    (onChange: () => void) => queue.subscribe(onChange),
    [queue],
  );
  const count = useSyncExternalStore(
    subscribe,
    () => queue.visibleToasts.length,
    () => 0,
  );
  const [expanded, setExpanded] = useState(false);
  // (S2: collapsed again when the queue empties; a single toast does not expand.)
  useEffect(() => {
    if (count === 0 && expanded) setExpanded(false);
  }, [count, expanded]);
  const toggle = useCallback(
    () => setExpanded((open) => (open ? false : count > 1)),
    [count],
  );
  const messages = useMessages();
  // (S2: Escape collapses the expanded list — on the region's element, RAC's region takes no onKeyDown.)
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = region.current;
    if (!element || !expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [expanded]);
  const stack = useMemo(
    () => ({ expanded, toggle, count, placement: side }),
    [expanded, toggle, count, side],
  );
  return (
    <RACToastRegion
      queue={queue}
      className="catalog-toast-region"
      data-placement={side}
      data-align={align}
      data-expanded={expanded || undefined}
      ref={region}
    >
      <StackContext.Provider value={stack}>
        {expanded && (
          <div
            className="catalog-toast-backdrop"
            aria-hidden
            onClick={() => setExpanded(false)}
          />
        )}
        <RACToastList<ToastValue>
          className="catalog-toast-list"
          style={({ isHovered }) => {
            // (S2: the stack's slivers lean away from the top toast — a perspective origin past it.)
            const origin = isHovered ? 95 : 55;
            return {
              perspective: 80,
              perspectiveOrigin: `center ${side === "top" ? `calc(100% + ${origin}px)` : `${-origin}px`}`,
              transition: "perspective-origin 400ms",
            };
          }}
        >
          {({ toast }) => <ToastItem toast={toast} />}
        </RACToastList>
        {expanded && (
          <div className="catalog-toast-controls">
            <Button
              className="catalog-toast-control"
              onPress={() => queue.clear()}
            >
              {messages.clearAll}
            </Button>
            <Button
              className="catalog-toast-control"
              onPress={() => setExpanded(false)}
            >
              {messages.collapse}
            </Button>
          </div>
        )}
      </StackContext.Provider>
    </RACToastRegion>
  );
}

/** The S2 sizes that grow on a touch device (`size()` — the device unit) and the `ui` font. */
function toastBoxStyle(variant: ToastVariant): CSSProperties {
  return {
    minHeight: catalogDeviceScaledCss(56),
    maxWidth: `min(${catalogDeviceScaledCss(336)}, 90vw)`,
    fontSize: catalogDeviceLength("{typography.text-sm}"),
    lineHeight: catalogDeviceLength("{typography.text-sm--line-height}"),
    backgroundColor: BACKGROUND[variant],
    color: WHITE,
  };
}

/**
 * S2 `SpectrumToast`. (Its `Text`s carry their own class — RAC's default `react-aria-Text` is the document's
 * Text node's sheet, which paints `--fg` over the toast's white.)
 */
function ToastItem({ toast }: { toast: QueuedToast<ToastValue> }) {
  const { expanded, toggle, count, placement } = useContext(StackContext);
  const messages = useMessages();
  const variant = toast.content.variant;
  const index = useIndexOf(toast);
  const isMain = index <= 0;
  // (S2: behind the top toast of a collapsed stack, only the color — a sliver pushed back in depth.)
  if (!isMain && !expanded)
    return (
      <div
        role="presentation"
        className="catalog-toast catalog-toast-behind"
        data-variant={variant}
        style={{
          ...toastBoxStyle(variant),
          position: "absolute",
          [placement === "top" ? "bottom" : "top"]: 0,
          left: 0,
          width: "100%",
          translate: `0 0 ${(-12 * index) / 16}rem`,
          opacity: index >= 3 ? 0 : 1,
          zIndex: count - index - 1,
        }}
      />
    );
  const Icon = ICONS[variant];
  const single = !isMain || count <= 1 || expanded;
  return (
    <RACToast
      toast={toast}
      className="catalog-toast"
      data-variant={variant}
      style={{ ...toastBoxStyle(variant), zIndex: count - index - 1 }}
    >
      <div
        role="presentation"
        className="catalog-toast-body"
        data-single={single || undefined}
      >
        <RACToastContent className="catalog-toast-content">
          {Icon && (
            <span className="catalog-toast-icon" aria-hidden>
              <Icon
                style={{
                  width: catalogDeviceLength("{size.icon.M}"),
                  height: catalogDeviceLength("{size.icon.M}"),
                }}
              />
            </span>
          )}
          <Text slot="title" className="catalog-toast-title">
            {toast.content.title}
          </Text>
        </RACToastContent>
        {!single && (
          <Button
            className="catalog-toast-expand"
            style={{ minHeight: catalogDeviceLength("{size.height.M}") }}
            onPress={toggle}
          >
            <Text className="catalog-toast-title">{messages.showAll}</Text>
            <ChevronDown
              aria-hidden
              style={placement === "bottom" ? { rotate: "180deg" } : undefined}
            />
          </Button>
        )}
      </div>
      <Button
        slot="close"
        className="catalog-toast-close"
        style={{
          width: catalogDeviceLength("{size.height.M}"),
          height: catalogDeviceLength("{size.height.M}"),
        }}
      >
        <X aria-hidden />
      </Button>
    </RACToast>
  );
}

/** The toast's place in the visible list (0 = the newest, on top). */
function useIndexOf(toast: QueuedToast<ToastValue>): number {
  const state = useContext(RACToastStateContext);
  return state ? state.visibleToasts.indexOf(toast) : 0;
}
