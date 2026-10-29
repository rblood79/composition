/**
 * `resolveFieldDefault` — ADR-289 Decision 2 (리뷰 H1): the one reader of `DataField.defaultValue`.
 *
 * A default is stored by the column editor in the field's own type (a boolean · a number · a
 * parsed array / object) — older documents hold it as text (`"true"` · `"3"`), and nothing
 * migrates them. So the readers (`addRow` · the row form · the column editor's own field) ask here:
 * a value already of the column's type is kept as is (an empty array included), text goes through
 * `coerceCellValue` (dates are always normalised there), anything else is serialised
 * (`formatCellValue` — structure values as JSON) and then coerced. Never `String()` — it turns
 * `{ enabled: true }` into `[object Object]`, `[1, 2]` into `1,2` and `[]` into "" (= `null`).
 * A failure reads as "no default" (`ok: false`, `null`) and the column editor shows the mismatch.
 */
import type { DataField } from "../../../../types/builder/data.types";
import {
  coerceCellValue,
  formatCellValue,
  type CoercedCell,
} from "./cellValue";

const NONE: CoercedCell = { ok: true, value: null };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** The value already has the column's type — keep it (structure values included). */
function matchesType(type: DataField["type"], value: unknown): boolean {
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return isPlainObject(value);
    case "date":
      // Dates are text — always normalised through `coerceCellValue`.
      return false;
    default:
      // string (any format) · reference
      return typeof value === "string";
  }
}

export function resolveFieldDefault(field: DataField): CoercedCell {
  const value = field.defaultValue;
  if (value === null || value === undefined) return NONE;
  if (typeof value === "string") return coerceCellValue(field.type, value);
  if (matchesType(field.type, value)) return { ok: true, value };
  return coerceCellValue(field.type, formatCellValue(value));
}

/**
 * A structure value put into a row is a copy — the column definition and the row must not share
 * one object (editing the cell would edit the default).
 */
export function cloneCellValue<T>(value: T): T {
  return typeof value === "object" && value !== null
    ? structuredClone(value)
    : value;
}
