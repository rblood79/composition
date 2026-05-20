import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  SEARCH_FIELD_INPUT_MODE_VALUES,
  SEARCH_FIELD_TYPE_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toSearchFieldRacProps,
  type SearchFieldCanonicalProps,
  type SearchFieldRacProps,
} from "../outputs/toRacProps";

const searchFieldAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Search",
  },
  value: {
    kind: "string",
    label: "Value",
    section: "content",
    default: "",
  },
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    default: "Search...",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
    emptyToUndefined: true,
  },
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
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
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  type: {
    kind: "enum",
    label: "Input Type",
    section: "inputType",
    default: "search",
    options: SEARCH_FIELD_TYPE_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  inputMode: {
    kind: "enum",
    label: "Input Mode",
    section: "inputType",
    default: "search",
    options: SEARCH_FIELD_INPUT_MODE_VALUES.map((value) => ({
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
  isReadOnly: {
    kind: "boolean",
    label: "Read Only",
    section: "state",
    default: false,
  },
  isInvalid: {
    kind: "boolean",
    label: "Invalid",
    section: "state",
    default: false,
  },
  errorMessage: {
    kind: "string",
    label: "Error Message",
    section: "state",
    visibleWhen: { key: "isInvalid", truthy: true },
    emptyToUndefined: true,
  },
  minLength: {
    kind: "number",
    label: "Min Length",
    section: "state",
    min: 0,
    step: 1,
  },
  maxLength: {
    kind: "number",
    label: "Max Length",
    section: "state",
    min: 0,
    step: 1,
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required",
    section: "state",
    options: TEXT_FIELD_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value === "icon" ? "Icon (*)" : "Label",
    })),
  },
  isRequired: {
    kind: "boolean",
    label: "Required State",
    section: "state",
    inspector: false,
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

export const searchFieldPrimitiveBinding: PrimitiveBinding<
  SearchFieldCanonicalProps,
  SearchFieldRacProps
> = {
  tag: "SearchField",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "SearchField",
  },
  defaultProps: {
    label: "Search",
    value: "",
    placeholder: "Search...",
    type: "search",
    inputMode: "search",
    size: "md",
    labelPosition: "top",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: searchFieldAccepts,
  },
  toRacProps: toSearchFieldRacProps,
  skiaPrimitive: { kind: "search-field" },
};

export const searchFieldInspectorThemeValues = {
  sizes: {
    SearchField: BUTTON_SIZE_VALUES,
  },
};
