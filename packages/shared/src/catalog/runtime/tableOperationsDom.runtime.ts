import { createContext, createElement, type ReactNode } from "react";

import { ColumnResizer } from "react-aria-components/Table";
import {
  CatalogSortIndicator,
  CatalogTableResizeTracks,
} from "./tableOperationsDom.components";

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
 * The sort direction of the sortable Column being rendered (RAC's Column render props) — `null`
 * outside one.
 */
export const CatalogColumnSortContext = createContext<
  string | undefined | null
>(null);

/**
 * S2 `ColumnWithMenu` — what the menu of the Column being rendered does (RAC's Column render props
 * `sort` · `startResize`): `null` outside a Column with a menu.
 */
export interface CatalogColumnMenu {
  readonly allowsSorting: boolean;
  readonly sort: (direction: "ascending" | "descending") => void;
  readonly startResize: () => void;
}
export const CatalogColumnMenuContext = createContext<CatalogColumnMenu | null>(
  null,
);

/**
 * A RAC Column's children with its operations: the sort direction for its sort arrow (S2
 * `ColumnContents` — inside its content wrapper, `CatalogSortIndicator`; a Column without one gets
 * it before its content), RAC's `ColumnResizer` when it resizes, and (in one Column of a resizable
 * Table) the track writer.
 */
export function catalogColumnChildren(
  content: readonly ReactNode[],
  options: {
    readonly sortable: boolean;
    /** A Column without a content wrapper: the arrow goes before its content. */
    readonly sortsInline: boolean;
    readonly resizable: boolean;
    readonly writesTracks: boolean;
  },
): (values: {
  sortDirection?: string;
  sort?: (direction: "ascending" | "descending") => void;
  startResize?: () => void;
}) => ReactNode {
  return ({ sortDirection, sort, startResize }) => {
    const sorted = options.sortable
      ? createElement(
          CatalogColumnSortContext.Provider,
          { key: "content", value: sortDirection },
          options.sortsInline
            ? createElement(CatalogSortIndicator, { key: "sort-indicator" })
            : null,
          ...content,
        )
      : content;
    return [
      // (S2 `ColumnWithMenu` — a resizable Column's content is its menu Button: the menu sorts
      //  through RAC's `sort` and starts a resize through `startResize`.)
      options.resizable && sort && startResize
        ? createElement(
            CatalogColumnMenuContext.Provider,
            {
              key: "menu",
              value: { allowsSorting: options.sortable, sort, startResize },
            },
            sorted,
          )
        : sorted,
      // (S2: the resizer in a `div` RAC's focus skips — `data-react-aria-prevent-focus`.)
      options.resizable
        ? createElement(
            "div",
            { key: "resizer", "data-react-aria-prevent-focus": "true" },
            // (S2 marks the resizer too; RAC's `ColumnResizerProps` do not type data attributes.)
            createElement(ColumnResizer, {
              ...({ "data-react-aria-prevent-focus": "true" } as object),
              "aria-label": "Resize column",
            }),
          )
        : null,
      options.writesTracks
        ? createElement(CatalogTableResizeTracks, { key: "tracks" })
        : null,
    ];
  };
}
