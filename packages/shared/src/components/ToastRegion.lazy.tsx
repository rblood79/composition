/**
 * ADR-295 후속 C2 — the toast region (RAC toast primitives + S2's look), loaded with the first toast
 * (`Toast.tsx` `ToastProvider`) so a page that shows none does not carry it in its first bundle.
 *
 * C6 (S2 1.8.1 `Toast.tsx` · `Toast.module.css`): every queue update and the expand · collapse run in
 * a view transition (`document.startViewTransition` + `flushSync`, the type as an html class — the
 * new toast slides in from its edge, a removed one slides out, the stack and the list morph; reduced
 * motion cross-fades); the expanded list takes over the screen as S2's does — `useModalOverlay`
 * (scroll lock · the rest hidden from assistive tech) and `FocusScope contain`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { FocusScope } from "react-aria/FocusScope";
import { useModalOverlay } from "react-aria/useModalOverlay";
import { useOverlayTriggerState } from "react-stately/useOverlayTriggerState";
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

/** S2 `globalReduceMotion` — the region's `prefers-reduced-motion` while it is mounted. */
let reduceMotion = false;

/**
 * S2 `startViewTransition`: the update in a view transition, its type as a class on the html element
 * (Safari has no `:active-view-transition-type()` — `Toast.css` reads the class). No API → the update.
 */
function startViewTransition(fn: () => void, type: string) {
  if (typeof document === "undefined" || !("startViewTransition" in document)) {
    fn();
    return;
  }
  const root = document.documentElement;
  const classes = [`catalog-toast-${type}`];
  if (reduceMotion) classes.push("catalog-toast-reduce-motion");
  root.classList.add(...classes);
  const transition = (
    document as Document & {
      startViewTransition: (update: () => void) => {
        ready: Promise<void>;
        finished: Promise<void>;
      };
    }
  ).startViewTransition(() => flushSync(fn));
  transition.ready.catch(() => {});
  void transition.finished.finally(() => root.classList.remove(...classes));
}

/** The queue the provider fills (S2 `getGlobalToastQueue` — every toast visible, the stack shows them). */
export function createCatalogToastQueue() {
  const queue = new RACToastQueue<ToastValue>({
    maxVisibleToasts: Infinity,
    // (S2: an add · remove · clear is a view transition — `toast-add` · `toast-remove` · `toast-clear`.)
    wrapUpdate: (fn, action) => startViewTransition(fn, action),
  });
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
  align: "center" | "end";
  reduceMotion: boolean;
}
const StackContext = createContext<StackValue>({
  expanded: false,
  toggle: () => {},
  count: 0,
  placement: "bottom",
  align: "center",
  reduceMotion: false,
});

