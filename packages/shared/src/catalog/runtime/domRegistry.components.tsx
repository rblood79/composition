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

import { RESIZABLE_TABLE_STYLE } from "./domRegistry.runtime";

export function CatalogTable({
  selectionStyle,
  tableResizable,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
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
