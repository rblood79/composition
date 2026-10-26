import type {
  ComboBoxProps,
  DatePickerProps,
  DialogTriggerProps,
  MenuTriggerProps,
  ModalOverlayProps,
  PopoverProps,
  SelectProps,
  TooltipTriggerComponentProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC `useOverlayTriggerState` (DialogTrigger.md · MenuTrigger.md · TooltipTrigger.md "Open
 * state"): `isOpen` / `defaultOpen` / `onOpenChange`. The owner is the trigger node — an overlay
 * body's own `isOpen` beats its trigger's context (installed `Modal.mjs:88-90`, Phase 0 probe P1),
 * so only a body standing without a trigger owns it.
 */
const NAMES = [
  "isOpen",
  "defaultOpen",
  "onOpenChange",
] as const satisfies readonly (keyof DialogTriggerProps)[];
const MENU = NAMES satisfies readonly (keyof MenuTriggerProps)[];
const TOOLTIP = NAMES satisfies readonly (keyof TooltipTriggerComponentProps)[];
const MODAL = NAMES satisfies readonly (keyof ModalOverlayProps)[];
const POPOVER = NAMES satisfies readonly (keyof PopoverProps)[];
const PICKER = NAMES satisfies readonly (keyof SelectProps<object>)[];
const DATE = NAMES satisfies readonly (keyof DatePickerProps<never>)[];
void [MENU, TOOLTIP, MODAL, POPOVER, PICKER, DATE];

export const open = {
  id: "open",
  racDoc: "DialogTrigger.md · MenuTrigger.md · TooltipTrigger.md — Open state",
  racType:
    "DialogTriggerProps · MenuTriggerProps · TooltipTriggerComponentProps · ModalOverlayProps · PopoverProps",
  events: ["onOpenChange"],
  args: { onOpenChange: ["isOpen"] },
  state: {
    prop: "isOpen",
    defaultProp: "defaultOpen",
    callback: "onOpenChange",
    valueType: "boolean",
  },
  conditions: ["isDisabled"],
  capabilities: {
    open: { labelKey: "capabilities.open", value: true },
    close: { labelKey: "capabilities.close", value: false },
    // (`useOverlayTriggerState.toggle` — `toggleCheck`'s counterpart, RAC event audit 2026-10-26.)
    toggleOpen: { labelKey: "capabilities.toggleOpen", value: "!self" },
  },
} as const satisfies InteractionConcept;

/**
 * RAC ComboBox.md — `onOpenChange(isOpen, menuTrigger)` is observed only: a ComboBox has no
 * `isOpen` prop, so there is no state to write.
 */
const OBSERVED = [
  "onOpenChange",
] as const satisfies readonly (keyof ComboBoxProps<object>)[];

export const openObserved = {
  id: "open",
  racDoc: "ComboBox.md — onOpenChange (observed)",
  racType: "ComboBoxProps",
  events: OBSERVED,
  args: { onOpenChange: ["isOpen"] },
  conditions: [],
} as const satisfies InteractionConcept;
