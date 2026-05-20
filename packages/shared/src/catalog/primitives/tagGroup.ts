import type { PrimitiveBinding } from "../types";
import {
  TAG_GROUP_LABEL_ALIGN_VALUES,
  TAG_GROUP_LABEL_POSITION_VALUES,
  TAG_GROUP_SELECTION_BEHAVIOR_VALUES,
  TAG_GROUP_SELECTION_MODE_VALUES,
  TAG_GROUP_SIZE_VALUES,
  TAG_GROUP_VARIANT_VALUES,
  toTagGroupRacProps,
  type TagGroupCanonicalProps,
  type TagGroupRacProps,
} from "../outputs/toRacProps";

const tagGroupAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Tag Group",
  },
  items: {
    kind: "binding",
    label: "Items",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
  },
  errorMessage: {
    kind: "string",
    label: "Error message",
    section: "content",
  },
  contextualHelp: {
    kind: "string",
    label: "Contextual help",
    section: "content",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: TAG_GROUP_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TAG_GROUP_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  labelPosition: {
    kind: "enum",
    label: "Label position",
    section: "appearance",
    default: "top",
    options: TAG_GROUP_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label align",
    section: "appearance",
    default: "start",
    options: TAG_GROUP_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  maxRows: {
    kind: "number",
    label: "Max rows",
    section: "appearance",
    min: 1,
    max: 12,
    step: 1,
  },
  isEmphasized: {
    kind: "boolean",
    label: "Emphasized",
    section: "appearance",
    default: false,
  },
  filterText: {
    kind: "string",
    label: "Filter text",
    section: "filtering",
  },
  filterFields: {
    kind: "string-array",
    label: "Filter fields",
    section: "filtering",
  },
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "multiple",
    options: TAG_GROUP_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionBehavior: {
    kind: "enum",
    label: "Selection behavior",
    section: "state",
    default: "toggle",
    options: TAG_GROUP_SELECTION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  disallowEmptySelection: {
    kind: "boolean",
    label: "Disallow empty",
    section: "state",
    default: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  isReadOnly: {
    kind: "boolean",
    label: "Read only",
    section: "state",
    default: false,
  },
  isInvalid: {
    kind: "boolean",
    label: "Invalid",
    section: "state",
    default: false,
  },
  allowsRemoving: {
    kind: "boolean",
    label: "Allows removing",
    section: "state",
    default: false,
  },
  allowsCustomValue: {
    kind: "boolean",
    label: "Allows custom value",
    section: "state",
    default: false,
  },
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
    inspector: false,
  },
  selectedKeys: {
    kind: "string-array",
    label: "Selected keys",
    section: "state",
    inspector: false,
  },
  defaultSelectedKey: {
    kind: "string",
    label: "Default selected key",
    section: "state",
    inspector: false,
  },
  defaultSelectedKeys: {
    kind: "string-array",
    label: "Default selected keys",
    section: "state",
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

export const tagGroupPrimitiveBinding: PrimitiveBinding<
  TagGroupCanonicalProps,
  TagGroupRacProps
> = {
  tag: "TagGroup",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "TagGroup",
  },
  defaultProps: {
    label: "Tag Group",
    variant: "default",
    size: "md",
    labelPosition: "top",
    labelAlign: "start",
    selectionMode: "multiple",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
    allowsRemoving: false,
    allowsCustomValue: false,
    items: [
      { id: "tag-1", label: "Chocolate" },
      { id: "tag-2", label: "Mint" },
      { id: "tag-3", label: "Strawberry" },
      { id: "tag-4", label: "Vanilla" },
    ],
  },
  props: {
    accepts: tagGroupAccepts,
  },
  toRacProps: toTagGroupRacProps,
  skiaPrimitive: { kind: "tag-group" },
};

export const tagGroupInspectorThemeValues = {
  variants: {
    TagGroup: TAG_GROUP_VARIANT_VALUES,
  },
  sizes: {
    TagGroup: TAG_GROUP_SIZE_VALUES,
  },
};
