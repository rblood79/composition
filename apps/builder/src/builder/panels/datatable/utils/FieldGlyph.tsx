import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { resolveFieldGlyph } from "./fieldTypes";

/**
 * A field's glyph (`resolveFieldGlyph` — computed · format · type): one of the module's icons, so
 * the element type is stable across renders for the same field.
 */
export function FieldGlyph({
  field,
  ...props
}: { field: Parameters<typeof resolveFieldGlyph>[0] } & LucideProps) {
  return createElement(resolveFieldGlyph(field), props);
}
