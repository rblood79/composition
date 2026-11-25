import {
  explainViewRow,
  type ViewRunField,
} from "../../collections/view/evaluate";
import type { ViewConditionGroup } from "../document/types";
import {
  CATALOG_VALIDATE_TYPES,
  CATALOG_VALIDATION_END,
  CATALOG_VALIDATION_FORM_REF,
  CATALOG_VALIDATION_SELF,
  catalogValidationRulesFit,
  catalogValidationValueType,
  type CatalogValidationRule,
} from "../document/validationRules";

/**
 * S2 `validate` from a field's condition rules (S2 체크리스트 부록 D.3 2단계, 2026-11-23): the rules
 * are judged by the data view's evaluator (`explainViewRow` — one row: the field's own value and the
 * same Form's named fields), and every rule whose condition misses gives its message. RAC runs it on
 * the committed value (blur · submit) as it runs S2's function.
 */

interface RecordLike {
  id: string;
  parentId?: string;
  children: readonly string[];
  props: Readonly<Record<string, unknown>>;
}

export interface CatalogValidationLookup<R extends RecordLike> {
  get(id: string): R | undefined;
  typeOf(record: R): string;
}

/** A field of a Form a rule may read: its record, `name` and type. */
export interface CatalogFormField<R extends RecordLike> {
  record: R;
  name: string;
  type: string;
}

/** The Form a record is in (itself, or the nearest around it). */
export function catalogFormOf<R extends RecordLike>(
  record: R,
  lookup: CatalogValidationLookup<R>,
): R | undefined {
  for (
    let current: R | undefined = record;
    current;
    current = current.parentId ? lookup.get(current.parentId) : undefined
  )
    if (lookup.typeOf(current) === "Form") return current;
  return undefined;
}

/** A Form's named fields (the field types that validate), in document order. */
export function catalogFormFieldsOf<R extends RecordLike>(
  form: R,
  lookup: CatalogValidationLookup<R>,
): CatalogFormField<R>[] {
  const fields: CatalogFormField<R>[] = [];
  const visit = (record: R) => {
    for (const childId of record.children) {
      const child = lookup.get(childId);
      if (!child) continue;
      const type = lookup.typeOf(child);
      if (CATALOG_VALIDATE_TYPES.has(type)) {
        const name = child.props.name;
        if (typeof name === "string" && name.trim())
          fields.push({ record: child, name: name.trim(), type });
        continue;
      }
      // (A Form inside a Form is its own.)
      if (type !== "Form") visit(child);
    }
  };
  visit(form);
  return fields;
}

/** The state prop holding a field's current value (its runtime value in a running Preview). */
export function catalogValidationStateProp(type: string): string {
  if (type === "Checkbox" || type === "Switch") return "isSelected";
  if (type === "ComboBox") return "inputValue";
  return "value";
}

/**
 * A field's value as a condition reads it: RAC's value (a `DateValue` · `TimeValue` · `Color` · a
 * `Set` · a ComboBox's `{inputValue}`) or the document's runtime value (ISO texts · key lists) — a
 * text, a number, a list or a flag. A range is `{start, end}` (read as `$value` · `$end`).
 */
function catalogValidationValue(type: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return Number.isNaN(raw) ? undefined : raw;
  if (typeof raw === "string" || typeof raw === "boolean") return raw;
  if (raw instanceof Set || Array.isArray(raw)) return [...raw].map(String);
  if (typeof raw === "object") {
    const object = raw as Record<string, unknown> & {
      toString(format?: string): string;
    };
    if (type === "ComboBox" && "inputValue" in object)
      return String(object.inputValue ?? "");
    if (type === "ColorField") return object.toString("hex");
    if ("start" in object || "end" in object)
      return {
        start: catalogValidationValue("", object.start),
        end: catalogValidationValue("", object.end),
      };
    return object.toString();
  }
  return undefined;
}

