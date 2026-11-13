import {
  cloneElement,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactElement,
} from "react";

import { I18nProvider } from "react-aria-components";
import { Breadcrumb as AriaBreadcrumb } from "react-aria-components/Breadcrumbs";
import { Button as AriaButton } from "react-aria-components/Button";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
} from "react-aria-components/Menu";
import { Popover as AriaPopover } from "react-aria-components/Popover";
import type { Key } from "react-aria-components/Collection";

import {
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
} from "react-aria-components/ListBox";

import {
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
} from "react-aria-components/TagGroup";

import { ToggleGroupStateContext } from "react-aria-components/ToggleButtonGroup";

import {
  TagMaxRowsMirror,
  useTagMaxRows,
  useTagRowsState,
} from "../../components/TagGroup";

import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Icon } from "../../components/Icon";
import {
  CATALOG_BREADCRUMB_MENU,
  catalogBreadcrumbsCollapse,
  catalogBreadcrumbsVisibleCount,
} from "./breadcrumbsCollapse";
import { CatalogCalendarPickerContext } from "./calendarPickerContext";
import { catalogDeviceScaledCss } from "./deviceTypography";
import { useCatalogDeviceUnit } from "./deviceUnit.runtime";

import {
  catalogControlledProps,
  catalogRuntimeStateOf,
  catalogSelectionValue,
  SELECTED_KEYS,
} from "./runtimeStateProps";
import { catalogForwardHandlers, catalogStateFrame } from "./stateFrames";

import {
  AuthoredDomAttributes,
  bool,
  catalogTypeName,
  childrenOf,
  DelegatedDomInput,
  marker,
  catalogEmptyState,
  renderAll,
  str,
  tagChipText,
  tagGroupLabelled,
  TagGroupRunContext,
  tagGroupTags,
  tagKey,
  ToggleIndicatorContext,
} from "./delegatedDom.runtime";
import { catalogBindValueText } from "./valueBindings";

export function ToggleIndicatorPart({
  type,
  nodeKey,
}: {
  type: string;
  nodeKey: string;
}): ReactElement | null {
  const toggle = useContext(ToggleIndicatorContext);
  return toggle?.indicators[type]?.(nodeKey, toggle.state) ?? null;
}

/**
 * A ToggleButton outside a group: its selection held here (RAC's uncontrolled state, made
 * controlled), passed down as its state frame (ADR-256 Decision 7).
 */
export function SelfToggleButton({
  ownerId,
  defaultSelected,
  selected,
  onSelectedChange,
  isDisabled,
  render,
  ...handlers
}: {
  ownerId: string;
  defaultSelected: boolean;
  /** ADR-280 — a running Preview's controlled selection (the record's runtime value). */
  selected?: boolean;
  onSelectedChange?: (next: boolean) => void;
  isDisabled: boolean;
  render: (selection: Record<string, unknown>) => ReactElement;
} & Record<string, unknown>): ReactElement {
  const [own, setOwn] = useState(defaultSelected);
  const isSelected = selected ?? own;
  const setSelected = onSelectedChange ?? setOwn;
  return catalogStateFrame(
    ownerId,
    ownerId,
    { isSelected, isDisabled },
    catalogForwardHandlers(
      render({ isSelected, onChange: setSelected }),
      handlers,
    ),
  );
}

/**
 * A ToggleButton in a group: its selection is the group's RAC state (`ToggleGroupStateContext` —
 * its key is the item's `id`, `itemKey` — ADR-308 R9), passed down as its state frame (identified
 * by the record) so the `showWhen` nodes inside follow a Preview press (ADR-256 후속 18 — the
 * shared ToggleButton draws children, not RAC's function).
 */
export function GroupToggleFrame({
  ownerId,
  itemKey,
  isDisabled,
  children,
  ...handlers
}: {
  ownerId: string;
  itemKey: string;
  isDisabled: boolean;
  children: ReactElement;
} & Record<string, unknown>): ReactElement {
  const group = useContext(ToggleGroupStateContext);
  return catalogStateFrame(
    ownerId,
    ownerId,
    {
      isSelected: !!group?.selectedKeys.has(itemKey),
      isDisabled: isDisabled || !!group?.isDisabled,
    },
    catalogForwardHandlers(children, handlers),
  );
}

