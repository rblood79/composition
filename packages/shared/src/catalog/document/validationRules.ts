import {
  VIEW_COMPARISONS,
  type DataFieldId,
  type ViewCondition,
  type ViewConditionGroup,
} from "./types";

/**
 * S2 `validate` as condition rules (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 함수가
 * 아니라 데이터 보기의 조건 트리). A field's `validate` prop is a list of rules; each rule's `when` must
 * hold — when it does not, its `message` is the field's error (every failing rule's, S2's list). The
 * condition reads the field's own value (`$value` — a DateRangePicker's start, `$end` its end) and the
 * same Form's other fields by `name`; a value may be a literal or `!form.<name>` (another field's
 * value — a password confirmation).
 */
export interface CatalogValidationRule {
  id: string;
  when: ViewCondition | ViewConditionGroup;
  message: string;
}

/** The field's own value as a condition reads it (a DateRangePicker's start). */
export const CATALOG_VALIDATION_SELF = "$value";
/** A DateRangePicker's end. */
export const CATALOG_VALIDATION_END = "$end";
/** A value reading another field of the same Form (`!form.<name>`). */
export const CATALOG_VALIDATION_FORM_REF = "!form.";

/** A condition's field path for a subject (`$value` · a field `name`). */
export const catalogValidationPath = (subject: string): DataFieldId[] => [
  `data:field:${subject}`,
];

/** The subject a condition's first path names (`$value` · a field `name`). */
export const catalogValidationSubjectOf = (
  condition: ViewCondition,
): string | undefined =>
  condition.fields[0]?.[0]?.replace(/^data:field:/, "") || undefined;

const scalar = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

function conditionFits(value: unknown, depth: number): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return false;
  if ("items" in item) {
    return (
      depth < 4 &&
      (item.op === "and" || item.op === "or") &&
      Array.isArray(item.items) &&
      item.items.every((child) => conditionFits(child, depth + 1))
    );
  }
  return (
    Array.isArray(item.fields) &&
    item.fields.length > 0 &&
    item.fields.every(
      (path) =>
        Array.isArray(path) &&
        path.length === 1 &&
        typeof path[0] === "string" &&
        path[0].startsWith("data:field:") &&
        path[0].length > "data:field:".length,
    ) &&
    VIEW_COMPARISONS.includes(item.op as never) &&
    (item.value === undefined ||
      scalar(item.value) ||
      (Array.isArray(item.value) && item.value.every(scalar)))
  );
}

/** A `validate` prop value: a list of rules (`id` · `when` · a text `message`). */
export function catalogValidationRulesFit(
  value: unknown,
): value is readonly CatalogValidationRule[] {
  return (
    Array.isArray(value) &&
    value.every(
      (rule) =>
        !!rule &&
        typeof rule === "object" &&
        typeof (rule as CatalogValidationRule).id === "string" &&
        typeof (rule as CatalogValidationRule).message === "string" &&
        conditionFits((rule as CatalogValidationRule).when, 0),
    )
  );
}

/** The field types that take `validate` (S2 1.8.2 — the installed types' `validate` prop). */
export const CATALOG_VALIDATE_TYPES: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "SearchField",
  "NumberField",
  "ComboBox",
  "Select",
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
  "DateField",
  "DatePicker",
  "DateRangePicker",
  "TimeField",
  "ColorField",
  "Switch",
]);

/**
 * A field type's value as a condition reads it — the data field type its comparisons follow
 * (`viewFieldKind`): text · number · date · a list (several values) · a flag.
 */
export function catalogValidationValueType(
  type: string,
  props: Readonly<Record<string, unknown>>,
): "string" | "number" | "date" | "array" | "boolean" {
  switch (type) {
    case "NumberField":
      return "number";
    case "DateField":
    case "DatePicker":
    case "DateRangePicker":
      return "date";
    case "Checkbox":
    case "Switch":
      return "boolean";
    case "CheckboxGroup":
      return "array";
    case "Select":
      return props.selectionMode === "multiple" ? "array" : "string";
    default:
      return "string";
  }
}

/** The subjects a field's own value gives (`$value`; a DateRangePicker's `$value` · `$end`). */
export function catalogValidationOwnSubjects(type: string): readonly string[] {
  return type === "DateRangePicker"
    ? [CATALOG_VALIDATION_SELF, CATALOG_VALIDATION_END]
    : [CATALOG_VALIDATION_SELF];
}
