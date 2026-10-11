import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  ColumnResizer,
  TableColumnResizeStateContext,
} from "react-aria-components/Table";
import { getIconData } from "@composition/rendering";

/**
 * ADR-257 Phase 4 — the RAC Table's Preview operations in the DOM (S2 Column `allowsSorting` ·
 * `allowsResizing`). RAC owns the behavior (D1): the Column sorts through the Table's
 * `onSortChange`, the `ColumnResizer` drags the RAC column width state of the
 * `ResizableTableContainer`.
 */

/** The CSS variable a resizable Table's header row · Rows take their tracks from (RAC's px). */
export const CATALOG_RESIZED_TRACKS_VAR = "--table-resized-tracks";

/**
 * A resizable Table's track list: RAC's column widths (px) while the container wraps it — from
 * the first render, not only while dragging (RAC gives the table `width: min-content`, where `fr`
 * tracks fold to 0 — CSS Grid §12.7). The static list stays the fallback until RAC has widths.
 */
export function catalogResizableTracks(tracks: string): string {
  return `var(${CATALOG_RESIZED_TRACKS_VAR}, ${tracks})`;
}

/**
 * Inside a Column of a resizable Table: writes RAC's column widths (in collection order — the
 * shown Columns, as the tracks) on its `<table>` as `--table-resized-tracks`.
 */
function CatalogTableResizeTracks(): ReactNode {
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
  return createElement("span", { ref: probe, hidden: true });
}

/**
 * The sort direction of the sortable Column being rendered (RAC's Column render props) — `null`
 * outside one.
 */
const CatalogColumnSortContext = createContext<string | undefined | null>(null);

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

/**
 * A RAC Column's children with its operations: the sort direction for its sort indicator (after
 * the name Group — `CatalogSortIndicator`), RAC's `ColumnResizer` when it resizes, and (in one
 * Column of a resizable Table) the track writer.
 */
export function catalogColumnChildren(
  content: readonly ReactNode[],
  options: {
    readonly sortable: boolean;
    /** A Column without a name Group: the indicator follows its content. */
    readonly sortsAtEnd: boolean;
    readonly resizable: boolean;
    readonly writesTracks: boolean;
  },
): (values: { sortDirection?: string }) => ReactNode {
  return ({ sortDirection }) => [
    options.sortable
      ? createElement(
          CatalogColumnSortContext.Provider,
          { key: "content", value: sortDirection },
          ...content,
          options.sortsAtEnd
            ? createElement(CatalogSortIndicator, { key: "sort-indicator" })
            : null,
        )
      : content,
    options.resizable
      ? createElement(ColumnResizer, {
          key: "resizer",
          "aria-label": "Resize column",
        })
      : null,
    options.writesTracks
      ? createElement(CatalogTableResizeTracks, { key: "tracks" })
      : null,
  ];
}
