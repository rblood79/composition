/**
 * ADR-291 Decision 3 — a computed field's definition check (syntax · root references · globals ·
 * functions · result type · cycles). Sync: the document validation calls it when the engine is
 * loaded (the data sink loads it before writing a formula); a document read before the engine
 * loads keeps the shape check only — what it holds was checked when it was written.
 */
import { isFormulaFunction, isHiddenFormulaFunction } from "./allowed";
import { FORMULA_RESULT_TYPES, type ComputedSchemaField } from "./compute";
import { computedFieldOrder } from "./computeCells";
import type { FormulaEngine } from "./engine";
import {
  FormulaScopeError,
  formulaScope,
  type FormulaScopeCode,
} from "./scope";

export interface FormulaDefinitionError {
  readonly code: FormulaScopeCode;
  readonly detail: string;
}
const error = (
  code: FormulaScopeCode,
  detail: string,
): FormulaDefinitionError => ({
  code,
  detail,
});
export const FORMULA_VARIABLE_PREFIX = "$var_";

/** The first thing wrong with one computed field of `schema`; undefined = sound. */
export function formulaDefinitionError(
  engine: FormulaEngine,
  field: ComputedSchemaField & { formula: string },
  schema: readonly ComputedSchemaField[],
): FormulaDefinitionError | undefined {
  if (!FORMULA_RESULT_TYPES.includes(field.type ?? ""))
    return error(
      "FORMULA_RESULT_TYPE",
      `a computed field's type is one of ${FORMULA_RESULT_TYPES.join(" · ")}, not \`${field.type}\``,
    );
  let scope;
  try {
    scope = formulaScope(engine, field.formula);
  } catch (caught) {
    if (caught instanceof FormulaScopeError)
      return error(caught.code, caught.message);
    throw caught;
  }
  for (const global of scope.globals)
    if (
      !global.startsWith(FORMULA_VARIABLE_PREFIX) ||
      global.length === FORMULA_VARIABLE_PREFIX.length
    )
      return error(
        "FORMULA_GLOBAL",
        `\`${global}\` — a variable is read as \`$var_<id>\``,
      );
  for (const name of scope.functions) {
    if (isHiddenFormulaFunction(name))
      return error(
        "FORMULA_FUNCTION_HIDDEN",
        `\`${name}()\` is not available to a formula`,
      );
    if (!isFormulaFunction(name))
      return error(
        "FORMULA_UNKNOWN_FUNCTION",
        `no such function \`${name}()\``,
      );
  }
  const ids = new Set(schema.map((item) => item.id ?? item.key));
  for (const root of scope.roots)
    if (!ids.has(root.name))
      return error(
        "FORMULA_UNKNOWN_FIELD",
        `\`${root.name}\` is not a field of the collection`,
      );
  return undefined;
}

/** A loop among the schema's computed fields; undefined = none. */
export function formulaCycleError(
  engine: FormulaEngine,
  schema: readonly ComputedSchemaField[],
): FormulaDefinitionError | undefined {
  try {
    computedFieldOrder(engine, schema);
    return undefined;
  } catch (caught) {
    if (caught instanceof FormulaScopeError)
      return error(caught.code, caught.message);
    throw caught;
  }
}
