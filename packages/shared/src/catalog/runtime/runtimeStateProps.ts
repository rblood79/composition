import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import { catalogStateSourceValue } from "./delegatedDom.runtime";

/**
 * ADR-280 Decision 4 · 8 (user decision 1, 2026-10-22) — one function for a record's RAC state in
 * a running Preview: the runtime override (a rule's write, the user's own change — ADR-250) when it
 * has the prop, else the state the component starts with (`catalogStateSourceValue` — the declared
 * value, or what its items declare: a collection's Selected items, a RadioGroup's Selected Radio,
 * the Tabs' key). The Preview render and the dispatcher both read it, so a rule's set operation
 * starts from what RAC shows.
 */
export function catalogRuntimeStateOf(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
  override: Readonly<Record<string, unknown>> | undefined,
  prop: string,
  /** Other records' runtime props (a group reads its items' — a DisclosureGroup's). */
  runtimeOf?: (
    recordId: string,
  ) => Readonly<Record<string, unknown>> | undefined,
): unknown {
  if (override && Object.prototype.hasOwnProperty.call(override, prop))
    return override[prop];
  return catalogStateSourceValue(root, record, prop, runtimeOf);
}

/** A RAC `Selection` (`"all"` or a Set) as the override keeps it — an array, or `"all"`. */
export function catalogSelectionValue(next: unknown): unknown {
  if (next === "all") return "all";
  if (next instanceof Set) return [...next].map(String);
  return next;
}

/** How a state prop is passed to RAC (its controlled · default · change callback names). */
export interface CatalogStateProp {
  /** RAC's controlled prop — also the override key the capability writes. */
  prop: string;
  defaultProp: string;
  callback: string;
}

/**
 * ADR-280 Decision 4 — a state prop for RAC. In a running Preview (`setRuntimeProps`) it is
 * controlled from the first render: the value is always defined (the caller passes the concept's
 * empty value, never `undefined` — react-stately reads `value !== undefined`), RAC's change goes
 * to the record's runtime props (`toOverride` turns RAC's value into the override's), and the
 * element keeps one `key` (no remount). A static render (no running Preview) gives RAC the default.
 * Never both — with `selectedKeys` RAC ignores `defaultSelectedKeys` even as the start value.
 */
export function catalogControlledProps(
  recordId: string,
  setRuntimeProps:
    | ((id: string, patch: Readonly<Record<string, unknown>>) => void)
    | undefined,
  names: CatalogStateProp,
  value: unknown,
  toOverride: (next: unknown) => unknown = (next) => next,
): Record<string, unknown> {
  if (!setRuntimeProps) return { [names.defaultProp]: value };
  return {
    [names.prop]: value,
    [names.callback]: (next: unknown) =>
      setRuntimeProps(recordId, { [names.prop]: toOverride(next) }),
  };
}

export const SELECTED_KEYS: CatalogStateProp = {
  prop: "selectedKeys",
  defaultProp: "defaultSelectedKeys",
  callback: "onSelectionChange",
};
export const SELECTED_KEY: CatalogStateProp = {
  prop: "selectedKey",
  defaultProp: "defaultSelectedKey",
  callback: "onSelectionChange",
};
export const VALUE: CatalogStateProp = {
  prop: "value",
  defaultProp: "defaultValue",
  callback: "onChange",
};
export const IS_SELECTED: CatalogStateProp = {
  prop: "isSelected",
  defaultProp: "defaultSelected",
  callback: "onChange",
};
export const IS_OPEN: CatalogStateProp = {
  prop: "isOpen",
  defaultProp: "defaultOpen",
  callback: "onOpenChange",
};
export const EXPANDED_KEYS: CatalogStateProp = {
  prop: "expandedKeys",
  defaultProp: "defaultExpandedKeys",
  callback: "onExpandedChange",
};
export const INPUT_VALUE: CatalogStateProp = {
  prop: "inputValue",
  defaultProp: "defaultInputValue",
  callback: "onInputChange",
};

/**
 * ADR-280 Decision 3 (Phase 0 probe P1) — the nodes whose RAC component owns an overlay's open
 * state (`isOpen` · `onOpenChange`), and the overlay bodies that own it only standing alone.
 */
export const CATALOG_OPEN_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  "MenuTrigger",
  "DialogTrigger",
  "TooltipTrigger",
  "ContextualHelp",
]);
export const CATALOG_OPEN_BODY_TYPES: ReadonlySet<string> = new Set([
  "Modal",
  "Popover",
  "Tooltip",
]);
/** The pickers whose RAC component owns their Popover's open state (`isOpen` on the picker). */
const CATALOG_OPEN_PICKER_TYPES: ReadonlySet<string> = new Set([
  "Select",
  "DatePicker",
  "DateRangePicker",
]);
/** Triggers whose overlay's open state RAC does not let anyone control (no `isOpen` prop). */
const CATALOG_UNCONTROLLED_OPEN_TYPES: ReadonlySet<string> = new Set([
  "ComboBox",
  "SubmenuTrigger",
]);

/**
 * The record that owns an overlay body's open state: its nearest trigger · picker ancestor (a
 * Modal in a DialogTrigger, a Popover in a MenuTrigger · Select), `null` when RAC lets no one
 * control it (a ComboBox's, a submenu's), `undefined` when the body stands alone.
 */
export function catalogOpenOwnerOf(
  root: CatalogCompositionRoot,
  bodyId: string,
  typeOf: (node: CatalogConsumerNode) => string,
): string | null | undefined {
  for (
    let cursor = root.domInputs.get(root.domInputs.get(bodyId)?.parentId ?? "");
    cursor;
    cursor = root.domInputs.get(cursor.parentId)
  ) {
    const type = typeOf(cursor);
    if (
      CATALOG_OPEN_TRIGGER_TYPES.has(type) ||
      CATALOG_OPEN_PICKER_TYPES.has(type)
    )
      return cursor.id;
    if (CATALOG_UNCONTROLLED_OPEN_TYPES.has(type)) return null;
  }
  return undefined;
}
