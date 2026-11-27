import type { InteractionConcept } from "./types";

/**
 * ADR-322 Phase 5 — a Cascader's value and open state. Neither RAC nor S2 · v3 has a Cascader (F1);
 * the names are S2 Picker's (`value` · `defaultValue` · `onChange` · `isOpen` · `onOpenChange`),
 * mirrored here as StepList's are (`stepList.ts`). The value is an item's key — a key list while
 * `selectionMode: "multiple"` (사용자 결정 3); a write that no single pickable item carries is
 * refused (`cascaderValueRefusal` — the dispatcher's `refuseValue`, Decision 4).
 */
export interface CascaderStateProps {
  value?: string | string[] | null;
  defaultValue?: string | string[];
  onChange?: (value: string | string[] | null) => void;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDisabled?: boolean;
}

/**
 * The value. When 「변경」 = the user's pick (a Do's write does not call it, as RAC calls a change
 * callback for the user's change only). Do 「값 넣기」 · 「지우기」.
 */
export const cascaderValue = {
  id: "cascaderValue",
  racDoc: "ADR-322 — Cascader value (S2 Picker names)",
  racType: "CascaderStateProps",
  events: ["onChange"],
  args: { onChange: ["value"] },
  state: {
    prop: "value",
    defaultProp: "defaultValue",
    callback: "onChange",
    valueType: "key",
  },
  conditions: ["isDisabled"],
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
    clear: { labelKey: "capabilities.clear", value: null },
  },
} as const satisfies InteractionConcept;
