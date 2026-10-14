import type { ReactElement } from "react";

import {
  createElement,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";

import { Keyboard } from "react-aria-components/Keyboard";

import {
  Table as RacTable,
  ResizableTableContainer,
} from "react-aria-components/Table";

import { resolveSelectionBehavior } from "../../components/selectionStyle";

import { tableBinding } from "../bindings/Table.binding";

import { RESIZABLE_TABLE_STYLE } from "./domRegistry.runtime";

export function CatalogTable({
  heightMode,
  height,
  selectionStyle,
  tableResizable,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
  const accepts = tableBinding.props.accepts;
  const mode = heightMode ?? accepts.heightMode?.default;
  const fixed = typeof height === "number" ? height : accepts.height?.default;
  // (`Table.css` `border: 1px solid` when the document writes none.)
  const border = Number.parseFloat(String(style?.borderWidth ?? 1)) || 0;
  // S2 `isQuiet` — square corners: the rule's radius rides the inline style, which would beat
  // the `[data-quiet]` sheet block (the Canvas reads the rule's containerVariants.quiet).
  const quiet =
    (props as Record<string, unknown>)["data-quiet"] === "true"
      ? { borderRadius: 0 }
      : undefined;
  const sized =
    mode === "fixed" && typeof fixed === "number" && style?.height === undefined
      ? { height: fixed + border * 2 }
      : undefined;
  const boxStyle = quiet || sized ? { ...style, ...sized, ...quiet } : style;
  const table = createElement(RacTable as ElementType, {
    "aria-label": "Table",
    ...props,
    // ADR-257 Phase 3 — S2 `selectionStyle` → RAC `selectionBehavior` (highlight = replace; the
    // sheet's `[data-selection-style="highlight"]` paints the selected rows).
    selectionBehavior: resolveSelectionBehavior({
      selectionStyle,
      fallback: "toggle",
    }),
    "data-selection-style":
      selectionStyle === "highlight" ? "highlight" : undefined,
    // (An authored height wins, as on the Canvas — `catalogTableHeight` is the height when none.)
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
        },
        table,
      )
    : table;
}

/**
 * ADR-257 Phase 5 — the TableView, as S2 1.8.0 builds it (`TableView.tsx`): RAC's
 * `ResizableTableContainer` (always — S2 wraps every TableView) is the TableView's box (the
 * `.react-aria-TableView` rule: variant · border · background · its record's style), and RAC's
 * `Table` inside lays the node tree's parts out (the same parts as a Table — `TableHeader > Column`,
 * `TableBody > Row > Cell`, drawn by `ruleDom`). Its rows take RAC's column widths as tracks
 * (`--table-resized-tracks`, `tableOperationsDom`). S2's `Virtualizer` is not used: the parts are
 * nodes (the Table's choice, ADR-256 Phase 5i).
 */
export function CatalogTableView({
  selectionStyle,
  density,
  overflowMode: _overflowMode,
  tableResizable: _tableResizable,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
  const {
    "data-variant": variant,
    "data-quiet": _quiet,
    "data-catalog-id": catalogId,
    ...tableProps
  } = props as Record<string, unknown>;
  return createElement(
    ResizableTableContainer as ElementType,
    {
      className: "react-aria-TableView",
      "data-catalog-id": catalogId,
      "data-variant": variant ?? "default",
      "data-density": typeof density === "string" ? density : undefined,
      style: { overflow: "hidden", ...style },
    },
    createElement(RacTable as ElementType, {
      "aria-label": "Table",
      ...tableProps,
      // S2: `selectionStyle` highlight = RAC `selectionBehavior="replace"` (Phase 3).
      selectionBehavior: resolveSelectionBehavior({
        selectionStyle,
        fallback: "toggle",
      }),
      "data-selection-style":
        selectionStyle === "highlight" ? "highlight" : undefined,
      style: RESIZABLE_TABLE_STYLE,
      "data-node-table": "",
    }),
  );
}

export function CatalogKeyboard(
  props: HTMLAttributes<HTMLElement>,
): ReactElement {
  return createElement(Keyboard, {
    className: "react-aria-Keyboard",
    ...props,
  });
}
