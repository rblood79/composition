import { getIconData } from "@composition/rendering";

import {
  createElement,
  type CSSProperties,
  type ReactElement,
  useContext,
  useLayoutEffect,
  useRef,
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
  const direction = useContext(CatalogColumnSortContext);
  if (direction !== "ascending" && direction !== "descending") return null;
  const glyph = getIconData(
    direction === "ascending" ? "arrow-up" : "arrow-down",
  );
  return createElement(
    "svg",
    {
      "aria-hidden": true,
      className: "sort-indicator",
      "data-sort-direction": direction,
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        marginInlineEnd: 8,
      },
    },
    ...(glyph?.paths ?? []).map((d: string, i: number) =>
      createElement("path", { key: i, d }),
    ),
  );
}

/**
 * S2 1.8.2 `table.sortAscending` · `table.sortDescending` · `table.resizeColumn`
 * (`@react-spectrum/s2` intl) in the languages the Builder ships; others English.
 */
const COLUMN_MENU_STRINGS: Readonly<
  Record<string, { asc: string; desc: string; resize: string }>
> = {
  en: {
    asc: "Sort Ascending",
    desc: "Sort Descending",
    resize: "Resize column",
  },
  ko: { asc: "오름차순 정렬", desc: "내림차순 정렬", resize: "열 크기 조정" },
  ja: { asc: "昇順に並べ替え", desc: "降順に並べ替え", resize: "列幅を変更" },
  zh: { asc: "升序排序", desc: "降序排序", resize: "调整列大小" },
};

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
 * S2 `ColumnWithMenu`: a Column with a menu (`allowsResizing`) holds its content in a `MenuTrigger`
 * Button (the content wrapper node — its sort arrow, name and ⋮) whose Menu sorts (with
 * `allowsSorting`) and starts a resize. Outside a Column's operations (the Builder's DOM) the
 * wrapper stays its `div`.
 */
export function CatalogColumnMenuButton({
  element,
}: {
  element: ReactElement;
}): ReactNode {
  const menu = useContext(CatalogColumnMenuContext);
  const { locale } = useLocale();
  if (!menu) return element;
  const strings =
    COLUMN_MENU_STRINGS[locale.split("-")[0] ?? "en"] ??
    COLUMN_MENU_STRINGS.en!;
  const { children, style, ...props } = element.props as {
    children?: ReactNode;
    style?: CSSProperties;
  } & Record<string, unknown>;
  const items = [
    ...(menu.allowsSorting
      ? [
          { id: "sort-asc", label: strings.asc },
          { id: "sort-desc", label: strings.desc },
        ]
      : []),
    { id: "resize", label: strings.resize },
  ];
  return createElement(
    MenuTrigger,
    null,
    createElement(
      Button,
      {
        ...props,
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
      createElement(
        Menu,
        {
          style: { minWidth: 128, border: "none" },
          onAction: (key) => {
            if (key === "sort-asc") menu.sort("ascending");
            else if (key === "sort-desc") menu.sort("descending");
            else if (key === "resize") menu.startResize();
          },
        },
        ...items.map((item) =>
          createElement(MenuItem, { key: item.id, id: item.id }, item.label),
        ),
      ),
    ),
  );
}
