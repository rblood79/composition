/** CommandMeta.JsonSchema의 지원된 부분집합. 새 keyword는 무시하지 않고 fail-closed한다. */
const supported = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "enum",
  "items",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "description",
  "title",
]);
export function validateCommandArgs(
  value: unknown,
  schema: Record<string, unknown>,
): boolean {
  if (Object.keys(schema).some((key) => !supported.has(key))) return false;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
      const properties = schema.properties;
      if (
        properties !== undefined &&
        (!properties ||
          typeof properties !== "object" ||
          Array.isArray(properties))
      )
        return false;
      const fields = (properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const object = value as Record<string, unknown>;
      if (
        Array.isArray(schema.required) &&
        schema.required.some(
          (key) => typeof key !== "string" || !Object.hasOwn(object, key),
        )
      )
        return false;
      return Object.entries(object).every(
        ([key, item]) =>
          Object.hasOwn(fields, key) && validateCommandArgs(item, fields[key]),
      );
    }
    case "string":
      return (
        typeof value === "string" &&
        (typeof schema.minLength !== "number" ||
          value.length >= schema.minLength) &&
        (typeof schema.maxLength !== "number" ||
          value.length <= schema.maxLength)
      );
    case "number":
    case "integer":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (schema.type !== "integer" || Number.isInteger(value)) &&
        (typeof schema.minimum !== "number" || value >= schema.minimum) &&
        (typeof schema.maximum !== "number" || value <= schema.maximum)
      );
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return (
        Array.isArray(value) &&
        !!schema.items &&
        typeof schema.items === "object" &&
        (typeof schema.minItems !== "number" ||
          value.length >= schema.minItems) &&
        (typeof schema.maxItems !== "number" ||
          value.length <= schema.maxItems) &&
        value.every((item) =>
          validateCommandArgs(item, schema.items as Record<string, unknown>),
        )
      );
    default:
      return false;
  }
}
