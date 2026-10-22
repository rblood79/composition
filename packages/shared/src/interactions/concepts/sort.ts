import type { TableProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC Table.md "Sorting": `sortDescriptor` / `onSortChange` (no default prop). */
const NAMES = [
  "sortDescriptor",
  "onSortChange",
] as const satisfies readonly (keyof TableProps)[];
void NAMES;

export const sort = {
  id: "sort",
  racDoc: "Table.md — Sorting",
  racType: "TableProps",
  events: ["onSortChange"],
  args: { onSortChange: ["descriptor"] },
  state: {
    prop: "sortDescriptor",
    callback: "onSortChange",
    valueType: "sort",
  },
  conditions: [],
  capabilities: {
    sort: {
      labelKey: "capabilities.sort",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
  },
} as const satisfies InteractionConcept;
