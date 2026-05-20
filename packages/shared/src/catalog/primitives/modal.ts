import type { PrimitiveBinding } from "../types";
import {
  MODAL_SIZE_VALUES,
  toModalRacProps,
  type ModalCanonicalProps,
  type ModalRacProps,
} from "../outputs/toRacProps";

const modalAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Modal content",
  },
  text: {
    kind: "string",
    label: "Text",
    section: "content",
    inspector: false,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: MODAL_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  trapFocus: {
    kind: "boolean",
    label: "Trap focus",
    section: "state",
    default: true,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto focus",
    section: "state",
    default: true,
  },
  restoreFocus: {
    kind: "boolean",
    label: "Restore focus",
    section: "state",
    default: true,
  },
  isOpen: {
    kind: "boolean",
    label: "Open",
    section: "state",
    default: true,
  },
  isDismissable: {
    kind: "boolean",
    label: "Dismissible",
    section: "state",
    default: false,
  },
  isKeyboardDismissDisabled: {
    kind: "boolean",
    label: "Disable keyboard dismiss",
    section: "state",
    default: false,
  },
  className: {
    kind: "string",
    label: "Class name",
    section: "appearance",
    inspector: false,
  },
  style: {
    kind: "string",
    label: "Style",
    section: "appearance",
    inspector: false,
  },
} as const;

export const modalPrimitiveBinding: PrimitiveBinding<
  ModalCanonicalProps,
  ModalRacProps
> = {
  tag: "Modal",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "Modal",
  },
  defaultProps: {
    children: "Modal content",
    size: "md",
    trapFocus: true,
    autoFocus: true,
    restoreFocus: true,
    isOpen: true,
    isDismissable: false,
    isKeyboardDismissDisabled: false,
  },
  props: {
    accepts: modalAccepts,
  },
  toRacProps: toModalRacProps,
  skiaPrimitive: { kind: "modal" },
};

export const modalInspectorThemeValues = {
  sizes: {
    Modal: MODAL_SIZE_VALUES,
  },
};
