/**
 * ADR-291 Decision 3 · 4 — computed cells. `withComputedCells` writes every `formula` field of a
 * schema onto copies of the rows (the source rows untouched) at the row-reading stage, before a
 * view's conditions · aggregates · sort and the `{field}` templates read them. The row the
 * formula runs against is keyed by field **id** (the stored form reads `'f-price'`), computed
 * fields in dependency order (a formula may read another — a cycle is refused at definition).
 * A row's failure (a type error · 1/0) is `null` plus a cell marker (`formulaCellErrors`) — one
 * row never stops the view. The result is coerced to the field's `type` (Decision 2 · 4).
 * This module is the first screen's part (G3): the run itself is `computeCells.ts`, loaded with
 * the engine (`engine.ts`).
 */
import { formulaRuntimeSync, loadFormulaEngine } from "./engine";

export interface ComputedSchemaField {
  readonly id?: string;
  readonly key: string;
  readonly type?: string;
  readonly formula?: string;
}
export interface ComputeInput {
  /** A `!var.<id>` reference to its value (the view's `resolve`); absent = no variables. */
  resolve?(value: unknown): { value: unknown } | undefined;
  /** Today as `YYYY-MM-DD` — `today()` · `now()` read it (deterministic); absent = the clock. */
  today?: string;
  locale?: string;
}
/** The result types a computed column may declare (Decision 2 — the author picks one). */
export const FORMULA_RESULT_TYPES: readonly string[] = [
  "number",
  "string",
  "boolean",
  "date",
];
export const FORMULA_ENGINE_NOT_READY = "FORMULA_ENGINE_NOT_READY";

export const fieldId = (field: ComputedSchemaField) => field.id ?? field.key;
/** Whether a field is computed — the one test (a blank formula is not one). */
export const hasFormula = <T extends { readonly formula?: string }>(
  field: T,
): field is T & { formula: string } =>
  typeof field.formula === "string" && field.formula.trim() !== "";

const cellErrors = new WeakMap<object, Record<string, string>>();
/** A computed row's failed cells (`computeCells.ts` writes them). */
export function setFormulaCellErrors(
  row: object,
  errors: Record<string, string>,
): void {
  cellErrors.set(row, errors);
}
/** The computed cells of a row that failed, by key → the error's name (absent = none). */
export function formulaCellErrors(
  row: unknown,
): Readonly<Record<string, string>> | undefined {
  return row !== null && typeof row === "object"
    ? cellErrors.get(row)
    : undefined;
}

/** Rows with every computed field of `schema` written as a cell (the source rows untouched). */
export function withComputedCells(
  rows: readonly unknown[],
  schema: readonly ComputedSchemaField[],
  input: ComputeInput = {},
): readonly unknown[] {
  if (!schema.some(hasFormula)) return rows;
  const runtime = formulaRuntimeSync();
  if (runtime) return runtime.computeCells(runtime.engine, rows, schema, input);
  // (The first read of a document with formulas starts the load; the runtime reads the rows
  // again when it lands (`onFormulaEngineLoaded`) — until then the loud fallback below.)
  void loadFormulaEngine();
  const computed = schema.filter(hasFormula);
  return rows.map((row) => {
    if (row === null || typeof row !== "object") return row;
    const next: Record<string, unknown> = {
      ...(row as Record<string, unknown>),
    };
    const errors: Record<string, string> = {};
    for (const field of computed) {
      next[field.key] = null;
      errors[field.key] = FORMULA_ENGINE_NOT_READY;
    }
    cellErrors.set(next, errors);
    return next;
  });
}