const REDUCED_MOTION = "(prefers-reduced-motion)";
/** S2 `useMediaQuery('(prefers-reduced-motion)')`. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const media = window.matchMedia(REDUCED_MOTION);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && !!window.matchMedia
        ? window.matchMedia(REDUCED_MOTION).matches
        : false,
    () => false,
  );
}

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
  // (S2: the expanded list is an overlay state — `useModalOverlay` below reads it.)
  const state = useOverlayTriggerState({});
  const { isOpen: expanded, close, toggle: flip } = state;
  // (S2: collapsed again when the queue empties.)
  useEffect(() => {
    if (count === 0 && expanded) close();
  }, [count, expanded, close]);
  // (S2 `toggleExpanded`: a single toast does not expand; the change is a view transition.)
  const toggle = useCallback(() => {
    if (!expanded && queue.visibleToasts.length <= 1) return;
    startViewTransition(flip, expanded ? "collapse" : "expand");
  }, [expanded, flip, queue]);
  const messages = useMessages();
  const region = useRef<HTMLDivElement>(null);
  // (S2: collapsing moves focus to the region first — the list's toasts are leaving the screen.)
  const collapse = useCallback(() => {
    region.current?.focus();
    toggle();
  }, [toggle]);
  // S2: the expanded list takes over the screen — scroll lock, the rest hidden from assistive tech
  // (focus is contained by the `FocusScope` below).
  useModalOverlay({}, state, region);
  // (S2: Escape collapses — on the region's element, RAC's region takes no onKeyDown.)
  useEffect(() => {
    const element = region.current;
    if (!element || !expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") collapse();
    };
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [expanded, collapse]);
  const prefersReducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const before = reduceMotion;
    reduceMotion = prefersReducedMotion;
    return () => {
      reduceMotion = before;
    };
  }, [prefersReducedMotion]);
  // (S2: a click on the collapsed stack — not on a button — expands it; native, RAC's list takes no onClick.)
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const element = list.current;
    if (!element || expanded) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.("button")) toggle();
    };
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [expanded, toggle]);
  const stack = useMemo(
    () => ({
      expanded,
      toggle,
      count,
      placement: side,
      align: align === "end" ? ("end" as const) : ("center" as const),
      reduceMotion: prefersReducedMotion,
    }),
    [expanded, toggle, count, side, align, prefersReducedMotion],
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
      <FocusScope contain={expanded}>
        <StackContext.Provider value={stack}>
          {expanded && (
            <div
              className="catalog-toast-backdrop"
              aria-hidden
              onClick={collapse}
            />
          )}
          <RACToastList<ToastValue>
            ref={list}
            className={`catalog-toast-list ${expanded ? "catalog-toast-list-expanded" : "catalog-toast-list-collapsed"}`}
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
          {/* (S2: the controls stay in the DOM — the view transition shows them while it runs.) */}
          <div
            className="catalog-toast-controls"
            data-expanded={expanded || undefined}
          >
            <Button
              className="catalog-toast-control"
              onPress={() => queue.clear()}
            >
              {messages.clearAll}
            </Button>
            <Button className="catalog-toast-control" onPress={collapse}>
              {messages.collapse}
            </Button>
          </div>
        </StackContext.Provider>
      </FocusScope>
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
  const { expanded, toggle, count, placement, align, reduceMotion } =
    useContext(StackContext);
  const toastRef = useRef<HTMLDivElement>(null);
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
          // (S2: a toast's transition name is its key — reduced motion adds its index, so a move
          //  cross-fades instead of sliding.)
          ...viewTransition(toast.key + (reduceMotion ? `-${index}` : ""), [
            "catalog-toast",
            "catalog-toast-bg",
          ]),
        }}
      />
    );
  const Icon = ICONS[variant];
  const single = !isMain || count <= 1 || expanded;
  return (
    <RACToast
      ref={toastRef}
      toast={toast}
      className="catalog-toast"
      data-variant={variant}
      style={{
        ...toastBoxStyle(variant),
        zIndex: count - index - 1,
        ...viewTransition(toast.key, [
          "catalog-toast",
          isMain ? "" : "catalog-toast-bg",
          `catalog-toast-${placement}`,
          align === "end" ? "catalog-toast-end" : "",
        ]),
      }}
    >
      <div
        role="presentation"
        className="catalog-toast-body"
        data-single={single || undefined}
      >
        <RACToastContent
          className={`catalog-toast-content${isMain ? " catalog-toast-vt-content" : ""}`}
        >
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
            className="catalog-toast-expand catalog-toast-vt-expand"
            style={{ minHeight: catalogDeviceLength("{size.height.M}") }}
            onPress={() => {
              // (S2: this button goes away when pressed — focus moves to the toast.)
              toastRef.current?.focus();
              toggle();
            }}
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
        className={`catalog-toast-close${isMain ? " catalog-toast-vt-close" : ""}`}
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

/** S2's per-toast `viewTransitionName` · `viewTransitionClass` (React has no typed key for the class). */
function viewTransition(name: string, classes: string[]): CSSProperties {
  return {
    viewTransitionName: CSS_ESCAPE(name),
    viewTransitionClass: classes.filter(Boolean).join(" "),
  } as CSSProperties;
}
/** (A toast key is a generated id — escaped for a CSS identifier, S2 `CSS.escape`.) */
const CSS_ESCAPE = (value: string) =>
  typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, "_");

/** The toast's place in the visible list (0 = the newest, on top). */
function useIndexOf(toast: QueuedToast<ToastValue>): number {
  const state = useContext(RACToastStateContext);
  return state ? state.visibleToasts.indexOf(toast) : 0;
}
