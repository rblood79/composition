import type { PrimitiveBinding } from "./types";
import { buttonPrimitiveBinding } from "./primitives/button";

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

export const primitiveBindings = PRIMITIVE_BINDINGS;
