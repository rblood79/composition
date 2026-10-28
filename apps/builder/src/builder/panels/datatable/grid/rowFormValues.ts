/**
 * Row form values — ADR-289 Decision 1 (리뷰 M3): what a field's draft means depends on the mode.
 *
 * - **Insert**: every field starts empty; an untouched or emptied field takes its default
 *   (`resolveFieldDefault`) and `null` when there is none. The placeholder shows that default.
 * - **Update**: every field starts at the row's current value (`formatCellValue` — structure values
 *   as JSON); an untouched field is **not written** (kept), an emptied field becomes `null` — the
 *   same as clearing a cell. The default is never applied on update.
 *
 * `required` is judged on the value that will be stored: after the default on insert, including the
 * kept current value on update. Pure functions — the form component wires them to inputs.
 */
import type { DataField } from "../../../../types/builder/data.types";
import { coerceCellValue, formatCellValue } from "./cellValue";
import { cloneCellValue, resolveFieldDefault } from "./fieldDefault";

export type RowFormModeKind = "insert" | "update";

export interface FieldDraft {
  /** The input's text — structure values as JSON, booleans as `"true"` / `"false"`. */
  text: string;
  /** The user changed this field (typed · picked · cleared). */
  touched: boolean;
}

export type FinalRowValue =
  /** Update only: the field is untouched — nothing is written, the current value stays. */
  | { kind: "keep" }
  | { kind: "value"; value: unknown }
  /** The text is not a value of the field's type (`coerceCellValue` failed). */
  | { kind: "invalid" };

/** Insert: `""` · Update: the current value as text. */
export function initialDraftText(
  mode: RowFormModeKind,
  current: unknown,
): string {
  return mode === "insert" ? "" : formatCellValue(current);
}

export function finalRowValue(
  mode: RowFormModeKind,
  field: DataField,
  draft: FieldDraft,
): FinalRowValue {
  const empty = draft.text.trim() === "";
  if (mode === "update") {
    if (!draft.touched) return { kind: "keep" };
    if (empty) return { kind: "value", value: null };
  } else if (empty) {
    const fallback = resolveFieldDefault(field);
    return {
      kind: "value",
      value: fallback.ok ? cloneCellValue(fallback.value) : null,
    };
  }
  const coerced = coerceCellValue(field.type, draft.text);
  return coerced.ok
    ? { kind: "value", value: coerced.value }
    : { kind: "invalid" };
}

/** The value that will be in the row after saving — the kept current value on update. */
export function storedRowValue(
  final: FinalRowValue,
  current: unknown,
): unknown {
  return final.kind === "keep"
    ? current
    : final.kind === "value"
      ? final.value
      : null;
}

export function isMissingRequired(
  field: DataField,
  final: FinalRowValue,
  current: unknown,
): boolean {
  if (!field.required || final.kind === "invalid") return false;
  const stored = storedRowValue(final, current);
  return stored === null || stored === undefined;
}