export function CalendarPickerSelect({
  element,
  ...handlers
}: {
  element: ReactElement;
} & Record<string, unknown>): ReactElement {
  const picker = useContext(CatalogCalendarPickerContext);
  // (ADR-280 — the rules' handlers `withRuntime` gave this wrapper reach the Select, after the
  // picker's own change.)
  const forwarded = catalogForwardHandlers(element, handlers);
  if (!picker) return forwarded;
  const ruleChange = (forwarded.props as Record<string, unknown>).onChange as
    ((value: unknown) => void) | undefined;
  return cloneElement(forwarded as ReactElement<Record<string, unknown>>, {
    "aria-label": picker.aria["aria-label"],
    value: picker.aria.value,
    onChange: (value: unknown) => {
      (picker.aria.onChange as (value: unknown) => void)(value);
      ruleChange?.(value);
    },
  });
}

/**
 * ADR-280 Decision 5 — an `I18nProvider` around a RAC field (a locale · calendar system): the
 * rules' handlers `withRuntime` gives the provider go on to the field inside.
 */
export function ForwardingI18nProvider({
  locale,
  element,
  ...handlers
}: {
  locale: string;
  element: ReactElement;
} & Record<string, unknown>): ReactElement {
  return createElement(
    I18nProvider as ElementType,
    { locale },
    catalogForwardHandlers(element, handlers),
  );
}

/**
 * ADR-280 Decision 5 — the `display: contents` marker around a component with no DOM of its own
 * (FileTrigger · DataField): the rules' handlers go to the component, not to the marker `div`.
 */
export function ForwardingMarker({
  markerProps,
  element,
  ...handlers
}: {
  markerProps: Record<string, unknown>;
  element: ReactElement;
} & Record<string, unknown>): ReactElement {
  return createElement(
    "div",
    markerProps,
    catalogForwardHandlers(element, handlers),
  );
}

/**
 * ADR-256 Phase 9 — a calendar picker's ListBox: RAC's items (the picker's render props) drawn by
 * the item node — `id` · `textValue` RAC's, its children under the picker's frame (`{formatted}`).
 */
export function CalendarPickerList({
  listProps,
  itemId,
  itemText,
  renderItemChildren,
}: {
  listProps: Record<string, unknown>;
  itemId: string | undefined;
  itemText: string;
  renderItemChildren: () => ReactElement[];
}): ReactElement {
  const picker = useContext(CatalogCalendarPickerContext);
  return createElement(AriaListBox as ElementType, {
    ...listProps,
    items: picker?.aria.items ?? [],
    children: (entry: { id: string | number; formatted: string }) =>
      createElement(
        AriaListBoxItem as ElementType,
        {
          id: entry.id,
          textValue: entry.formatted,
          "data-catalog-id": itemId,
          className: "react-aria-ListBoxItem",
        },
        ...(() => {
          const kids = renderItemChildren();
          // (Its own text with RAC's `formatted` bound — the reference's plain item text.)
          if (!kids.length)
            return [
              catalogBindValueText(itemText, (key) =>
                key === "formatted"
                  ? { linked: true, value: entry.formatted }
                  : { linked: false, value: undefined },
              ),
            ];
          return picker
            ? [
                catalogStateFrame(
                  `${picker.ownerId}:${String(entry.id)}`,
                  picker.ownerId,
                  { formatted: entry.formatted },
                  createElement(Fragment, null, ...kids),
                ),
              ]
            : kids;
        })(),
      ),
  });
}

