import type { PrimitiveBinding } from "../types";
import {
  DIALOG_ROLE_VALUES,
  DIALOG_SIZE_VALUES,
  toDialogRacProps,
  type DialogCanonicalProps,
  type DialogRacProps,
} from "../outputs/toRacProps";

const dialogAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Dialog content",
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
    options: DIALOG_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  role: {
    kind: "enum",
    label: "Role",
    section: "state",
    default: "dialog",
    options: DIALOG_ROLE_VALUES.map((value) => ({
      value,
      label: value === "alertdialog" ? "Alert Dialog" : "Dialog",
    })),
  },
  isDismissable: {
    kind: "boolean",
    label: "Dismissible",
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

export const dialogPrimitiveBinding: PrimitiveBinding<
  DialogCanonicalProps,
  DialogRacProps
> = {
  tag: "Dialog",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "Dialog",
  },
  defaultProps: {
    children: "Dialog content",
    size: "md",
    role: "dialog",
    isDismissable: false,
  },
  props: {
    accepts: dialogAccepts,
  },
  toRacProps: toDialogRacProps,
  skiaPrimitive: { kind: "dialog" },
};

export const dialogInspectorThemeValues = {
  sizes: {
    Dialog: DIALOG_SIZE_VALUES,
  },
};
