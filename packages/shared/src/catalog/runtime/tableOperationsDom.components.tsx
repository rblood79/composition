import { CATALOG_SORT_MARK } from "./presence";

import {
  createElement,
  type CSSProperties,
  Fragment,
  lazy,
  type ReactElement,
  Suspense,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "react-aria-components/Button";
import { useLocale } from "react-aria-components/I18nProvider";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { TableColumnResizeStateContext } from "react-aria-components/Table";
import {
  CATALOG_RESIZED_TRACKS_VAR,
  CatalogColumnMenuContext,
  CatalogColumnSortContext,
} from "./tableOperationsDom.runtime";
import type {
  CatalogColumnMenuItem,
  CatalogColumnMenuItemId,
} from "./tableColumnMenu";
import { catalogLocalized } from "./localizedStrings";
import { CATALOG_GLYPH_1EM, catalogLucideGlyph } from "./lucideGlyph";

/**
 * Inside a Column of a resizable Table: writes RAC's column widths (in collection order — the
 * shown Columns, as the tracks) on its `<table>` as `--table-resized-tracks`.
 */
export function CatalogTableResizeTracks(): ReactNode {
  const layout = useContext(TableColumnResizeStateContext);
  const probe = useRef<HTMLSpanElement>(null);
  const tracks = layout
    ? [...layout.tableState.collection.columns]
        .map((column) => `${layout.getColumnWidth(column.key)}px`)
        .join(" ")
    : "";
  useLayoutEffect(() => {
    const table = probe.current?.closest("table");
    if (!table) return;
    if (tracks) table.style.setProperty(CATALOG_RESIZED_TRACKS_VAR, tracks);
    else table.style.removeProperty(CATALOG_RESIZED_TRACKS_VAR);
  }, [tracks]);
  return <span ref={probe} hidden />;
}

/**
 * ADR-315 Phase 4 — inside a pinned Column: its Table's pinned columns stay in view past the
 * pinned columns before them, so their widths are measured off the header's pinned Columns
 * (`data-pinned` · `data-pinned-at` — `catalogTablePinnedProps`) and written on the Table as
 * `--table-pin-start-<n>` · `--table-pin-end-<n>`: the inset of that side's `n`th pinned column —
 * the widths before it. (The tracks are CSS — `minmax(75px, 1fr)` …: a column's px is known once
 * laid out.) Each pinned Column watches its own header; any of them writes the whole Table's.
 */
export function CatalogTablePinMeasure(): ReactNode {
  const probe = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = probe.current?.closest<HTMLElement>('[role="columnheader"]');
    const table = header?.closest<HTMLElement>("[data-node-table]");
    if (!header || !table) return;
    const write = () => catalogWriteTablePins(table);
    write();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(write);
    observer.observe(header);
    return () => observer.disconnect();
  });
  return <span ref={probe} hidden />;
}
/** A Table's pinned columns' insets, written on it (`CatalogTablePinMeasure`). */
function catalogWriteTablePins(table: HTMLElement): void {
  const widths: Record<"start" | "end", number[]> = { start: [], end: [] };
  for (const header of table.querySelectorAll<HTMLElement>(
    '[role="columnheader"][data-pinned]',
  )) {
    const side = header.dataset.pinned === "end" ? "end" : "start";
    widths[side][Number(header.dataset.pinnedAt)] =
      header.getBoundingClientRect().width;
  }
  for (const side of ["start", "end"] as const) {
    let inset = 0;
    for (let at = 0; at < widths[side].length; at += 1) {
      const name = `--table-pin-${side}-${at}`;
      const value = `${inset}px`;
      if (table.style.getPropertyValue(name) !== value)
        table.style.setProperty(name, value);
      inset += widths[side][at] ?? 0;
    }
  }
}

