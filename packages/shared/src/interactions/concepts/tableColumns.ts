import type { InteractionConcept } from "./types";

/**
 * ADR-315 Phase 4 — a Table's column slices as Do (breakdown §4.2 — 「표 상태는 Do 로 바뀐다」):
 * not a RAC documentation section (RAC's Table has no column visibility, pinning or column filter —
 * TanStack's `columnVisibility` · `columnPinning` · `columnFilters`), so the names are composition
 * extensions the specs give their RAC props (`componentInteractionSpecs.ts` — `TableColumnProps`).
 * Each writes the Preview's Table state, never the document (`CatalogPreviewInteractions` routes
 * the prop to the session). No event — a viewer's change reports none (a column chooser's Menu is
 * the chooser's `onSelectionChange`).
 */

/** The columns a Table shows (Column keys) — what a column chooser checks. */
export const columnVisibility = {
  id: "columnVisibility",
  racDoc: "ADR-315 — Table state `hiddenColumns` (TanStack columnVisibility)",
  racType: "composition Table extension",
  events: [],
  state: { prop: "visibleColumns", callback: "", valueType: "keys" },
  conditions: [],
  capabilities: {
    showColumn: {
      labelKey: "capabilities.showColumn",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramColumnKey" },
      op: "add",
    },
    hideColumn: {
      labelKey: "capabilities.hideColumn",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramColumnKey" },
      op: "remove",
    },
    setVisibleColumns: {
      labelKey: "capabilities.setVisibleColumns",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramColumnKeys" },
    },
  },
} as const satisfies InteractionConcept;

/** A Column's pinned side (`none` · `start` · `end`) — TanStack columnPinning. */
export const columnPinning = {
  id: "columnPinning",
  racDoc: "ADR-315 — Table state `pinnedColumns` (TanStack columnPinning)",
  racType: "composition Column extension",
  events: [],
  state: { prop: "pinned", callback: "", valueType: "string" },
  conditions: [],
  capabilities: {
    pinColumnStart: { labelKey: "capabilities.pinColumnStart", value: "start" },
    pinColumnEnd: { labelKey: "capabilities.pinColumnEnd", value: "end" },
    unpinColumn: { labelKey: "capabilities.unpinColumn", value: "none" },
  },
} as const satisfies InteractionConcept;

/**
 * A Column's filter value — the condition its menu's 「Filter…」 starts with (text 「contains」, a
 * list 「any of」, else 「equals」), the value written as the dialog reads it. Empty = no filter.
 */
export const columnFilter = {
  id: "columnFilter",
  racDoc:
    "ADR-315 · 320 — the Table's filter tree (`filters`): its root condition of this Column (TanStack columnFilters)",
  racType: "composition Column extension",
  events: [],
  state: { prop: "filterValue", callback: "", valueType: "string" },
  conditions: [],
  capabilities: {
    setColumnFilter: {
      labelKey: "capabilities.setColumnFilter",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
    clearColumnFilter: {
      labelKey: "capabilities.clearColumnFilter",
      value: "",
    },
  },
} as const satisfies InteractionConcept;

/**
 * ADR-315 Phase 5 증분 5f — a Table data row's pinned side (`none` · `top` · `bottom`) — TanStack
 * rowPinning (`row.pin`): the Table state's `pinnedRows`. Written on the row a rule runs in (a
 * Row template's record is its data row's).
 */
export const rowPinning = {
  id: "rowPinning",
  racDoc: "ADR-315 — Table state `pinnedRows` (TanStack rowPinning)",
  racType: "composition Row extension",
  events: [],
  state: { prop: "pinned", callback: "", valueType: "string" },
  conditions: [],
  capabilities: {
    pinRowTop: { labelKey: "capabilities.pinRowTop", value: "top" },
    pinRowBottom: { labelKey: "capabilities.pinRowBottom", value: "bottom" },
    unpinRow: { labelKey: "capabilities.unpinRow", value: "none" },
  },
} as const satisfies InteractionConcept;
