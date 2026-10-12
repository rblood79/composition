import { getIconData } from "@composition/rendering";

import {
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import { TableColumnResizeStateContext } from "react-aria-components/Table";
import {
  CATALOG_RESIZED_TRACKS_VAR,
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
 * G5 example 11 (2026-10-12) — the reference's sort indicator (react-aria.adobe.com Table.md
 * `Column`): `span.sort-indicator` after the column's name Group, always in a sortable column — a
 * 16px chevron up while ascending, down otherwise; `Table.css` hides it while the column is not
 * sorted (`visibility: hidden` — its box stays, as the Canvas keeps it:
 * `catalogColumnSortNameGroup`).
 */
export function CatalogSortIndicator(): ReactNode {
  const direction = useContext(CatalogColumnSortContext);
  if (direction === null) return null;
  const glyph = getIconData(
    direction === "ascending" ? "chevron-up" : "chevron-down",
  );
  return createElement(
    "span",
    { "aria-hidden": true, className: "sort-indicator" },
    glyph &&
      createElement(
        "svg",
        {
          "aria-hidden": true,
          width: 16,
          height: 16,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        ...glyph.paths.map((d: string, i: number) =>
          createElement("path", { key: i, d }),
        ),
      ),
  );
}
