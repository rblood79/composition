/**
 * ADR-291 — a computed column's formula as the author types it (over field keys) read into the
 * stored form (over field ids) and checked as a definition of the column: syntax · references ·
 * functions · result type · cycles with the table's other computed columns. One module for the
 * column editor's edit and create modes (and the same checks the document validation runs).
 */
import {
  FORMULA_RESULT_TYPES,
  fieldId,
  type ComputedSchemaField,
} from "../../../../../../../packages/shared/src/collections/formula/compute";
import type { FormulaEngine } from "../../../../../../../packages/shared/src/collections/formula/engine";
import { formulaToStored } from "../../../../../../../packages/shared/src/collections/formula/names";
import { FormulaScopeError } from "../../../../../../../packages/shared/src/collections/formula/scope";
import {
  formulaCycleError,
  formulaDefinitionError,
} from "../../../../../../../packages/shared/src/collections/formula/validate";
import type {
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";

export type FormulaDraftResult =
  { readonly stored: string } | { readonly code: string };

/** The types a computed column may have (사용자 결정 7 — the author picks the result type). */
export const FORMULA_COLUMN_TYPES: readonly DataFieldType[] =
  FORMULA_RESULT_TYPES as readonly DataFieldType[];

/** A column's type as a computed column — kept when it is a result type, else `number`. */
export function formulaColumnType(type: DataFieldType): DataFieldType {
  return FORMULA_COLUMN_TYPES.includes(type) ? type : "number";
}

/**
 * The stored formula for `display` as the column `field` of `schema` (the column itself replaced
 * — or added when the schema does not hold it yet); else the first definition error's code.
 */
export function storeFormulaDraft(
  engine: FormulaEngine,
  display: string,
  field: Pick<DataField, "id" | "key" | "type">,
  schema: readonly Pick<DataField, "id" | "key" | "type" | "formula">[],
): FormulaDraftResult {
  const fields: readonly ComputedSchemaField[] = schema;
  let stored: string;
  try {
    stored = formulaToStored(engine, display, fields);
  } catch (error) {
    if (error instanceof FormulaScopeError) return { code: error.code };
    throw error;
  }
  const id = fieldId(field);
  const self: ComputedSchemaField & { formula: string } = {
    id,
    key: field.key,
    type: field.type,
    formula: stored,
  };
  const index = fields.findIndex((item) => fieldId(item) === id);
  const next =
    index >= 0
      ? fields.map((item, at) => (at === index ? self : item))
      : [...fields, self];
  const problem =
    formulaDefinitionError(engine, self, next) ??
    formulaCycleError(engine, next);
  return problem ? { code: problem.code } : { stored };
}
