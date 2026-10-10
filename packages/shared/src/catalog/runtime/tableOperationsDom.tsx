import {
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ColumnResizer,
  TableColumnResizeStateContext,
} from "react-aria-components/Table";
import { Icon } from "../../components/Icon";

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

const SORT_ICON_STYLE: CSSProperties = { fontSize: 16 };

/**
 * A RAC Column's children with its operations: S2's sort icon before the text while the column is
 * sorted (`SortUpArrow` · `SortDownArrow`, 16px — none at rest, as the Canvas), RAC's
 * `ColumnResizer` when it resizes, and (in one Column of a resizable Table) the track writer.
 */
export function catalogColumnChildren(
  content: readonly ReactNode[],
  options: {
    readonly sortable: boolean;
    readonly resizable: boolean;
    readonly writesTracks: boolean;
  },
): (values: { sortDirection?: string }) => ReactNode {
  return ({ sortDirection }) => [
    options.sortable && sortDirection
      ? createElement(
          "span",
          {
            key: "sort",
            className: "sort-indicator",
            "aria-hidden": true,
            "data-direction": sortDirection,
          },
          createElement(Icon, {
            iconName: sortDirection === "ascending" ? "arrow-up" : "arrow-down",
            style: SORT_ICON_STYLE,
          }),
        )
      : null,
    ...content,
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
