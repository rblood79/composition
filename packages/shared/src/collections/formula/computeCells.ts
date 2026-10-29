/**
 * ADR-291 Decision 3 · 4 — the computed cell run (loaded with the engine — `engine.ts`): fields in
 * dependency order, each result coerced to its `type`, a row's failure as `null` + a cell marker,
 * and the cache (R6 — per source rows · run key and per source row).
 */
import {
  fieldId,
  hasFormula,
  setFormulaCellErrors,
  type ComputedSchemaField,
  type ComputeInput,
} from "./compute";
import type { FormulaEngine } from "./engine";
import { compileFormula, daysToDateText, withToday } from "./instance";
import { FormulaScopeError, formulaScope } from "./scope";

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

/**
 * The computed rows per source rows array and run key (ADR-291 R6): a variable write re-runs a
 * view's conditions and sort, not its formulas — the cells depend on the rows, the formulas, the
 * variables they read, today and the language only. A few keys per rows (bindings reading one
 * collection with other values); the oldest goes first.
 */
const computedRuns = new WeakMap<object, Map<string, readonly unknown[]>>();
/** The computed copy per source row and run key — a new rows array (a page more, a row edited)
 * computes only the rows it has not seen. */
const computedRowCopies = new WeakMap<object, { key: string; row: unknown }>();
const COMPUTED_RUNS_PER_ROWS = 4;

/** `withComputedCells` once the engine is loaded (`compute.ts` calls it through the runtime). */
export function computeCellsWith(
  engine: FormulaEngine,
  rows: readonly unknown[],
  schema: readonly ComputedSchemaField[],
  input: ComputeInput = {},
): readonly unknown[] {
  const order = computedFieldOrder(engine, schema);
  const globals: Record<string, unknown> = {};
  let readsClock = false;
  for (const field of order) {
    const scope = formulaScope(engine, field.formula!);
    for (const name of scope.globals)
      globals[name] =
        input.resolve?.(`!var.${name.slice("$var_".length)}`)?.value ?? null;
    // (`now()` is the time of the run — such a formula is never served from the cache.)
    readsClock ||= scope.functions.includes("now");
  }
  const language = input.locale ?? "en-US";
  const key = readsClock
    ? undefined
    : JSON.stringify([
        schema.map((field) => [
          fieldId(field),
          field.key,
          field.type ?? null,
          field.formula ?? null,
        ]),
        globals,
        input.today ?? new Date().toISOString().slice(0, 10),
        language,
      ]);
  const runs = key === undefined ? undefined : computedRuns.get(rows);
  const cached = key === undefined ? undefined : runs?.get(key);
  if (cached) return cached;
  const computeRow = (source: Record<string, unknown>) => {
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
    if (errors) setFormulaCellErrors(next, errors);
    return next;
  };
  const result = withToday(input.today, () =>
    rows.map((row) => {
      if (row === null || typeof row !== "object") return row;
      if (key === undefined) return computeRow(row as Record<string, unknown>);
      const seen = computedRowCopies.get(row);
      if (seen?.key === key) return seen.row;
      const next = computeRow(row as Record<string, unknown>);
      computedRowCopies.set(row, { key, row: next });
      return next;
    }),
  );
  if (key !== undefined) {
    const map = runs ?? new Map<string, readonly unknown[]>();
    if (!runs) computedRuns.set(rows, map);
    if (map.size >= COMPUTED_RUNS_PER_ROWS) map.delete(map.keys().next().value!);
    map.set(key, result);
  }
  return result;
}
