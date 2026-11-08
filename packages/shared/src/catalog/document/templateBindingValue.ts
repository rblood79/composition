const TEMPLATE_BINDING = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;
/** A value that is one whole `{key}` reference (the key a template node binds). */
export const WHOLE_TEMPLATE_BINDING = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/;

/** Whole references retain their type; embedded references are strings; absent keys stay authored. */
export function bindTemplateValue(
  value: PropValue,
  bindings: Readonly<Record<string, PropValue>>,
): PropValue;
export function bindTemplateValue(
  value: AuthoredValue,
  bindings: Readonly<Record<string, AuthoredValue>>,
): AuthoredValue;
export function bindTemplateValue(
  value: AuthoredValue,
  bindings: Readonly<Record<string, AuthoredValue>>,
): AuthoredValue {
  if (typeof value !== "string" || !value.includes("{")) return value;
  const whole = WHOLE_TEMPLATE_BINDING.exec(value);
  if (whole)
    return Object.hasOwn(bindings, whole[1]) ? bindings[whole[1]] : value;
  return value.replace(TEMPLATE_BINDING, (placeholder, key: string) =>
    Object.hasOwn(bindings, key) ? String(bindings[key]) : placeholder,
  );
}
import type { AuthoredValue, PropValue } from "./types";
