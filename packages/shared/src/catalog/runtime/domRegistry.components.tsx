import type { ReactElement, ReactNode } from "react";

import {
  createElement,
  Fragment,
  useEffect,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";

import { Button as RacButton } from "react-aria-components/Button";
import { Keyboard } from "react-aria-components/Keyboard";

import {
  Cell as RacCell,
  type CellProps,
  type CellRenderProps,
  Table as RacTable,
  ResizableTableContainer,
} from "react-aria-components/Table";

import { resolveSelectionBehavior } from "../../components/selectionStyle";

import { RESIZABLE_TABLE_STYLE } from "./domRegistry.runtime";
import {
  type CatalogRowPin,
  CatalogRowPinMenu,
  CatalogTableRowPinMeasure,
} from "./tableOperationsDom.components";

/**
 * ADR-315 Phase 2 — whether Shift was held at the last pointer · key event of the document. RAC's
 * `onSortChange` names the pressed Column only, so a header press reads the modifier here: capture
 * listeners on the document, shared by its Tables — no wrapping element, RAC's DOM and handlers
 * untouched (HC1; breakdown §5.1 시제품 S4).
 */
interface ShiftMemory {
  held: boolean;
  tables: number;
  remember: (event: Event) => void;
}
const shiftMemories = new WeakMap<Document, ShiftMemory>();
const SHIFT_EVENTS = ["pointerdown", "pointerup", "keydown", "keyup", "click"];
function useShiftMemory(enabled: boolean): () => boolean {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    const owner = document;
    let memory = shiftMemories.get(owner);
    if (!memory) {
      const created: ShiftMemory = {
        held: false,
        tables: 0,
        remember: (event) => {
          created.held = (event as KeyboardEvent).shiftKey === true;
        },
      };
      memory = created;
      shiftMemories.set(owner, created);
      for (const type of SHIFT_EVENTS)
        owner.addEventListener(type, created.remember, true);
    }
    const shared = memory;
    shared.tables += 1;
    return () => {
      shared.tables -= 1;
      if (shared.tables > 0) return;
      for (const type of SHIFT_EVENTS)
        owner.removeEventListener(type, shared.remember, true);
      shiftMemories.delete(owner);
    };
  }, [enabled]);
  return () =>
    typeof document !== "undefined" &&
    shiftMemories.get(document)?.held === true;
}

export function CatalogTable({
  selectionStyle,
  tableResizable,
  onSortPress,
  onColumnsResized,
  style,
  ...props
}: Record<string, unknown> & {
  style?: CSSProperties;
  onSortPress?: (column: string, add: boolean) => void;
  /** ADR-315 Phase 4 — RAC's `onResizeEnd`: the px widths it left, by RAC key. */
  onColumnsResized?: (widths: Record<string, number>) => void;
}) {
  const shift = useShiftMemory(!!onSortPress);
  // S2 `isQuiet` — square corners: the rule's radius rides the inline style, which would beat
  // the `[data-quiet]` sheet block (the Canvas reads the rule's containerVariants.quiet).
  const quiet =
    (props as Record<string, unknown>)["data-quiet"] === "true"
      ? { borderRadius: 0 }
      : undefined;
  const boxStyle = quiet ? { ...style, ...quiet } : style;
  const table = createElement(RacTable as ElementType, {
    "aria-label": "Table",
    ...props,
    ...(onSortPress
      ? {
          onSortChange: (descriptor: { column?: unknown }) => {
            // (A rule's `onSortChange` runs too — the record's own handler.)
            (props.onSortChange as ((value: unknown) => void) | undefined)?.(
              descriptor,
            );
            onSortPress(String(descriptor.column), shift());
          },
        }
      : {}),
    // ADR-257 Phase 3 — S2 `selectionStyle` → RAC `selectionBehavior` (highlight = replace; the
    // sheet's `[data-selection-style="highlight"]` paints the selected rows).
    selectionBehavior: resolveSelectionBehavior({
      selectionStyle,
      fallback: "toggle",
    }),
    "data-selection-style":
      selectionStyle === "highlight" ? "highlight" : undefined,
    // (Its height is the record's box height — the Styles height, as on the Canvas.)
    style: tableResizable ? RESIZABLE_TABLE_STYLE : boxStyle,
    "data-node-table": "",
  });
  return tableResizable
    ? createElement(
        ResizableTableContainer as ElementType,
        {
          className: "react-aria-ResizableTableContainer",
          "data-node-table-container": "",
          "data-quiet": (props as Record<string, unknown>)["data-quiet"],
          style: boxStyle,
          ...(onColumnsResized
            ? {
                // (RAC gives the Columns it laid out in px — the ones after the drag keep their
                //  `fr` · `%` sizes, which are no width to keep.)
                onResizeEnd: (widths: Map<unknown, unknown>) =>
                  onColumnsResized(
                    Object.fromEntries(
                      [...widths].flatMap(([key, width]) =>
                        typeof width === "number" &&
                        Number.isFinite(width) &&
                        width > 0
                          ? [[String(key), width]]
                          : [],
                      ),
                    ),
                  ),
              }
            : {}),
        },
        table,
      )
    : table;
}

export function CatalogKeyboard(
  props: HTMLAttributes<HTMLElement>,
): ReactElement {
  return createElement(Keyboard, {
    className: "react-aria-Keyboard",
    ...props,
  });
}

/**
 * ADR-315 Phase 5 — a Table's Cell: RAC `Cell` with the expand button of an expandable row in its
 * Table's `treeColumn` (RAC's `Button slot="chevron"` — the reference's 「Expandable rows」; RAC
 * names it 「Expand」 · 「Collapse」 and gives it the row's toggle) and the level's indent there. A
 * Cell of a Table without `treeColumn` renders as before.
 */
export function CatalogTableCell({
  children: own,
  rowPin,
  measuresRowPin,
  ...props
}: Record<string, unknown> & {
  children?: ReactNode;
  rowPin?: CatalogRowPin;
  measuresRowPin?: boolean;
}): ReactElement {
  // (ADR-315 Phase 5 증분 5f — a pinned row's last Cell measures where the pinned rows stand; a
  //  pinnable row's last Cell holds its row menu, after its content.)
  const children =
    rowPin || measuresRowPin
      ? createElement(
          Fragment,
          null,
          own,
          measuresRowPin
            ? createElement(CatalogTableRowPinMeasure, { key: "pin-measure" })
            : null,
          rowPin
            ? createElement(CatalogRowPinMenu, { key: "pin-menu", pin: rowPin })
            : null,
        )
      : own;
  return createElement(RacCell, {
    ...(props as CellProps),
    children: (cell: CellRenderProps) =>
      cell.isTreeColumn
        ? createElement(
            "span",
            {
              className: "table-tree-cell",
              style: { "--table-tree-level": cell.level - 1 } as CSSProperties,
            },
            cell.hasChildItems
              ? createElement(
                  RacButton,
                  { slot: "chevron", className: "table-tree-chevron" },
                  createElement(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      width: "1em",
                      height: "1em",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      "aria-hidden": true,
                    },
                    createElement("path", { d: "m9 18 6-6-6-6" }),
                  ),
                )
              : createElement("span", {
                  className: "table-tree-chevron",
                  "aria-hidden": true,
                }),
            children,
          )
        : children,
  });
}
