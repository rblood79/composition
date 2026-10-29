/**
 * ADR-291 Decision 3 · 4 — computed cells. `withComputedCells` writes every `formula` field of a
 * schema onto copies of the rows (the source rows untouched) at the row-reading stage, before a
 * view's conditions · aggregates · sort and the `{field}` templates read them. The row the
 * formula runs against is keyed by field **id** (the stored form reads `'f-price'`), computed
 * fields in dependency order (a formula may read another — a cycle is refused at definition).
 * A row's failure (a type error · 1/0) is `null` plus a cell marker (`formulaCellErrors`) — one
 * row never stops the view. The result is coerced to the field's `type` (Decision 2 · 4).
 */
import {
  compileFormula,
  daysToDateText,
  formulaEngineSync,
  loadFormulaEngine,
  withToday,
  type FormulaEngine,
} from "./engine";
import { FormulaScopeError, formulaScope } from "./scope";

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

const fieldId = (field: ComputedSchemaField) => field.id ?? field.key;
const hasFormula = (
  field: ComputedSchemaField,
): field is ComputedSchemaField & { formula: string } =>
  typeof field.formula === "string" && field.formula.trim() !== "";

/**
 * The schema's computed fields in evaluation order (a field after the computed fields it reads).
 * Throws `FORMULA_CYCLE` when they read each other in a loop (a self-reference included).
 */
export function computedFieldOrder(
  engine: FormulaEngine,
  schema: readonly ComputedSchemaField[],
): ComputedSchemaField[] {
  const computed = schema.filter(hasFormula);
  const byId = new Map(computed.map((field) => [fieldId(field), field]));
  const reads = new Map(
    computed.map((field) => [
      fieldId(field),
      [
        ...new Set(
          formulaScope(engine, field.formula).roots.map((root) => root.name),
        ),
      ].filter((id) => byId.has(id)),
    ]),
  );
  const order: ComputedSchemaField[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]) => {
    const seen = state.get(id);
    if (seen === "done") return;
    if (seen === "visiting")
      throw new FormulaScopeError(
        "FORMULA_CYCLE",
        `computed fields read each other in a loop: ${[...path, id].join(" → ")}`,
      );
    state.set(id, "visiting");
    for (const read of reads.get(id) ?? []) visit(read, [...path, id]);
    state.set(id, "done");
    order.push(byId.get(id)!);
  };
  for (const field of computed) visit(fieldId(field), []);
  return order;
}

/** A run's value as the column's type; undefined = not representable (the cell is `null`). */
export function coerceFormulaResult(
  value: unknown,
  type: string | undefined,
): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "number": {
      const number =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : NaN;
      return Number.isFinite(number) ? number : undefined;
    }
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "date": {
      if (typeof value === "number") return daysToDateText(value);
      if (typeof value === "string")
        return /^\d{4}-\d{2}-\d{2}/.test(value) ? value : undefined;
      return undefined;
    }
    default:
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean")
        return String(value);
      return undefined;
  }
}

const cellErrors = new WeakMap<object, Record<string, string>>();
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
  const engine = formulaEngineSync();
  const computed = schema.filter(hasFormula);
  if (!engine) {
    // (The first read of a document with formulas starts the load; the runtime reads the rows
    // again when it lands (`onFormulaEngineLoaded`) — until then the loud fallback below.)
    void loadFormulaEngine();
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
  const order = computedFieldOrder(engine, schema);
  const globals: Record<string, unknown> = {};
  for (const field of order)
    for (const name of formulaScope(engine, field.formula!).globals)
      globals[name] =
        input.resolve?.(`!var.${name.slice("$var_".length)}`)?.value ?? null;
  const language = input.locale ?? "en-US";
  return withToday(input.today, () =>
    rows.map((row) => {
      if (row === null || typeof row !== "object") return row;
      const source = row as Record<string, unknown>;
      const next: Record<string, unknown> = { ...source };
      const byId: Record<string, unknown> = {};
      for (const field of schema) byId[fieldId(field)] = source[field.key];
      let errors: Record<string, string> | undefined;
      for (const field of order) {
        let value: unknown;
        try {
          const raw = engine.formula.run(
            compileFormula(engine, field.formula!),
            byId,
            language,
            globals,
          );
          value = coerceFormulaResult(raw, field.type);
          if (value === undefined) {
            value = null;
            (errors ??= {})[field.key] = "FORMULA_RESULT_TYPE";
          }
        } catch (error) {
          value = null;
          (errors ??= {})[field.key] =
            error instanceof Error ? error.name : "Error";
        }
        next[field.key] = value;
        byId[fieldId(field)] = value;
      }
      if (errors) cellErrors.set(next, errors);
      return next;
    }),
  );
}
