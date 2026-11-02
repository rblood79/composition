/**
 * ADR-300 Phase 2 — the SideNav family's DOM: S2 `SideNavPanel` · `SideNav` as the installed RAC
 * parts (`NavigationTree*` · `Link` · `Button` — D1), the look the catalog rules' generated sheets
 * (D3). `delegatedDom.runtime.ts` describes the tree from the records (no RAC here), this module
 * draws it — so the RAC parts load with it (ADR-300 Decision 7 — a lazy chunk when the Preview
 * bundle needs it).
 *
 * Motion (user decision 2): the DOM runs S2's — the panel's width transition (the rule's
 * `transition`), the panel's content coming back after the width (`side-panel-expand`) and the rows
 * moving on an item's expand · collapse (React `ViewTransition` around each row, S2
 * `SideNav.tsx:66-93`). `prefers-reduced-motion` turns the view transitions off (S2).
 */
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import {
  createContext,
  createElement,
  startTransition,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
  addTransitionType,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { DEFAULT_SLOT } from "react-aria-components";
import { ButtonContext } from "react-aria-components/Button";
import { useLocale } from "react-aria-components/I18nProvider";
import { Link } from "react-aria-components/Link";
import {
  NavigationTree,
  NavigationTreeHeader,
  NavigationTreeItem,
  NavigationTreeItemContent,
  NavigationTreeSection,
} from "react-aria-components/NavigationTree";
import { CatalogCurrentRouteContext } from "./sideNavRoute";

/** S2 `ANIMATION_DURATION` — the panel's width transition (the rule's `transition` 200 ms). */
const PANEL_ANIMATION_MS = 200;
/** S2 view transition types (`SideNav.module.css`) — the SideNav rule's `externalStyles` name them. */
const PANEL_EXPAND = "side-panel-expand";
const ITEM_COLLAPSE = "side-nav-item-collapse";
const ITEM_EXPAND = "side-nav-item-expand";
const ITEM_CLASS = "side-nav-item";
const HEADER_CLASS = "side-nav-header";

/** S2 `viewTransitions.item` — a row animates only in the SideNav's own transitions. */
const ITEM_TRANSITION = {
  default: "none",
  [PANEL_EXPAND]: ITEM_CLASS,
  [ITEM_COLLAPSE]: ITEM_CLASS,
  [ITEM_EXPAND]: ITEM_CLASS,
} as const;

/** S2 `sidepanel.expand` · `sidepanel.collapse` (`@react-spectrum/s2` intl — en · ko). */
const PANEL_BUTTON_LABELS: Readonly<
  Record<string, { expand: string; collapse: string }>
> = {
  en: { expand: "Expand side panel", collapse: "Collapse side panel" },
  ko: { expand: "사이드 패널 확장", collapse: "사이드 패널 축소" },
};

/** S2 `SideNavPanelContext` — the collapse the rows follow (the content's, after the width). */
const SideNavPanelRunContext = createContext<{ isCollapsed: boolean } | null>(
  null,
);
/** Whether the rows · headers take S2's view transitions (off with reduced motion). */
const SideNavMotionContext = createContext(false);

export interface CatalogSideNavPanelProps {
  /** The element's catalog attributes (`data-catalog-id` · class · `data-size` · `data-variant`). */
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly style: CSSProperties;
  readonly label: string | undefined;
  /** `isCollapsed ?? defaultCollapsed` — the record's runtime value in a running Preview. */
  readonly isCollapsed: boolean;
  /** RAC/S2 `onCollapsedChange` — the record's runtime value (absent = a static render). */
  readonly setCollapsed?: (next: boolean) => void;
  /** An interaction rule's `onCollapsedChange` (`withRuntime` puts it on the element). */
  readonly onCollapsedChange?: (next: boolean) => void;
  readonly children?: ReactNode;
  /** What the DOM pass puts on the element (state-style attributes · other rule handlers). */
  readonly [extra: string]: unknown;
}

/**
 * S2 `SideNavPanel` (`SideNavPanel.tsx:96-201`): a `div` (`region` when labelled) whose collapse
 * the rows follow. Collapsing hides the content in the same render that starts the width
 * transition; expanding brings it back when the width is done (`side-panel-expand`). The author's
 * width gives way to the rule's collapsed width while collapsed (S2's inline override). The collapse
 * button is the author's `Button[slot=collapse]` — RAC `ButtonContext` gives it its press and name.
 */
export function CatalogSideNavPanel({
  attributes,
  style,
  label,
  isCollapsed: given,
  setCollapsed: write,
  onCollapsedChange,
  children,
  ...extra
}: CatalogSideNavPanelProps): ReactElement {
  // (A static render keeps the press in this render — S2's uncontrolled panel; a running Preview's
  //  is the record's value.)
  const [own, setOwn] = useState(given);
  const [seen, setSeen] = useState(given);
  if (seen !== given) {
    setSeen(given);
    setOwn(given);
  }
  const isCollapsed = write ? given : own;
  const setCollapsed = write ?? setOwn;
  const reduceMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [contentCollapsed, setContentCollapsed] = useState(isCollapsed);
  if (isCollapsed && !contentCollapsed) setContentCollapsed(true);
  useLayoutEffect(() => {
    if (isCollapsed || !contentCollapsed) return;
    const expand = () =>
      startTransition(() => {
        addTransitionType(PANEL_EXPAND);
        setContentCollapsed(false);
      });
    if (reduceMotion) {
      expand();
      return;
    }
    const panel = ref.current;
    const onEnd = (event: TransitionEvent) => {
      if (event.target === panel && event.propertyName === "width") expand();
    };
    panel?.addEventListener("transitionend", onEnd);
    // (The expanded width may equal the collapsed one — no `transitionend` then.)
    const timeout = setTimeout(expand, PANEL_ANIMATION_MS + 50);
    return () => {
      panel?.removeEventListener("transitionend", onEnd);
      clearTimeout(timeout);
    };
  }, [isCollapsed, contentCollapsed, reduceMotion]);
  const { locale } = useLocale();
  const labels =
    PANEL_BUTTON_LABELS[locale.split("-")[0] ?? "en"] ?? PANEL_BUTTON_LABELS.en;
  const toggle = useCallback(() => {
    setCollapsed(!isCollapsed);
    onCollapsedChange?.(!isCollapsed);
  }, [setCollapsed, onCollapsedChange, isCollapsed]);
  const buttons = useMemo(
    () => ({
      slots: {
        [DEFAULT_SLOT]: {},
        collapse: {
          "aria-label": isCollapsed ? labels.expand : labels.collapse,
          onPress: toggle,
        },
      },
    }),
    [isCollapsed, labels, toggle],
  );
  const panel = useMemo(
    () => ({ isCollapsed: contentCollapsed }),
    [contentCollapsed],
  );
  const { width: _authoredWidth, ...collapsedStyle } = style;
  return createElement(
    SideNavPanelRunContext.Provider,
    { value: panel },
    createElement(
      ButtonContext.Provider,
      { value: buttons as never },
      createElement(
        "div",
        {
          ...attributes,
          ...extra,
          ref,
          ...(label ? { role: "region", "aria-label": label } : {}),
          "data-side-panel-collapsed": contentCollapsed || undefined,
          // (S2 `transition: none` with reduced motion — the rule's width transition stays still.)
          style: {
            ...(isCollapsed ? collapsedStyle : style),
            ...(reduceMotion ? { transitionDuration: "0s" } : {}),
          },
        },
        children,
      ),
    ),
  );
}

/** One row of the tree `delegatedDom.runtime.ts` describes from the item records. */
export interface CatalogSideNavItemEntry {
  readonly kind: "item";
  readonly id: string;
  /** RAC key (`resolveStaticItemKey`). */
  readonly itemKey: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly style?: CSSProperties;
  readonly textValue: string;
  readonly isDisabled: boolean;
  readonly hasChildItems: boolean;
  readonly link: Readonly<Record<string, string>>;
  readonly handlers?: Readonly<Record<string, (...args: unknown[]) => void>>;
  /** The row's own nodes (its SideNavItemContent) as the DOM pass renders them. */
  readonly content: readonly ReactElement[];
  readonly childItems: readonly CatalogSideNavItemEntry[];
}

export interface CatalogSideNavSectionEntry {
  readonly kind: "section";
  readonly id: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly style?: CSSProperties;
  readonly label: string | undefined;
  /** The SideNavHeader node (the DOM pass renders it — `sidenavheader`). */
  readonly header: readonly ReactElement[];
  readonly items: readonly CatalogSideNavItemEntry[];
}

export type CatalogSideNavEntry =
  CatalogSideNavItemEntry | CatalogSideNavSectionEntry;

export interface CatalogSideNavProps {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly style: CSSProperties;
  readonly label: string;
  /** The authored `selectedRoute` (unset = the shown route — user decision 1). */
  readonly selectedRoute: string | undefined;
  /** The stored expanded keys (the record's runtime value in a running Preview). */
  readonly expandedKeys: readonly string[];
  /** Writes the stored keys (absent = a static render — the change stays in this render). */
  readonly setExpandedKeys?: (keys: string[]) => void;
  /** Collapsed by its document panel — read only when no running panel is above (orphan nav). */
  readonly collapsedByDocument: boolean;
  readonly entries: readonly CatalogSideNavEntry[];
  /** What the DOM pass puts on the element (state-style attributes · rule handlers — RAC props). */
  readonly [extra: string]: unknown;
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * S2 `SideNav` (`SideNav.tsx:170-226`) over RAC `NavigationTree`: the items get the effective
 * expanded keys — none in a collapsed panel, the stored keys kept (Decision 4) — and an item's
 * expand · collapse is a transition (`side-nav-item-expand` · `-collapse`) so each row's
 * `ViewTransition` animates it. The keys are this component's state while the transition runs and
 * go to the record's runtime value after it (a store write is never a transition).
 */
export function CatalogSideNav({
  attributes,
  style,
  label,
  selectedRoute,
  expandedKeys,
  setExpandedKeys,
  collapsedByDocument,
  entries,
  onExpandedChange: ruleExpandedChange,
  ...given
}: CatalogSideNavProps): ReactElement {
  const panel = useContext(SideNavPanelRunContext);
  const shownRoute = useContext(CatalogCurrentRouteContext);
  const reduceMotion = usePrefersReducedMotion();
  const [keys, setKeys] = useState<readonly string[]>(expandedKeys);
  const [stored, setStored] = useState<readonly string[]>(expandedKeys);
  // (A rule · the user's change came back as the record's value — or an edit: take it.)
  if (!sameKeys(stored, expandedKeys)) {
    setStored(expandedKeys);
    setKeys(expandedKeys);
  }
  // (The latest writer — a new function each render must not write again.)
  const write = useRef(setExpandedKeys);
  useLayoutEffect(() => {
    write.current = setExpandedKeys;
  });
  useLayoutEffect(() => {
    if (!sameKeys(keys, stored)) write.current?.([...keys]);
  }, [keys, stored]);
  const collapsed = panel ? panel.isCollapsed : collapsedByDocument;
  const visible = collapsed ? [] : keys;
  const onExpandedChange = (next: Set<unknown>) => {
    const list = [...next].map(String);
    startTransition(() => {
      addTransitionType(
        list.length > visible.length ? ITEM_EXPAND : ITEM_COLLAPSE,
      );
      setKeys(list);
    });
    // (An interaction rule's `onExpandedChange` — RAC's callback, the same keys.)
    (ruleExpandedChange as ((keys: Set<unknown>) => void) | undefined)?.(next);
  };
  return createElement(
    SideNavMotionContext.Provider,
    { value: !reduceMotion },
    createElement(
      NavigationTree,
      {
        ...attributes,
        ...given,
        className: "react-aria-SideNav",
        style,
        "aria-label": label,
        selectedRoute: selectedRoute ?? shownRoute ?? null,
        expandedKeys: visible,
        onExpandedChange,
      } as never,
      ...entries.map((entry) =>
        entry.kind === "item"
          ? itemElement(entry, !reduceMotion)
          : sectionElement(entry, !reduceMotion),
      ),
    ),
  );
}

function itemElement(
  entry: CatalogSideNavItemEntry,
  motion: boolean,
): ReactElement {
  return createElement(
    NavigationTreeItem,
    {
      key:
        entry.itemKey === entry.id ? entry.id : `${entry.id}#${entry.itemKey}`,
      ...entry.attributes,
      ...entry.handlers,
      id: entry.itemKey,
      textValue: entry.textValue,
      isDisabled: entry.isDisabled,
      hasChildItems: entry.hasChildItems,
      ...entry.link,
      className: "react-aria-SideNavItem",
      style: entry.style,
      // S2 `SideNavItem` — the row in its view transition.
      render: (domProps: Record<string, unknown>) =>
        createElement(
          ViewTransition,
          { default: motion ? ITEM_TRANSITION : "none" },
          createElement("div", domProps),
        ),
    } as never,
    ...entry.content,
    ...entry.childItems.map((child) => itemElement(child, motion)),
  );
}

function sectionElement(
  entry: CatalogSideNavSectionEntry,
  motion: boolean,
): ReactElement {
  return createElement(
    NavigationTreeSection,
    {
      key: entry.id,
      ...entry.attributes,
      className: "react-aria-SideNavSection",
      style: entry.style,
      ...(entry.label ? { "aria-label": entry.label } : {}),
    } as never,
    ...entry.header,
    ...entry.items.map((item) => itemElement(item, motion)),
  );
}

/** RAC `NavigationTreeItemContent` — no element of its own (the row's gridcell holds its nodes). */
export function catalogSideNavItemContent(
  id: string,
  children: readonly ReactElement[],
): ReactElement {
  return createElement(
    NavigationTreeItemContent,
    { key: id } as never,
    ...children,
  );
}

/** RAC `Link` in the row's `LinkContext` (`href` · `aria-current` · a parent row's expand press). */
export function catalogSideNavItemLink(
  id: string,
  style: CSSProperties,
  children: readonly ReactElement[],
): ReactElement {
  return createElement(
    Link,
    {
      key: id,
      "data-catalog-id": id,
      className: "react-aria-SideNavItemLink",
      style,
    } as never,
    ...children,
  );
}

/** RAC `NavigationTreeHeader` — named for S2's header view transition (`SideNav.tsx:630-636`). */
function SideNavHeaderPart({
  id,
  style,
  children,
}: {
  id: string;
  style: CSSProperties;
  children: readonly ReactElement[];
}): ReactElement {
  const motion = useContext(SideNavMotionContext);
  return createElement(
    NavigationTreeHeader,
    {
      "data-catalog-id": id,
      className: "react-aria-SideNavHeader",
      style: motion
        ? {
            ...style,
            viewTransitionName: `side-nav-header-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
            viewTransitionClass: HEADER_CLASS,
          }
        : style,
    } as never,
    ...children,
  );
}

export function catalogSideNavHeader(
  id: string,
  style: CSSProperties,
  children: readonly ReactElement[],
): ReactElement {
  return createElement(SideNavHeaderPart, { key: id, id, style, children });
}