/**
 * S2 `ColumnContents` sort arrow: `SortUpArrow` while ascending, `SortDownArrow` while descending,
 * nothing while the column is not sorted (`sortDirection != null &&`). S2 `sortIcon` — 16px
 * (`fontRelative(16)`), `marginEnd: 8`, no shrink, the current color. (Our glyphs: lucide
 * `arrow-up` · `arrow-down` — the icon set is not S2's.)
 *
 * Inline, on the middle of its line: a Column whose content is a bare text (no content wrapper —
 * `catalogColumnSortsInline`) holds the arrow in its own block, where an `svg` — a block in the
 * Preview's sheet — took a line above the name: the sorted header 16px taller than the others
 * (live, 2026-11-20). In a content wrapper (a flex row) the arrow is a flex item either way.
 */
export function CatalogSortIndicator(): ReactNode {
  const sort = useContext(CatalogColumnSortContext);
  const direction = sort?.direction;
  if (direction !== "ascending" && direction !== "descending") return null;
  const order = sort?.order;
  const arrow = catalogLucideGlyph(
    direction === "ascending" ? "arrow-up" : "arrow-down",
    {
      key: "arrow",
      className: "sort-indicator",
      "data-sort-direction": direction,
      width: CATALOG_SORT_MARK.arrow,
      height: CATALOG_SORT_MARK.arrow,
      style: {
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        // (In a sort of several columns the order mark follows the arrow and takes its gap.)
        marginInlineEnd:
          order === undefined
            ? CATALOG_SORT_MARK.end
            : CATALOG_SORT_MARK.orderGap,
      },
    },
  );
  if (order === undefined) return arrow;
  // ADR-315 Phase 2 — a sort of several columns: this Column's place in it, after its arrow. RAC
  // gives `aria-sort` to the first sorted header only (APG — one header at a time); the mark is the
  // sighted cue. ADR-315 Phase 4 증분 6 — arrow and order are one box (the Canvas lays the same box
  // out — `catalogSortMarkWidth`): fixed px, the digits from its start at a fixed advance — no measure.
  const digits = String(order).length;
  return createElement(
    "span",
    {
      className: "sort-mark",
      "aria-hidden": true,
      style: {
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
        flexShrink: 0,
        height: CATALOG_SORT_MARK.arrow,
        marginInlineEnd: CATALOG_SORT_MARK.end,
      },
    },
    arrow,
    createElement(
      "span",
      {
        key: "order",
        className: "sort-order",
        "data-sort-order": order,
        style: {
          display: "inline-block",
          flexShrink: 0,
          width: digits * CATALOG_SORT_MARK.digit,
          fontSize: CATALOG_SORT_MARK.orderFont,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        },
      },
      String(order),
    ),
  );
}

/**
 * S2 1.8.2 `table.sortAscending` · `table.sortDescending` · `table.resizeColumn`
 * (`@react-spectrum/s2` intl) in the languages the Builder ships; others English. ADR-315 Phase 4
 * adds the items S2 has no string for (composition's — breakdown §5.3): add to sort, hide, pin,
 * move. A move names the screen side: `before` is the left in a left-to-right locale.
 */
