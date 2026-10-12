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
