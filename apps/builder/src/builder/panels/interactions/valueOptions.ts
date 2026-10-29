/**
 * The Value field's 「값 고르기」 — what a rule value can name, from what the rule already knows:
 * its When's RAC arguments (`eventArgs`), the items its key argument names in the owner's bound
 * collection (`useListData.getItem` — the schema's fields), and the variables in reach. Nothing is
 * listed by hand per component: a `keys` · `key` argument on a bound owner gives its items.
 * Stored as a whole-value reference (`valueRef.ts` — `!event` · `!item` · `!var`).
 */
import {
  formatRuleValueRef,
  itemRefIsSingle,
  KEY_EVENT_ARGS,
  parseRuleValueRef,
} from "@composition/shared";

/** A value's shape as the Value field tells it (the variable model's types). */
export type CatalogValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array";

/** What a rule's value can name here. */
export interface CatalogValueSources {
  /** The When's RAC argument names (`eventArgsOf`). */
  eventArgs: readonly string[];
  /** The owner's bound collection (its schema fields) and whether its `keys` name one item. */
  items?: {
    fields: readonly { key: string; type: string }[];
    single: boolean;
  };
  variables: readonly { id: string; name: string; type: string }[];
}

export type CatalogValueGroup = "event" | "item" | "variable";

export interface CatalogValueOption {
  /** The rule value it stores. */
  value: string;
  group: CatalogValueGroup;
  /** Its own name in the list (`keys` · `name` · the variable's) — the group names the rest. */
  name: string;
  /** Its shape when the rule runs; undefined = it depends (a `value` argument). */
  type?: CatalogValueType;
  /** Indented under the whole item (a field). */
  nested?: boolean;
}

/** The RAC arguments' shapes (`concepts/*.ts` `args`); `value` is the component's own. */
const EVENT_ARG_TYPES: Readonly<Record<string, CatalogValueType>> = {
  keys: "array",
  key: "string",
  isOpen: "boolean",
  isSelected: "boolean",
  formData: "object",
  files: "array",
  descriptor: "object",
  date: "date",
  // (A collection's drag and drop — ADR-284 Phase 5: the drop event's fields.)
  items: "array",
  target: "object",
  dropOperation: "string",
  isInternal: "boolean",
};

/** An argument's fields a rule reads on their own (a drop's `target.key` · `target.dropPosition`). */
const EVENT_ARG_FIELDS: Readonly<Record<string, readonly string[]>> = {
  target: ["key", "dropPosition"],
};

/** A schema field's type as a value's (text kinds — email · url · date … — are strings). */
const fieldType = (type: string): CatalogValueType =>
  type === "number" ? "number" : type === "boolean" ? "boolean" : "string";

/** The item argument `!item` reads: a selection's `keys`, else a row's `key`. */
const itemArgOf = (eventArgs: readonly string[]) =>
  eventArgs.find((arg) => arg === "keys") ??
  eventArgs.find((arg) => KEY_EVENT_ARGS.has(arg));

/** Every value a rule here can name, in the list's order (event · item · variables). */
export function catalogValueOptions(
  sources: CatalogValueSources,
): CatalogValueOption[] {
  const options: CatalogValueOption[] = sources.eventArgs.flatMap((arg) => [
    {
      value: formatRuleValueRef({ from: "event", arg, path: [] }),
      group: "event" as const,
      name: arg,
      ...(EVENT_ARG_TYPES[arg] ? { type: EVENT_ARG_TYPES[arg] } : {}),
    },
    ...(EVENT_ARG_FIELDS[arg] ?? []).map((field) => ({
      value: formatRuleValueRef({ from: "event", arg, path: [field] }),
      group: "event" as const,
      name: `${arg}.${field}`,
      type: "string" as const,
      nested: true,
    })),
  ]);
  const arg = itemArgOf(sources.eventArgs);
  if (arg && sources.items) {
    const single = itemRefIsSingle(arg, sources.items.single);
    options.push({
      value: formatRuleValueRef({ from: "item", arg, path: [] }),
      group: "item",
      name: "",
      type: single ? "object" : "array",
    });
    for (const field of sources.items.fields)
      options.push({
        value: formatRuleValueRef({ from: "item", arg, path: [field.key] }),
        group: "item",
        name: field.key,
        type: single ? fieldType(field.type) : "array",
        nested: true,
      });
  }
  for (const variable of sources.variables)
    options.push({
      value: formatRuleValueRef({
        from: "var",
        variableId: variable.id,
        path: [],
      }),
      group: "variable",
      name: variable.name,
      type: variable.type as CatalogValueType,
    });
  return options;
}

/** The option a stored value is, or one built from the reference (a source no longer listed). */
export function catalogValueOptionOf(
  value: unknown,
  sources: CatalogValueSources,
): CatalogValueOption | undefined {
  const ref = parseRuleValueRef(value);
  if (!ref) return undefined;
  const listed = catalogValueOptions(sources).find(
    (option) => option.value === value,
  );
  if (listed) return listed;
  const name =
    ref.from === "var"
      ? (sources.variables.find((variable) => variable.id === ref.variableId)
          ?.name ?? ref.variableId.split(":").pop()!)
      : ref.from === "event"
        ? ref.arg
        : "";
  return {
    value: String(value),
    group: ref.from === "var" ? "variable" : ref.from,
    name: [name, ...ref.path].filter(Boolean).join("."),
  };
}

/**
 * Whether a picked value fits the slot's type (a variable's): a number or boolean fits a text
 * (the runtime writes its text); anything else of another known shape does not.
 */
export function catalogValueFits(
  option: CatalogValueOption,
  expected: CatalogValueType | undefined,
): boolean {
  if (!expected || !option.type || option.type === expected) return true;
  return (
    expected === "string" &&
    (option.type === "number" ||
      option.type === "boolean" ||
      option.type === "date")
  );
}
