import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  FORM_ENCTYPE_VALUES,
  FORM_METHOD_VALUES,
  FORM_TARGET_VALUES,
  FORM_VALIDATION_BEHAVIOR_VALUES,
  FORM_VARIANT_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toFormRacProps,
  type FormCanonicalProps,
  type FormRacProps,
} from "../outputs/toRacProps";

const FORM_LABEL_ALIGN_VALUES = ["start", "center", "end"] as const;

const formAccepts = {
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    section: "appearance",
    default: "default",
  },
  labelPosition: {
    kind: "enum",
    label: "Label Position",
    section: "appearance",
    default: "top",
    options: TEXT_FIELD_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label Alignment",
    section: "appearance",
    default: "start",
    options: FORM_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required",
    section: "appearance",
    default: "icon",
    options: TEXT_FIELD_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value === "icon" ? "Icon (*)" : "Label",
    })),
  },
  action: {
    kind: "string",
    label: "Action",
    section: "submission",
    emptyToUndefined: true,
  },
  method: {
    kind: "enum",
    label: "Method",
    section: "submission",
    options: FORM_METHOD_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
    emptyToUndefined: true,
  },
  encType: {
    kind: "enum",
    label: "Encoding",
    section: "submission",
    options: FORM_ENCTYPE_VALUES.map((value) => ({
      value,
      label: value,
    })),
    emptyToUndefined: true,
  },
  target: {
    kind: "enum",
    label: "Target",
    section: "submission",
    options: FORM_TARGET_VALUES.map((value) => ({
      value,
      label: value,
    })),
    emptyToUndefined: true,
  },
  validationBehavior: {
    kind: "enum",
    label: "Validation",
    section: "submission",
    default: "native",
    options: FORM_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto Focus",
    section: "state",
    default: false,
  },
  restoreFocus: {
    kind: "boolean",
    label: "Restore Focus",
    section: "state",
    default: false,
  },
  "aria-label": {
    kind: "string",
    label: "Accessible Label",
    section: "content",
    inspector: false,
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

export const formPrimitiveBinding: PrimitiveBinding<
  FormCanonicalProps,
  FormRacProps
> = {
  tag: "Form",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "Form",
  },
  defaultProps: {
    "aria-label": "Form",
    size: "md",
    variant: "default",
    labelPosition: "top",
    labelAlign: "start",
    necessityIndicator: "icon",
    validationBehavior: "native",
    isDisabled: false,
    autoFocus: false,
    restoreFocus: false,
  },
  props: {
    accepts: formAccepts,
  },
  toRacProps: toFormRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "TextField",
        props: {
          label: "Name",
          value: "",
          placeholder: "Enter name...",
          type: "text",
          size: "md",
          labelPosition: "top",
        },
      },
      {
        type: "TextField",
        props: {
          label: "Email",
          value: "",
          placeholder: "name@example.com",
          type: "email",
          size: "md",
          labelPosition: "top",
        },
      },
      {
        type: "Button",
        props: {
          children: "Submit",
          type: "submit",
          variant: "primary",
          fillStyle: "fill",
          size: "md",
        },
      },
    ],
  },
};

export const formInspectorThemeValues = {
  sizes: {
    Form: BUTTON_SIZE_VALUES,
  },
  variants: {
    Form: FORM_VARIANT_VALUES,
  },
};
