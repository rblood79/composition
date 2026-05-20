import type { PrimitiveBinding } from "./types";
import { buttonInspectorThemeValues } from "./primitives/button";
import { linkInspectorThemeValues } from "./primitives/link";
import type { InspectorThemeLookup } from "./outputs/inspectorFields";
import { componentCatalog } from "./componentCatalog";

const PRIMITIVE_BINDINGS = Object.fromEntries(
  componentCatalog
    .filter((entry) => entry.kind === "primitive")
    .map((entry) => [entry.type, entry.binding as PrimitiveBinding]),
) as Record<string, PrimitiveBinding>;

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}

export function isPrimitiveBindingType(type: string): boolean {
  return getPrimitiveBinding(type) !== undefined;
}

export function getPrimitiveInspectorThemeValues(
  type: string,
): InspectorThemeLookup {
  if (type === "Button") return buttonInspectorThemeValues;
  if (type === "Link") return linkInspectorThemeValues;
  return {};
}

export const primitiveBindings = PRIMITIVE_BINDINGS;