export function TagGroupRun({
  input,
  ...authored
}: { input: DelegatedDomInput } & AuthoredDomAttributes): ReactElement {
  const props = input.node.props;
  // (The reference's `onRemove` — a removed tag leaves the list: Preview run state, the document
  // keeps it. RAC shows a tag's remove button only with one.)
  const [removed, setRemoved] = useState<ReadonlySet<Key>>(() => new Set());
  const rows = useTagRowsState();
  const label = str(props.label).trim();
  const named = tagGroupLabelled(input.root, input.node);
  const size = str(props.size) || "M";
  const labelPosition = str(props.labelPosition) || "top";
  const tags = tagGroupTags(input.root, input.node);
  const allTags = () => tags.map(tagKey);
  // A selected Tag is the group's selection (RAC · S2 Tag has no `variant`): its Selected
  // (`isSelected`) hands RAC the key (`defaultSelectedKeys` — RAC selects only in a selection
  // mode, as the Canvas `catalogCollectionItemSelected`). A changed authored set remounts RAC's
  // group (its uncontrolled selection), as ToggleButtonGroup.
  // ADR-280 — a running Preview controls it from the record's runtime value (one function with
  // the dispatcher — `catalogRuntimeStateOf`).
  const selectedKeys = catalogRuntimeStateOf(
    input.root,
    input.root.domInputs.get(input.node.id) ?? input.node,
    input.runtimeProps?.(input.node.id),
    "selectedKeys",
  ) as string[];
  return createElement(
    TagGroupRunContext.Provider,
    {
      value: {
        maxRows:
          typeof props.maxRows === "number" && props.maxRows > 0
            ? props.maxRows
            : undefined,
        size,
        labelPosition,
        removed,
        rows,
      },
    },
    createElement(
      AriaTagGroup as ElementType,
      {
        ...marker(input),
        style: input.style,
        className: "react-aria-TagGroup",
        "data-tag-variant": str(props.variant) || "default",
        "data-tag-size": size,
        // (S2 `isEmphasized` — its selected Tags are accent: `TagGroup.css`.)
        "data-emphasized": bool(props.isEmphasized) || undefined,
        "data-label-position": labelPosition,
        // (S2 start · end — start is the sheet's default, so only end is an attribute.)
        "data-label-align": props.labelAlign === "end" ? "end" : undefined,
        key: input.setRuntimeProps
          ? marker(input).key
          : `selected:${[...selectedKeys].join(",")}`,
        ...catalogControlledProps(
          input.node.id,
          input.setRuntimeProps,
          SELECTED_KEYS,
          selectedKeys,
          catalogSelectionValue,
        ),
        // (Without a visible label the group is named by its `label` — RAC needs a name.)
        "aria-label": named ? undefined : label || "Tag group",
        selectionMode: props.selectionMode ?? "none",
        selectionBehavior: props.selectionBehavior || "toggle",
        disallowEmptySelection: bool(props.disallowEmptySelection),
        onRemove: bool(props.allowsRemoving)
          ? (keys: "all" | Iterable<Key>) =>
              setRemoved(
                (previous) =>
                  new Set([
                    ...previous,
                    ...(keys === "all" ? allTags() : keys),
                  ]),
              )
          : undefined,
        ...authored,
      },
      ...renderAll(input),
    ),
  );
}

export function TagListRun({
  input,
  ...authored
}: { input: DelegatedDomInput } & AuthoredDomAttributes): ReactElement {
  const run = useContext(TagGroupRunContext);
  const tags = childrenOf(input.root, input.node).filter(
    (child) =>
      catalogTypeName(input.root, child) === "Tag" &&
      !run?.removed.has(tagKey(child)),
  );
  const size = run?.size ?? (str(input.node.props.size) || "M");
  const labelPosition = run?.labelPosition ?? "top";
  const {
    hiddenRef,
    wrapperRef,
    hasMaxRows,
    isCollapsed,
    setIsCollapsed,
    showCollapsed,
    visibleTagCount,
  } = useTagMaxRows(
    run?.maxRows,
    run?.rows,
    // (The chips the mirror measures — a Tag added, removed or relabelled is counted again.)
    tags.map((tag) => tagChipText(input.root, tag)).join("\u0000"),
  );
  const shown = showCollapsed ? tags.slice(0, visibleTagCount) : tags;
  const showButton = (label: string, collapse: boolean) =>
    createElement(
      "button",
      {
        className: "tag-show-all-btn",
        type: "button",
        onClick: () => setIsCollapsed(collapse),
      },
      label,
    );
  return createElement(
    "div",
    {
      ...marker(input),
      ref: wrapperRef,
      style: input.style,
      ...authored,
      // (The chip box's class and the author's — not RAC's `react-aria-TagList`, which is the
      // `display: contents` list inside.)
      className: ["tag-list-wrapper", input.node.className]
        .filter(Boolean)
        .join(" "),
    },
    hasMaxRows
      ? createElement(TagMaxRowsMirror, {
          hiddenRef,
          size,
          labelPosition,
          entries: tags.map((tag) => ({
            text: tagChipText(input.root, tag),
            icon: null,
            avatar: null,
          })),
          // (ADR-295 후속: the chips' box and gap are the visible ones' — a chip is an S2 control box,
          // `minHeight` the size's control height token (Tag rule — the touch set too), the gap the
          // TagList record's. Without them the mirror's chips were 28 tall and 4 apart.)
          chipStyle: {
            boxSizing: "border-box",
            minHeight: `var(--catalog-token-size-height-${size})`,
          },
          gap: `${Number(input.node.visual.gap ?? 8)}px`,
        })
      : null,
    createElement(
      AriaTagList as ElementType,
      // (Its IllustratedMessage child while it has no tags — RAC `renderEmptyState`.)
      { className: "react-aria-TagList", ...catalogEmptyState(input) },
      ...shown.map((tag) => input.renderChild(tag.id)),
    ),
    showCollapsed && visibleTagCount < tags.length
      ? showButton(`Show all (${tags.length})`, false)
      : null,
    hasMaxRows && !isCollapsed ? showButton("Show less", true) : null,
  );
}

