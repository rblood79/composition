import type { CatalogRowEditStatusValue } from "./tableCellMerge";
import type { ReactElement, ReactNode, Ref, RefCallback } from "react";

import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";

import { mergeRefs } from "react-aria/mergeRefs";
import { Button as RacButton } from "react-aria-components/Button";
import { Keyboard } from "react-aria-components/Keyboard";
import { useLocale } from "react-aria-components/I18nProvider";

import {
  Cell as RacCell,
  type CellProps,
  type CellRenderProps,
  Table as RacTable,
  ResizableTableContainer,
} from "react-aria-components/Table";

import { resolveSelectionBehavior } from "../../components/selectionStyle";

import { RESIZABLE_TABLE_STYLE } from "./domRegistry.runtime";
import { CATALOG_GLYPH_1EM, catalogLucideGlyph } from "./lucideGlyph";
import { catalogLocalized } from "./localizedStrings";
import { CATALOG_EVENT_EDITS } from "../../interactions/bindings";
import {
  CatalogEditableCellContent,
  type CatalogEditableCellProps,
} from "./editableCell.components";
import type {
  CatalogCellSelection,
  CatalogCellSelectionSource,
} from "./tableCellSelection";
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

/** ADR-315 Phase 6 — the cell ranges of the Table a Cell is in (`CatalogTable`'s `cellSelection`). */
const CatalogCellSelectionContext = createContext<
  CatalogCellSelection | undefined
>(undefined);

/**
 * ADR-315 Phase 6 — a Table 「Cell selection」: its ranges (`tableCellSelection.ts` — a lazy chunk,
 * read by a Table that has it) on the RAC table element, given to its Cells.
 */
function useCatalogCellSelection(
  source: CatalogCellSelectionSource | undefined,
  table: { readonly current: HTMLElement | null },
): CatalogCellSelection | undefined {
  const latest = useRef(source);
  useEffect(() => {
    latest.current = source;
  });
  const [selection, setSelection] = useState<CatalogCellSelection>();
  const on = !!source;
  useEffect(() => {
    if (!on) return;
    let live = true;
    let attached: CatalogCellSelection | undefined;
    void import("./tableCellSelection").then(
      ({ attachCatalogCellSelection }) => {
        if (!live || !table.current) return;
        attached = attachCatalogCellSelection(table.current, latest);
        setSelection(attached);
      },
    );
    return () => {
      live = false;
      attached?.detach();
      setSelection(undefined);
    };
  }, [on, table]);
  return selection;
}

/** ADR-317 Phase 4 — a row's edit status as said (the site languages — en · ko). */
const ROW_EDIT_LABELS = {
  en: {
    new: "New row",
    dirty: "Edited",
    conflict: "Conflict",
    failed: "Not saved",
    pending: "Result to check",
    unlinked: "Saved — choose its row",
  },
  ko: {
    new: "새 행",
    dirty: "수정됨",
    conflict: "충돌",
    failed: "저장 안 됨",
    pending: "결과 확인 필요",
    unlinked: "저장됨 · 서버 행과 연결 필요",
  },
} as const;

/** Said, not shown (out of the layout — `position: absolute`). */
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