interface ColumnMenuStrings {
  readonly asc: string;
  readonly desc: string;
  readonly resize: string;
  readonly add: string;
  readonly filter: string;
  readonly clearFilter: string;
  readonly hide: string;
  readonly pinStart: string;
  readonly pinEnd: string;
  readonly unpin: string;
  readonly left: string;
  readonly right: string;
  /** ADR-315 Phase 5 — group the Table's rows by the Column · stop. */
  readonly group: string;
  readonly ungroup: string;
}
const COLUMN_MENU_STRINGS: Readonly<Record<string, ColumnMenuStrings>> = {
  en: {
    asc: "Sort Ascending",
    desc: "Sort Descending",
    resize: "Resize column",
    add: "Add to sort",
    filter: "Filter…",
    clearFilter: "Clear filter",
    hide: "Hide column",
    pinStart: "Pin to start",
    pinEnd: "Pin to end",
    unpin: "Unpin",
    left: "Move left",
    right: "Move right",
    group: "Group by column",
    ungroup: "Ungroup",
  },
  ko: {
    asc: "오름차순 정렬",
    desc: "내림차순 정렬",
    resize: "열 크기 조정",
    add: "정렬에 추가",
    filter: "필터…",
    clearFilter: "필터 지우기",
    hide: "열 숨기기",
    pinStart: "앞에 고정",
    pinEnd: "뒤에 고정",
    unpin: "고정 해제",
    left: "왼쪽으로 이동",
    right: "오른쪽으로 이동",
    group: "이 열로 묶기",
    ungroup: "묶기 해제",
  },
  ja: {
    asc: "昇順に並べ替え",
    desc: "降順に並べ替え",
    resize: "列幅を変更",
    add: "並べ替えに追加",
    filter: "フィルター…",
    clearFilter: "フィルターをクリア",
    hide: "列を非表示",
    pinStart: "先頭に固定",
    pinEnd: "末尾に固定",
    unpin: "固定を解除",
    left: "左に移動",
    right: "右に移動",
    group: "この列でグループ化",
    ungroup: "グループ化を解除",
  },
  zh: {
    asc: "升序排序",
    desc: "降序排序",
    resize: "调整列大小",
    add: "添加到排序",
    filter: "筛选…",
    clearFilter: "清除筛选",
    hide: "隐藏列",
    pinStart: "固定到开头",
    pinEnd: "固定到末尾",
    unpin: "取消固定",
    left: "向左移动",
    right: "向右移动",
    group: "按此列分组",
    ungroup: "取消分组",
  },
};

/** An item's label in the menu's language (`before` · `after` by the reading direction). */
function columnMenuLabel(
  id: CatalogColumnMenuItemId,
  strings: ColumnMenuStrings,
  rtl: boolean,
): string {
  switch (id) {
    case "sort-asc":
      return strings.asc;
    case "sort-desc":
      return strings.desc;
    case "sort-add":
      return strings.add;
    case "filter":
      return strings.filter;
    case "clear-filter":
      return strings.clearFilter;
    case "hide":
      return strings.hide;
    case "pin-start":
      return strings.pinStart;
    case "pin-end":
      return strings.pinEnd;
    case "unpin":
      return strings.unpin;
    case "move-before":
      return rtl ? strings.right : strings.left;
    case "move-after":
      return rtl ? strings.left : strings.right;
    case "resize":
      return strings.resize;
    case "group":
      return strings.group;
    case "ungroup":
      return strings.ungroup;
  }
}

/**
 * The Column menu's items, read when it opens (the Table's state as it is then — the session's
 * `tableColumnMenu`); without a session, S2's sort and resize items.
 */
function CatalogColumnMenuItems({
  openFilter,
}: {
  /** 「Filter…」 — the Column's filter dialog opens once the menu closes. */
  openFilter: () => void;
}): ReactNode {
  const menu = useContext(CatalogColumnMenuContext);
  const { locale, direction } = useLocale();
  if (!menu) return null;
  const strings = catalogLocalized(COLUMN_MENU_STRINGS, locale);
  const items: readonly CatalogColumnMenuItem[] = menu.items
    ? menu.items()
    : [
        ...(menu.allowsSorting
          ? [{ id: "sort-asc" as const }, { id: "sort-desc" as const }]
          : []),
        ...(menu.startResize ? [{ id: "resize" as const }] : []),
      ];
  return createElement(
    Menu,
    {
      style: { minWidth: 128, border: "none" },
      disabledKeys: items
        .filter((item) => item.disabled)
        .map((item) => item.id),
      onAction: (key) => {
        const id = key as CatalogColumnMenuItemId;
        if (id === "resize") menu.startResize?.();
        else if (id === "filter") openFilter();
        else if (menu.run) menu.run(id);
        else if (id === "sort-asc") menu.sort("ascending");
        else if (id === "sort-desc") menu.sort("descending");
      },
    },
    ...items.map((item) =>
      createElement(
        MenuItem,
        { key: item.id, id: item.id },
        columnMenuLabel(item.id, strings, direction === "rtl"),
      ),
    ),
    // (S2 `menuItems` — the Column's own items after the Table's, §9.2.)
    ...(menu.authorItems ?? []),
  );
}

