import type { InteractionConcept } from "./types";
/** Installed S2 ActionBarProps: count is supplied by the selected collection's author. */
export interface S2ActionBarSelectionProps {
  selectedItemCount?: number | "all";
  onClearSelection?: () => void;
}
export const actionBarSelection = {
  id: "actionBarSelection",
  racDoc: "S2 ActionBar — selectedItemCount / onClearSelection",
  racType: "S2 ActionBarProps",
  events: ["onClearSelection"],
  args: { onClearSelection: [] },
  state: {
    prop: "selectedItemCount",
    callback: "onClearSelection",
    valueType: "number",
  },
  conditions: [],
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "number", labelKey: "capabilities.paramValue" },
    },
    clearSelection: { labelKey: "capabilities.clearSelection", value: 0 },
  },
} as const satisfies InteractionConcept;