export function CatalogTable({
  selectionStyle,
  tableResizable,
  onSortPress,
  onColumnsResized,
  cellSelection,
  onCellsChange,
  style,
  ...props
}: Record<string, unknown> & {
  style?: CSSProperties;
  /** ADR-317 Phase 4 — the Table's 「Cells change」 rules (a several-cell write's rows · items · cells). */
  onCellsChange?: (event: Record<PropertyKey, unknown>) => void;
  onSortPress?: (column: string, add: boolean) => void;
  /** ADR-315 Phase 4 — RAC's `onResizeEnd`: the px widths it left, by RAC key. */
  onColumnsResized?: (widths: Record<string, number>) => void;
  /** ADR-315 Phase 6 — a Table 「Cell selection」: its rows · Columns and their text. */
  cellSelection?: CatalogCellSelectionSource;
}) {
  const shift = useShiftMemory(!!onSortPress);
  const tableElement = useRef<HTMLElement | null>(null);
  // ADR-317 — a Table that writes (「Paste」) says each write's result in a status region (the
  // D1 exception's one element — breakdown §4): beside the RAC table, never inside it.
  const { locale } = useLocale();
  const [status, setStatus] = useState("");
  const writes = !!cellSelection?.write;
  const write = cellSelection?.write;
  const source = cellSelection
    ? {
        ...cellSelection,
        // (ADR-317 Phase 4 — a write that wrote cells is the Table's 「Cells change」: its rows, their
        //  items now, the cells, and the edit's number a save of it clears — `CATALOG_EVENT_EDITS`.)
        ...(write
          ? {
              write: (cells: Parameters<typeof write>[0]) => {
                const result = write(cells) as ReturnType<typeof write> & {
                  keys?: readonly string[];
                  items?: readonly unknown[];
                  seq?: number;
                };
                if (onCellsChange && result.written.length)
                  onCellsChange({
                    keys: result.keys ?? [],
                    items: result.items ?? [],
                    cells: result.written,
                    ...(result.seq !== undefined
                      ? { [CATALOG_EVENT_EDITS]: [result.seq] }
                      : {}),
                  });
                return result;
              },
            }
          : {}),
        locale,
        announce: (text: string) => {
          // (Cleared first: the same text twice is said twice.)
          setStatus("");
          requestAnimationFrame(() => setStatus(text));
        },
      }
    : undefined;
  const selection = useCatalogCellSelection(source, tableElement);
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
    ...(cellSelection
      ? {
          ref: mergeRefs(
            tableElement,
            (props as { ref?: Ref<HTMLElement> }).ref,
          ),
        }
      : {}),
  });
  const provided = cellSelection
    ? createElement(
        CatalogCellSelectionContext.Provider,
        { value: selection },
        table,
        writes
          ? createElement(
              "span",
              {
                role: "status",
                "data-table-write-status": "",
                style: VISUALLY_HIDDEN,
              },
              status,
            )
          : null,
      )
    : table;
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
        provided,
      )
    : provided;
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
  children: drawn,
  rowPin,
  measuresRowPin,
  editableCell,
  rowEdit,
  rowEditNote,
  ...props
}: Record<string, unknown> & {
  children?: ReactNode;
  rowPin?: CatalogRowPin;
  measuresRowPin?: boolean;
  /** S2 체크리스트 §9.3 — S2 `EditableCell` (`editableCell.components.tsx`). */
  editableCell?: CatalogEditableCellProps;
  /** ADR-317 Phase 4 — its row's edit status, said here (the row's first data Cell). */
  rowEdit?: CatalogRowEditStatusValue;
  /** ADR-324 — a save status's words (the server's values · the fields' messages). */
  rowEditNote?: string;
}): ReactElement {
  const { locale } = useLocale();
  const cellRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const content = editableCell
    ? createElement(
        CatalogEditableCellContent,
        {
          editable: editableCell,
          cellRef,
          isOpen: editing,
          setOpen: setEditing,
        },
        drawn,
      )
    : drawn;
  // (ADR-317 Phase 4 — the row's status as text a screen reader reads with the cell — the color
  //  and the edge line are not the only sign; our element inside RAC's cell, no attribute written.)
  const own = rowEdit
    ? createElement(
        Fragment,
        null,
        content,
        createElement(
          "span",
          { key: "edit-status", "data-edit-said": "", style: VISUALLY_HIDDEN },
          ` ${catalogLocalized(ROW_EDIT_LABELS, locale)[rowEdit]}`,
        ),
        // (ADR-324 — a save's verdict is shown, not only said: the server's values next to mine
        //  (사용자 결정 4), the fields' messages — a line under the cell's content.)
        rowEditNote
          ? createElement(
              "span",
              { key: "edit-note", "data-edit-note": "" },
              rowEditNote,
            )
          : null,
      )
    : content;
  // (ADR-315 Phase 6 — a Cell of a Table 「Cell selection」: its `aria-selected` follows the ranges
  //  from when RAC puts its element in the DOM — RAC renders this in its collection, the element
  //  apart, so the ref is where the two meet.)
  const selection = useContext(CatalogCellSelectionContext);
  const columnKey = props["data-column-key"];
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
    ...(editableCell && editing ? { "data-editing": true } : {}),
    ...((selection && typeof columnKey === "string") || editableCell
      ? {
          ref: mergeRefs(
            cellRef,
            (props as { ref?: Ref<HTMLElement> }).ref,
            (element: HTMLElement | null) =>
              element && selection && typeof columnKey === "string"
                ? selection.mark(element, columnKey)
                : undefined,
          ) as RefCallback<HTMLElement>,
        }
      : {}),
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
                  catalogLucideGlyph("chevron-right", CATALOG_GLYPH_1EM),
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
