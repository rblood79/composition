import type {
  ComponentProperty,
  ComponentPropertyKind,
  ValueType,
} from "./types";

/**
 * ADR-261 Decision 4 — a user component's properties as its instance contract: each key takes the
 * value type of its kind (text → `string`, boolean → `boolean`). The definition stores no
 * `accepts` for them — the property table is the one source.
 */
export const COMPONENT_PROPERTY_VALUE_TYPE: Readonly<
  Record<ComponentPropertyKind, ValueType>
> = {
  text: "string",
  boolean: "boolean",
};

export function componentPropertyAccepts(
  properties: readonly ComponentProperty[] | undefined,
): Readonly<Record<string, ValueType>> {
  if (!properties?.length) return EMPTY;
  return Object.fromEntries(
    properties.map((property) => [
      property.key,
      COMPONENT_PROPERTY_VALUE_TYPE[property.kind],
    ]),
  );
}
const EMPTY: Readonly<Record<string, ValueType>> = Object.freeze({});

/** The properties a definition record carries (a library definition has none). */
export function componentPropertiesOf(
  definition: object | undefined,
): readonly ComponentProperty[] | undefined {
  const properties = (definition as { properties?: unknown } | undefined)
    ?.properties;
  return Array.isArray(properties) && properties.length
    ? (properties as readonly ComponentProperty[])
    : undefined;
}

/** What a component's properties write on one origin node: text props, or `enabled`. */
export interface ComponentPropertyWrite {
  props?: Readonly<Record<string, string>>;
  enabled?: boolean;
}
/**
 * The writes of a component's properties for one set of values (an instance's, `valueOf(key)`),
 * by driven origin node. A value of the wrong type — or none — writes nothing (the node's own
 * value shows: the default).
 */
export function componentPropertyWrites(
  properties: readonly ComponentProperty[] | undefined,
  valueOf: (key: string) => unknown,
): Map<string, ComponentPropertyWrite> {
  const writes = new Map<string, ComponentPropertyWrite>();
  for (const property of properties ?? []) {
    const value = valueOf(property.key);
    if (typeof value !== (property.kind === "text" ? "string" : "boolean"))
      continue;
    for (const target of property.targets) {
      const write = writes.get(target.id) ?? {};
      writes.set(
        target.id,
        property.kind === "text"
          ? { ...write, props: { ...write.props, [target.prop!]: value as string } }
          : { ...write, enabled: value as boolean },
      );
    }
  }
  return writes;
}
