import { createContext, createElement, type ReactNode } from "react";

import { ColumnResizer } from "react-aria-components/Table";
import type {
  CatalogColumnMenuItem,
  CatalogColumnMenuItemId,
} from "./tableColumnMenu";
import {
  CatalogSortIndicator,
  CatalogTablePinMeasure,
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
 * The sort of the sortable Column being rendered — `null` outside one: its direction (RAC's Column
 * render props — the Table's first sort; a Column sorted after it has the Table state's), and its
 * 1-based place in a sort of several columns (ADR-315 Phase 2 — absent in a sort of one).
 */
export interface CatalogColumnSort {
  readonly direction?: string;
  readonly order?: number;
}
export const CatalogColumnSortContext = createContext<CatalogColumnSort | null>(
  null,
);

/**
 * S2 `ColumnWithMenu` — what the menu of the Column being rendered does (RAC's Column render props
 * `sort` · `startResize`): `null` outside a Column with a menu.
 */
export interface CatalogColumnMenu {
  readonly allowsSorting: boolean;
  readonly sort: (direction: "ascending" | "descending") => void;
  /** A resizable Column's (RAC's `startResize` — its Table is in RAC's resizable container). */
  readonly startResize?: () => void;
  /**
   * ADR-315 Phase 4 — the menu's items as the Table's state is now, and an item pressed (the
   * Preview session's — `tableColumnMenu.ts`). Absent (no session): sort and resize only.
   */
  readonly items?: () => readonly CatalogColumnMenuItem[];
  readonly run?: (id: CatalogColumnMenuItemId) => void;
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
    /** This Column's place in its Table's sort of several columns (its order mark). */
    readonly sortEntry?: {
      readonly order: number;
      readonly direction: "ascending" | "descending";
    };
    readonly resizable: boolean;
    /** ADR-315 Phase 4 — S2 `isMenu` (`catalogColumnHasMenu`): its content is the menu Button. */
    readonly menu: boolean;
    /** ADR-315 Phase 4 — the session's menu items and their run (`CatalogColumnMenu`). */
    readonly menuItems?: () => readonly CatalogColumnMenuItem[];
    readonly runMenu?: (id: CatalogColumnMenuItemId) => void;
    readonly writesTracks: boolean;
    /** ADR-315 Phase 4 — a pinned Column: its header's width is measured for the pinned ones after it. */
    readonly measuresPin?: boolean;
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
          {
            key: "content",
            // (RAC knows the first sort only: a Column sorted after it reads the state's entry.)
            value: options.sortEntry
              ? {
                  direction: options.sortEntry.direction,
                  order: options.sortEntry.order,
                }
              : { direction: sortDirection },
          },
          options.sortsInline
            ? createElement(CatalogSortIndicator, { key: "sort-indicator" })
            : null,
          ...content,
        )
      : content;
    return [
      // (S2 `ColumnWithMenu` — a Column with a menu has its content as the menu Button: the menu
      //  sorts through RAC's `sort` and starts a resize through `startResize`.)
      options.menu && sort
        ? createElement(
            CatalogColumnMenuContext.Provider,
            {
              key: "menu",
              value: {
                allowsSorting: options.sortable,
                sort,
                ...(options.resizable && startResize ? { startResize } : {}),
                ...(options.menuItems && options.runMenu
                  ? { items: options.menuItems, run: options.runMenu }
                  : {}),
              },
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
      options.measuresPin
        ? createElement(CatalogTablePinMeasure, { key: "pin" })
        : null,
    ];
  };
}
