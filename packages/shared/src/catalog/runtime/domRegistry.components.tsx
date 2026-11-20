import type { ReactElement } from "react";

import {
  createElement,
  useEffect,
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
  style,
  ...props
}: Record<string, unknown> & {
  style?: CSSProperties;
  onSortPress?: (column: string, add: boolean) => void;
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