/** ADR-315 Phase 4 증분 4c — the filter dialog loads with the first one opened (HC5). */
const CatalogColumnFilterDialog = lazy(
  () => import("./tableColumnFilter.components"),
);

/** S2 `resizableMenuButtonWrapper` over the content wrapper's own (flex · padding) style. */
const MENU_BUTTON_STYLE: CSSProperties = {
  height: "100%",
  margin: 0,
  background: "transparent",
  borderStyle: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "inherit",
  cursor: "default",
};

/**
 * S2 `ColumnWithMenu`: a Column with a menu (`isMenu` — `catalogColumnHasMenu`) holds its content
 * in a `MenuTrigger` Button (the content wrapper node — its sort arrow, name and ⋮) whose Menu
 * sorts (with `allowsSorting`) and starts a resize (with `allowsResizing`). Outside a Column's operations (the Builder's DOM) the
 * wrapper stays its `div`.
 */
export function CatalogColumnMenuButton({
  element,
}: {
  element: ReactElement;
}): ReactNode {
  const menu = useContext(CatalogColumnMenuContext);
  const button = useRef<HTMLButtonElement>(null);
  const [filtering, setFiltering] = useState(false);
  if (!menu) return element;
  const { children, style, ...props } = element.props as {
    children?: ReactNode;
    style?: CSSProperties;
  } & Record<string, unknown>;
  const ownRef = props.ref as
    | ((node: HTMLButtonElement | null) => void)
    | { current: HTMLButtonElement | null }
    | null
    | undefined;
  return createElement(
    Fragment,
    null,
    createElement(
      MenuTrigger,
      null,
      createElement(
        Button,
        {
          ...props,
          // (The filter dialog stands at the menu Button — the wrapper's own ref kept.)
          ref: (node: HTMLButtonElement | null) => {
            button.current = node;
            if (typeof ownRef === "function") ownRef(node);
            else if (ownRef) ownRef.current = node;
          },
          // (Not `react-aria-Button`: the generated Button sheet would center and size it — the
          //  wrapper's own flex · padding · alignment are S2's `resizableMenuButtonWrapper`.)
          className: "catalog-column-menu-button",
          style: { ...style, ...MENU_BUTTON_STYLE },
        },
        children,
      ),
      createElement(
        Popover,
        {
          placement: "bottom start",
          // (S2: the menu is the popover's one surface — no inner frame, its own width from 128.)
          style: { padding: 0, width: "auto", minWidth: 0 },
        },
        createElement(CatalogColumnMenuItems, {
          openFilter: () => setFiltering(true),
        }),
      ),
    ),
    // (ADR-315 Phase 4 증분 4c — 「Filter…」: the Column's filter dialog, at its menu Button.)
    menu.filter && filtering
      ? createElement(
          Popover,
          {
            triggerRef: button,
            isOpen: true,
            onOpenChange: (open: boolean) => {
              if (!open) setFiltering(false);
            },
            placement: "bottom start",
            style: { padding: 0, width: "auto", minWidth: 0 },
          },
          createElement(
            Suspense,
            { fallback: null },
            createElement(CatalogColumnFilterDialog, {
              access: menu.filter,
              onClose: () => setFiltering(false),
            }),
          ),
        )
      : null,
  );
}

/** ADR-315 Phase 5 증분 5f — a data row's pin (`catalogTableRowPinProps`): its side now and the pin. */
export interface CatalogRowPin {
  readonly side: "top" | "bottom" | "none";
  pin(to: "top" | "bottom" | "none"): void;
}
/** The row menu's words (S2 has no row menu — composition's, breakdown §5.4 「행 고정」). */
const ROW_PIN_STRINGS: Readonly<
  Record<string, { menu: string; top: string; bottom: string; none: string }>