/** A crumb's label text and link (its folder menu item — S2 `BreadcrumbMenu` `MenuItem`). */
function breadcrumbMenuItem(
  input: DelegatedDomInput,
  crumb: DelegatedDomInput["node"],
): { text: string; href: string | undefined } {
  const content = childrenOf(input.root, crumb).filter(
    (child) => child.props.slot !== "separator",
  );
  const text = content
    .map((child) => child.derivedProps?.children ?? child.props.children)
    .filter((value): value is string => typeof value === "string" && !!value)
    .join(" ");
  const href = [crumb, ...content]
    .map((node) => node.props.href)
    .find((value): value is string => typeof value === "string" && !!value);
  return { text, href };
}

/**
 * S2 Breadcrumbs (`Breadcrumbs.tsx` — `CollapsingCollection`): RAC Breadcrumbs of the crumb nodes that
 * collapses the crumbs that do not fit (or past four) into a folder menu after the first crumb. The
 * judgement is `breadcrumbsCollapse.ts`, the Canvas's too (`settleBreadcrumbs`): every crumb is
 * rendered and measured (before paint), then the list renders collapsed; a resize measures again.
 */
export function BreadcrumbsRun({
  input,
  ...authored
}: { input: DelegatedDomInput } & AuthoredDomAttributes): ReactElement {
  const props = input.node.props;
  const crumbs = childrenOf(input.root, input.node).filter(
    (child) => catalogTypeName(input.root, child) === "Breadcrumb",
  );
  const unit = useCatalogDeviceUnit();
  const listRef = useRef<HTMLOListElement | null>(null);
  // (What the crumbs show: a crumb added, removed or relabelled is measured again.)
  const signature = [
    str(props.size || "M"),
    ...crumbs.map(
      (crumb) => `${crumb.id}\u0001${breadcrumbMenuItem(input, crumb).text}`,
    ),
  ].join("\u0000");
  const [epoch, setEpoch] = useState(0);
  const key = `${signature}\u0002${epoch}`;
  const [measured, setMeasured] = useState<{ key: string; visible: number }>();
  const measuring = measured?.key !== key;
  const settledWidth = useRef<number | undefined>(undefined);
  const attempts = useRef(0);
  const settledKey = useRef<string | undefined>(undefined);
  const [, setRetry] = useState(0);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!measuring) {
      // (The list's width right after it renders the judgement — a later resize measures again.)
      if (settledKey.current !== key) {
        settledKey.current = key;
        settledWidth.current = list.getBoundingClientRect().width;
      }
      return;
    }
    // (The crumbs only — a folder crumb still shown from the collapse before is not one.)
    const items = [...list.children].filter(
      (element) =>
        element.classList.contains("react-aria-Breadcrumb") &&
        !element.classList.contains("breadcrumb-menu"),
    );
    // (RAC renders its collection's items after it builds the collection — a commit later: measure
    //   once they are all there, rendering again (a few times at most) until then.)
    if (items.length !== crumbs.length) {
      if (attempts.current < 3) {
        attempts.current++;
        setRetry((value) => value + 1);
      }
      return;
    }
    attempts.current = 0;
    const style = getComputedStyle(list);
    setMeasured({
      key,
      visible: catalogBreadcrumbsVisibleCount(
        items.map((item) => item.getBoundingClientRect().width),
        list.getBoundingClientRect().width,
        Number.parseFloat(style.columnGap || style.gap) || 0,
        CATALOG_BREADCRUMB_MENU.button * unit,
      ),
    });
  });
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = list.getBoundingClientRect().width;
      if (
        settledWidth.current !== undefined &&
        Math.abs(width - settledWidth.current) < 0.5
      )
        return;
      setEpoch((value) => value + 1);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const collapse = measuring
    ? undefined
    : catalogBreadcrumbsCollapse(crumbs, measured!.visible);
  const isDisabled = bool(props.isDisabled);
  const menu = () => {
    // (The separator after the folder: the first crumb's separator Icon — S2's Chevron.)
    const separator = childrenOf(input.root, crumbs[0]!).find(
      (child) =>
        catalogTypeName(input.root, child) === "Icon" &&
        child.props.slot === "separator",
    );
    const separatorSize =
      typeof separator?.visual.iconSize === "number"
        ? separator.visual.iconSize
        : 10;
    const separatorSide = catalogDeviceScaledCss(separatorSize);
    // (S2 ActionButton M's icon: `1lh` of its font.)
    const glyph =
      "calc(var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height))";
    return createElement(
      AriaBreadcrumb as ElementType,
      {
        key: "__breadcrumb-menu",
        id: "__breadcrumb-menu",
        className: "react-aria-Breadcrumb breadcrumb-menu",
        style: {
          gap: 0,
          marginInlineStart: catalogDeviceScaledCss(
            CATALOG_BREADCRUMB_MENU.marginStart,
          ),
        },
      },
      createElement(
        AriaMenuTrigger,
        null,
        createElement(
          AriaButton as ElementType,
          {
            className: "react-aria-ActionButton breadcrumb-menu-button",
            "data-variant": "default",
            "data-size": "M",
            "data-quiet": true,
            "aria-label": "More items",
            isDisabled,
            style: {
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              width: catalogDeviceScaledCss(CATALOG_BREADCRUMB_MENU.button),
              height: catalogDeviceScaledCss(CATALOG_BREADCRUMB_MENU.button),
            },
          },
          createElement(Icon, {
            // (The Breadcrumbs' `menuIcon` — S2's FolderBreadcrumb by default.)
            iconName:
              typeof props.menuIcon === "string" && props.menuIcon
                ? props.menuIcon
                : "s2-folder-breadcrumb",
            style: { fontSize: glyph, width: glyph, height: glyph },
          }),
        ),
        createElement(
          AriaPopover as ElementType,
          // (S2 `BreadcrumbMenu`'s Menu is the default M — the generated Menu sheet's popover box.)
          {
            className: "react-aria-Popover",
            placement: "bottom start",
            "data-size": "M",
          },
          createElement(
            AriaMenu as ElementType,
            {
              className: "react-aria-Menu",
              "aria-label": "More items",
              "data-size": "M",
            },
            ...(collapse?.hidden ?? []).map((crumb) => {
              const { text, href } = breadcrumbMenuItem(input, crumb);
              return createElement(
                AriaMenuItem as ElementType,
                {
                  key: crumb.id,
                  id: crumb.id,
                  href,
                  textValue: text,
                  className: "react-aria-MenuItem",
                  "data-size": "M",
                },
                text,
              );
            }),
          ),
        ),
      ),
      createElement(Icon, {
        iconName: String(
          separator?.derivedProps?.iconName ??
            separator?.derivedProps?._ownerIconName ??
            separator?.props.iconName ??
            "s2-chevron",
        ),
        style: {
          fontSize: separatorSide,
          width: separatorSide,
          height: separatorSide,
          color: String(separator?.visual.color ?? "var(--fg)"),
        },
      }),
    );
  };
  const rendered = collapse
    ? [
        ...renderAll(input, [crumbs[0]!]),
        menu(),
        ...renderAll(
          input,
          crumbs.slice(1).filter((crumb) => !collapse.hidden.includes(crumb)),
        ),
      ]
    : renderAll(input, crumbs);
  return createElement(
    Breadcrumbs as ElementType,
    {
      ...marker(input),
      ref: listRef,
      style: input.style,
      "data-size": str(props.size || "M"),
      "data-variant": str(props.variant || "default"),
      "aria-label":
        typeof props["aria-label"] === "string" ? props["aria-label"] : undefined,
      size: props.size,
      isDisabled,
      // (What the runtime adds on the element — a rule's `onAction` — reaches RAC.)
      ...authored,
    },
    ...rendered,
  );
}
