/**
 * S2 1.8.0 Form context (`Form.tsx` `FormContext` · `useFormProps`): a field takes the nearest
 * Form's value for each of these keys it did not set itself (S2 fills only `undefined` keys). The
 * resolver applies it (`resolveCatalogNode` — `applyFormContext`), so the Canvas and the DOM read
 * one record (2026-10-09 — before, the field origin's own `labelPosition: "top"` hid the Form's on
 * both, and the Canvas read no Form value but the necessity indicator).
 *
 * `size` · `isEmphasized` are in S2's context too; they are not here yet (our Form's size and the
 * fields' `isEmphasized` are separate items of the S2 prop survey).
 */
export const CATALOG_FORM_CONTEXT_KEYS = [
  "labelPosition",
  "labelAlign",
  "necessityIndicator",
  "isRequired",
  "isDisabled",
] as const;

/**
 * The fields that read the Form context — S2's `useFormProps` fields (TextField · NumberField ·
 * SearchField · ColorField · Picker · ComboBox · Checkbox · CheckboxGroup · RadioGroup · Switch ·
 * Slider · TagGroup) and our date fields (which our DOM gave the Form's label layout before). A key
 * reaches a field only when the field accepts it. Not the parts inside a field (a stepper Button,
 * an Input): the field's own state reaches them.
 */
export const CATALOG_FORM_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
  "Switch",
  "Slider",
  "TagGroup",
]);
