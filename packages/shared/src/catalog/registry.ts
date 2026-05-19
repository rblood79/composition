import type { PrimitiveBinding } from "./types";
import {
  buttonInspectorThemeValues,
  buttonPrimitiveBinding,
} from "./primitives/button";
import type { InspectorThemeLookup } from "./outputs/inspectorFields";

const PRIMITIVE_BINDINGS: Record<string, PrimitiveBinding> = {
  Button: buttonPrimitiveBinding as unknown as PrimitiveBinding,
};

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
  return {};
}

export const primitiveBindings = PRIMITIVE_BINDINGS;
