import type {
  DisclosureGroupProps,
  DisclosureProps,
  TreeProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC expansion — a key set (Tree.md · DisclosureGroup.md) or one boolean (Disclosure.md). */
const KEYS = [
  "expandedKeys",
  "defaultExpandedKeys",
  "onExpandedChange",
] as const satisfies readonly (keyof TreeProps<object>)[];
const GROUP = [
  ...KEYS,
  "isDisabled",
] as const satisfies readonly (keyof DisclosureGroupProps)[];
const ONE = [
  "isExpanded",
  "defaultExpanded",
  "onExpandedChange",
  "isDisabled",
] as const satisfies readonly (keyof DisclosureProps)[];
void [GROUP, ONE];

export const expansionKeys = {
  id: "expansion",
  racDoc: "Tree.md · DisclosureGroup.md — Expansion",
  racType: "TreeProps · DisclosureGroupProps",
  events: ["onExpandedChange"],
  args: { onExpandedChange: ["keys"] },
  state: {
    prop: "expandedKeys",
    defaultProp: "defaultExpandedKeys",
    callback: "onExpandedChange",
    valueType: "keys",
  },
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    expand: {
      labelKey: "capabilities.expand",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
      op: "add",
    },
    collapse: { labelKey: "capabilities.collapseAll", value: [] },
  },
} as const satisfies InteractionConcept;

export const expansionOne = {
  id: "expansion",
  racDoc: "Disclosure.md — Expansion",
  racType: "DisclosureProps",
  events: ["onExpandedChange"],
  args: { onExpandedChange: ["keys"] },
  state: {
    prop: "isExpanded",
    defaultProp: "defaultExpanded",
    callback: "onExpandedChange",
    valueType: "boolean",
  },
  conditions: ["isDisabled"],
  capabilities: {
    expand: { labelKey: "capabilities.expand", value: true },
    collapse: { labelKey: "capabilities.collapse", value: false },
  },
} as const satisfies InteractionConcept;