/** The row a rule reads: the own value (`$value` · `$end`) and the Form's fields by `name`. */
function validationRow(
  type: string,
  own: unknown,
  formValues: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const value = catalogValidationValue(type, own);
  const row: Record<string, unknown> = { ...formValues };
  if (type === "DateRangePicker") {
    const range = (value ?? {}) as { start?: unknown; end?: unknown };
    row[CATALOG_VALIDATION_SELF] = range.start;
    row[CATALOG_VALIDATION_END] = range.end;
  } else row[CATALOG_VALIDATION_SELF] = value;
  return row;
}

export interface CatalogValidationInput {
  type: string;
  props: Readonly<Record<string, unknown>>;
  /** The same Form's named fields: their types and current values. */
  formFields: readonly {
    name: string;
    type: string;
    props: Readonly<Record<string, unknown>>;
    value: unknown;
  }[];
  locale?: string;
}

/** The messages of the rules a value fails (none = valid). */
export function catalogValidationErrors(
  rules: readonly CatalogValidationRule[],
  own: unknown,
  input: CatalogValidationInput,
): string[] {
  const formValues: Record<string, unknown> = {};
  const schema: ViewRunField[] = [];
  const ownType = catalogValidationValueType(input.type, input.props);
  schema.push({
    id: CATALOG_VALIDATION_SELF,
    key: CATALOG_VALIDATION_SELF,
    type: ownType,
  });
  if (input.type === "DateRangePicker")
    schema.push({
      id: CATALOG_VALIDATION_END,
      key: CATALOG_VALIDATION_END,
      type: ownType,
    });
  for (const field of input.formFields) {
    formValues[field.name] = catalogValidationValue(field.type, field.value);
    schema.push({
      id: field.name,
      key: field.name,
      type: catalogValidationValueType(field.type, field.props),
    });
  }
  const row = validationRow(input.type, own, formValues);
  const resolve = (value: unknown): { value: unknown } | undefined => {
    if (
      typeof value === "string" &&
      value.startsWith(CATALOG_VALIDATION_FORM_REF)
    ) {
      const name = value.slice(CATALOG_VALIDATION_FORM_REF.length);
      return Object.hasOwn(row, name) ? { value: row[name] } : undefined;
    }
    // (`!var` · `!event` are a rule's run values — a field's rule reads literals and its Form.)
    if (typeof value === "string" && value.startsWith("!")) return undefined;
    return { value };
  };
  const messages: string[] = [];
  for (const rule of rules) {
    const where: ViewConditionGroup =
      "items" in rule.when
        ? rule.when
        : { id: `${rule.id}:when`, op: "and", items: [rule.when] };
    const verdict = explainViewRow(row, {
      queries: [{ where }],
      schema,
      resolve,
      ...(input.locale ? { locale: input.locale } : {}),
    }).get(where.id);
    if (verdict === "miss" && rule.message.trim())
      messages.push(rule.message.trim());
  }
  return messages;
}

/** A field record's rules (`validate`), when it has any. */
export function catalogValidationRulesOf(
  props: Readonly<Record<string, unknown>>,
): readonly CatalogValidationRule[] | undefined {
  const rules = props.validate;
  return catalogValidationRulesFit(rules) && rules.length ? rules : undefined;
}

/** The Form fields a field's rules read by name (`fields` · `!form.<name>` values). */
export function catalogValidationReads(
  rules: readonly CatalogValidationRule[],
): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (item: CatalogValidationRule["when"]) => {
    if ("items" in item) {
      item.items.forEach(visit);
      return;
    }
    for (const path of item.fields) {
      const name = path[0]?.replace(/^data:field:/, "");
      if (name && !name.startsWith("$")) names.add(name);
    }
    for (const value of Array.isArray(item.value) ? item.value : [item.value])
      if (
        typeof value === "string" &&
        value.startsWith(CATALOG_VALIDATION_FORM_REF)
      )
        names.add(value.slice(CATALOG_VALIDATION_FORM_REF.length));
  };
  rules.forEach((rule) => visit(rule.when));
  return names;
}
