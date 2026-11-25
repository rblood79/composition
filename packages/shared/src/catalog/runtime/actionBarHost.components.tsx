import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { announce } from "react-aria/private/live-announcer/LiveAnnouncer";
import {
  useEnterAnimation,
  useExitAnimation,
} from "react-aria/private/utils/animation";
import { mergeRefs } from "react-aria/mergeRefs";
import { ActionBar } from "../../components/ActionBar";
import {
  CATALOG_ACTION_BAR_INSET,
  catalogActionBarPlacement,
} from "./actionBarContainer";
import { catalogLocalized } from "./localizedStrings";

/**
 * S2 `renderActionBar` (CardView · TableView · TreeView — S2 체크리스트 부록 D.3 2단계, 2026-11-23):
 * the collection with an ActionBar child is drawn S2's way — a wrapper `div` (the ActionBar cannot
 * be inside the RAC GridList · Tree · Table: ARIA and focus) holding the collection and its bar,
 * which floats over the wrapper's bottom. The wrapper takes the record's outer box (size · margin ·
 * place); the collection fills it, with the bar's room as its bottom padding while the bar shows
 * (S2's inline `paddingBottom` · `scrollPaddingBottom`).
 */

/** The record's style keys that place its box among its siblings — the wrapper's. */
const OUTER_KEYS: ReadonlySet<string> = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "marginInline",
  "marginBlock",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "gridArea",
  "gridColumn",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRow",
  "gridRowStart",
  "gridRowEnd",
  "order",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "zIndex",
]);

/** The record's style split into the wrapper's (outer box) and the collection's (the rest). */
export function catalogActionBarHostStyles(
  style: CSSProperties | undefined,
  space: number | undefined,
): { outer: CSSProperties; inner: CSSProperties } {
  const outer: Record<string, unknown> = { position: "relative" };
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style ?? {}))
    (OUTER_KEYS.has(key) ? outer : inner)[key] = value;
  if (outer.position === "static" || outer.position === undefined)
    outer.position = "relative";
  inner.boxSizing = "border-box";
  inner.width = "100%";
  if (outer.height !== undefined && outer.height !== "auto")
    inner.height = "100%";
  if (space !== undefined) {
    inner.paddingBottom = `${space}px`;
    inner.scrollPaddingBottom = `${space}px`;
  }
  return { outer: outer as CSSProperties, inner: inner as CSSProperties };
}

/** The collection's scroll box the bar sits over (S2 `scrollRef`) — its scrollbar's width. */
const CatalogActionBarHostContext = createContext<{
  scrollbarWidth: number;
} | null>(null);

/**
 * The collection element and its action bar in S2's wrapper. `host` is the collection's element
 * type (the RAC GridList · Tree · Table component); every other prop is the collection's (rule
 * handlers reach it through this element — `withRuntime`).
 */
export function CatalogActionBarHost({
  host,
  actionBar,
  actionBarSpace,
  style,
  ref,
  ...props
}: Record<string, unknown> & {
  host: ElementType;
  actionBar: ReactNode;
  /** The bar's room while it shows (`catalogActionBarSpace`); undefined while it is hidden. */
  actionBarSpace?: number;
  style?: CSSProperties;
  ref?: Ref<HTMLElement>;
}): ReactElement {
  const { outer, inner } = catalogActionBarHostStyles(style, actionBarSpace);
  const scroll = useRef<HTMLElement | null>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  // (S2 `ActionBarInner` — the bar's end inset adds the collection's scrollbar.)
  useEffect(() => {
    const element = scroll.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    // (Its scrollbar only — `offsetWidth - clientWidth` also counts the side borders.)
    const measure = () => {
      const style = getComputedStyle(element);
      const borders =
        (Number.parseFloat(style.borderLeftWidth) || 0) +
        (Number.parseFloat(style.borderRightWidth) || 0);
      setScrollbarWidth(
        Math.max(0, element.offsetWidth - element.clientWidth - borders),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const setScroll = useCallback((element: unknown) => {
    scroll.current = element instanceof HTMLElement ? element : null;
  }, []);
  return createElement(
    "div",
    { className: "react-aria-ActionBarContainer", style: outer },
    createElement(host, {
      ...props,
      style: inner,
      ref: mergeRefs(ref, setScroll as Ref<HTMLElement>),
    }),
    createElement(
      CatalogActionBarHostContext.Provider,
      { value: { scrollbarWidth } },
      actionBar,
    ),
  );
}

/** S2 intl `actionbar.actionsAvailable` (en · ko · ja · zh — the bar's other names' languages). */
const ACTIONS_AVAILABLE: Readonly<Record<string, string>> = {
  en: "Actions available.",
  ko: "사용 가능한 액션",
  ja: "アクションを利用できます。",
  zh: "有可用操作。",
};

/**
 * A collection's ActionBar (S2 `ActionBar` with `scrollRef`): absolute over the collection's bottom,
 * sliding in and out (S2 `translateY` · 200ms — kept while it leaves, with its last count), saying
 * 「Actions available」 when it comes (`announce`).
 */
export function CatalogLinkedActionBar(
  props: Record<string, unknown> & {
    count: number | "all";
    style?: CSSProperties;
    children?: ReactNode;
  },
): ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null);
  const isOpen = props.count !== 0;
  const isExiting = useExitAnimation(ref, isOpen);
  if (!isOpen && !isExiting) return null;
  return createElement(LinkedActionBarInner, {
    ...props,
    barRef: ref,
    isExiting,
  });
}

function LinkedActionBarInner({
  count,
  style,
  children,
  barRef,
  isExiting,
  ...props
}: Record<string, unknown> & {
  count: number | "all";
  style?: CSSProperties;
  children?: ReactNode;
  barRef: { current: HTMLDivElement | null };
  isExiting: boolean;
}): ReactElement {
  const host = useContext(CatalogActionBarHostContext);
  const { locale } = useLocale();
  const isEntering = useEnterAnimation(barRef);
  // (The last count while it leaves — S2 `lastCount`.)
  const [lastCount, setLastCount] = useState(count);
  if (count !== 0 && count !== lastCount) setLastCount(count);
  // (S2: 「actions available」 once, when it comes.)
  useEffect(() => {
    announce(catalogLocalized(ACTIONS_AVAILABLE, locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const placement = catalogActionBarPlacement();
  const offscreen = isEntering || isExiting;
  return createElement(
    ActionBar,
    {
      ...props,
      ref: barRef,
      selectedItemCount: count === 0 ? lastCount : count,
      "data-in-container": "",
      style: {
        ...style,
        position: placement.position,
        left: placement.insetLeft,
        right: `${CATALOG_ACTION_BAR_INSET + (host?.scrollbarWidth ?? 0)}px`,
        bottom: 0,
        width: placement.width,
        maxWidth: placement.maxWidth,
        marginLeft: placement.marginLeft,
        marginRight: placement.marginRight,
        boxSizing: "border-box",
        // (S2 `translateY: -8` at rest, `full` while it comes and goes.)
        transform: offscreen
          ? "translateY(100%)"
          : `translateY(-${CATALOG_ACTION_BAR_INSET}px)`,
        transition: "transform 200ms",
      },
    } as Record<string, unknown>,
    children,
  );
}
