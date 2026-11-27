import { useContext, useEffect, useRef, type ReactElement } from "react";
import { useFormValidation } from "react-aria/private/form/useFormValidation";
import { useFormReset } from "react-aria/private/utils/useFormReset";
import { FormContext } from "react-aria-components/Form";
import { useFormValidationState } from "react-stately/private/form/useFormValidationState";
import type { CascaderFormProps } from "./cascader.components";

/**
 * ADR-322 Phase 6 — a Cascader's run in a form, loaded with the field (lazy — not on the Builder's
 * first screen):
 *
 * - breakdown §3.1 (the closed D1 exception, `ssot-hierarchy.md` §1 D1): the form value input —
 *   RAC `HiddenSelect`'s input — drawn when the field has a `name` (its value) or a native Form
 *   requires it (its check): one per key while it carries the value, one `""` when empty. The
 *   Form's validation way is RAC `FormContext`'s; the field's state is react-stately's (a required
 *   empty value, the response's field errors by `name`, an authored `isInvalid`), react-aria
 *   `useFormValidation` on the first input: its `invalid` shows the error (given to the field) and
 *   focuses the open Button; a form reset goes back to the start keys (`useFormReset`).
 * - breakdown §4.3 (사용자 결정 4): a key the server sent on two levels (its declaration broken)
 *   clears the value and says so.
 */
export default function CatalogCascaderForm({
  name,
  form,
  isRequired,
  isInvalid,
  isDisabled,
  keys,
  startKeys,
  levels,
  write,
  triggerRef,
  onValidation,
  commitRef,
}: CascaderFormProps): ReactElement {
  const validationBehavior =
    (
      useContext(FormContext) as {
        validationBehavior?: "native" | "aria";
      } | null
    )?.validationBehavior ?? "native";
  const native = validationBehavior === "native";
  const validation = useFormValidationState({
    value: keys.length ? keys.join("\u001f") : null,
    isRequired,
    isInvalid,
    name,
    validationBehavior,
  });
  commitRef.current = validation.commitValidation;
  const inputRef = useRef<HTMLInputElement>(null);
  useFormValidation(
    { validationBehavior, focus: () => triggerRef.current?.focus() },
    validation,
    inputRef,
  );
  useFormReset(inputRef, startKeys, (reset) => write(reset));
  const shown = validation.displayValidation;
  const shownKey = `${shown.isInvalid}\u001f${shown.validationErrors.join("\u001f")}`;
  useEffect(() => {
    onValidation(shown);
    // (Once per shown result — its object is new at every render.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);
  const brokenKeys = levels
    ? keys.filter((key) => levels.conflicts.has(key)).join("\u001f")
    : "";
  useEffect(() => {
    if (!brokenKeys) return;
    const broken = brokenKeys.split("\u001f");
    console.warn(
      `[Cascader] 서버 계약 위반 — 값의 key 가 두 단계에 있다: ${broken.join(", ")} (값을 비운다)`,
    );
    write(keys.filter((key) => !broken.includes(key)));
    // (The value's write once per broken key set.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokenKeys]);
  const values =
    !name && !(native && isRequired)
      ? []
      : keys.length === 0
        ? [""]
        : name
          ? keys
          : [keys[0]!];
  return (
    <>
      {values.map((value, index) => (
        <input
          key={index}
          ref={index === 0 ? inputRef : undefined}
          name={name || undefined}
          form={form || undefined}
          value={value}
          disabled={isDisabled === true}
          type={native ? "text" : "hidden"}
          style={native ? { display: "none" } : undefined}
          required={
            native && isRequired === true && index === 0 ? true : undefined
          }
          onChange={noChange}
        />
      ))}
    </>
  );
}

/** A value input's change (React wants one; the field writes the value). */
const noChange = () => {};