> = {
  en: {
    menu: "Row actions",
    top: "Pin to top",
    bottom: "Pin to bottom",
    none: "Unpin",
  },
  ko: {
    menu: "행 동작",
    top: "위에 고정",
    bottom: "아래에 고정",
    none: "고정 해제",
  },
  ja: {
    menu: "行の操作",
    top: "上に固定",
    bottom: "下に固定",
    none: "固定を解除",
  },
  zh: {
    menu: "行操作",
    top: "固定到顶部",
    bottom: "固定到底部",
    none: "取消固定",
  },
};
/**
 * ADR-315 Phase 5 증분 5f — a pinnable row's menu, at its last cell's end (a RAC `MenuTrigger`: the
 * Button · its Menu — 「Pin to top」 · 「Pin to bottom」 · 「Unpin」, the side the row is at left
 * out). `Table.css` shows it on the row's hover · focus and always on a pinned row (its pin mark);
 * at rest it is not drawn — as the Builder's Canvas, which has no viewer to pin rows.
 */
export function CatalogRowPinMenu({ pin }: { pin: CatalogRowPin }): ReactNode {
  const { locale } = useLocale();
  const strings = catalogLocalized(ROW_PIN_STRINGS, locale);
  const items = (["top", "bottom", "none"] as const).filter(
    (side) => side !== pin.side,
  );
  return createElement(
    MenuTrigger,
    null,
    createElement(
      Button,
      {
        className: "table-row-pin-button",
        "aria-label": strings.menu,
        ...({ "data-pinned-side": pin.side } as object),
      },
      catalogLucideGlyph(
        pin.side === "none" ? "ellipsis" : "pin",
        CATALOG_GLYPH_1EM,
      ),
    ),
    createElement(
      Popover,
      {
        placement: "bottom end",
        style: { padding: 0, width: "auto", minWidth: 0 },
      },
      createElement(
        Menu,
        {
          style: { minWidth: 128, border: "none" },
          onAction: (key) => pin.pin(key as "top" | "bottom" | "none"),
        },
        ...items.map((side) =>
          createElement(MenuItem, { key: side, id: side }, strings[side]),
        ),
      ),
    ),
  );
}

/**
 * ADR-315 Phase 5 증분 5f — inside a pinned row's last Cell: where its Table's pinned rows stand
 * while the Table scrolls. A top one stands under the sticky header and the top rows before it, a
 * bottom one over the bottom rows after it — each row's `--table-row-pin-at` (`Table.css`). In
 * the `Virtualizer` RAC's `TableLayout` places the top rows itself (`isSticky` at their place);
 * a bottom one's wrapper takes the inset (it is the sticky box there).
 */
export function CatalogTableRowPinMeasure(): ReactNode {
  const probe = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const row = probe.current?.closest<HTMLElement>('[role="row"]');
    const table = row?.closest<HTMLElement>("[data-node-table]");
    if (!row || !table) return;
    const write = () => catalogWriteTableRowPins(table);
    write();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(write);
    observer.observe(row);
    return () => observer.disconnect();
  });
  return createElement("span", { ref: probe, hidden: true });
}
/** A Table's pinned rows' insets, written on each (`CatalogTableRowPinMeasure`). */
function catalogWriteTableRowPins(table: HTMLElement): void {
  const rows = [
    ...table.querySelectorAll<HTMLElement>('[role="row"][data-pinned-row]'),
  ];
  const header = table.querySelector<HTMLElement>(".react-aria-TableHeader");
  const set = (element: HTMLElement, inset: number) => {
    const value = `${inset}px`;
    if (element.style.getPropertyValue("--table-row-pin-at") !== value)
      element.style.setProperty("--table-row-pin-at", value);
  };
  const wrapperOf = (row: HTMLElement) =>
    row.parentElement?.getAttribute("role") === "presentation"
      ? row.parentElement
      : undefined;
  let inset = header?.getBoundingClientRect().height ?? 0;
  for (const row of rows) {
    if (row.dataset.pinnedRow !== "top") continue;
    set(row, inset);
    inset += row.getBoundingClientRect().height;
  }
  inset = 0;
  for (const row of rows.reverse()) {
    if (row.dataset.pinnedRow !== "bottom") continue;
    set(row, inset);
    const wrapper = wrapperOf(row);
    if (wrapper) set(wrapper, inset);
    inset += row.getBoundingClientRect().height;
  }
}
