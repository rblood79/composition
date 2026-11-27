import { useContext, useRef, type RefObject } from "react";
import { useFormValidation } from "react-aria/private/form/useFormValidation";
import { useFormReset } from "react-aria/private/utils/useFormReset";
import { FormContext } from "react-aria-components/Form";
import { useFormValidationState } from "react-stately/private/form/useFormValidationState";
import type { CatalogCascaderFieldProps } from "./cascader.components";

/**
 * ADR-322 Phase 6 — a Cascader's run in a form, mounted synchronously with the field:
 *
 * - breakdown §3.1 (the closed D1 exception, `ssot-hierarchy.md` §1 D1): the form value input —
 *   RAC `HiddenSelect`'s input — drawn when the field has a `name` (its value) or a native Form
 *   requires it (its check): one per key while it carries the value, one `""` when empty. The
 *   Form's validation way is RAC `FormContext`'s; the field's state is react-stately's (a required
 *   empty value, the response's field errors by `name`, an authored `isInvalid`), react-aria
 *   `useFormValidation` on the first input: its `invalid` shows the error (given to the field) and
 *   focuses the open Button; a form reset goes back to the start keys (`useFormReset`).
 */
export function useCascaderForm(
  {
    name,
    form,
    isRequired,
    isInvalid,
    isDisabled,
    startKeys,
    keys: initialKeys,
  }: CatalogCascaderFieldProps,
  keys: readonly string[],
  change: (keys: readonly string[]) => void,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const validationBehavior =
    (
      useContext(FormContext) as {
        validationBehavior?: "native" | "aria";
      } | null
    )?.validationBehavior ?? "native";
  const native = validationBehavior === "native";
  const validation = useFormValidationState({
    value: keys.length ? JSON.stringify(keys) : null,
    isRequired,
    isInvalid,
    name,
    validationBehavior,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  useFormValidation(
    { validationBehavior, focus: () => triggerRef.current?.focus() },
    validation,
    inputRef,
  );
  const write = (next: readonly string[]) => {
    change(next);
    validation.commitValidation();
  };
  useFormReset(inputRef, startKeys ?? initialKeys, write);
  const values =
    !name && !(native && isRequired)
      ? []
      : keys.length === 0
        ? [""]
        : name
          ? keys
          : [keys[0]!];
  const inputs = values.map((value, index) => (
    <input
      key={index}
      ref={index === 0 ? inputRef : undefined}
      name={name || undefined}
      form={form || undefined}
      value={value}
      disabled={isDisabled === true}
      type={native ? "text" : "hidden"}
      style={native ? { display: "none" } : undefined}
      required={native && isRequired === true && index === 0 ? true : undefined}
      onChange={noChange}
    />
  ));
  return {
    inputs,
    shown: validation.displayValidation,
    write,
  };
}

/** A value input's change (React wants one; the field writes the value). */
const noChange = () => {};
