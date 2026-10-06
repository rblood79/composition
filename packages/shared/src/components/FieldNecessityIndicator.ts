import { createElement, isValidElement, type ReactNode } from "react";
import {
  FieldError,
  type FieldErrorProps,
} from "react-aria-components/FieldError";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";

export type NecessityIndicator = "icon" | "label";

/**
 * Necessity indicator suffix 텍스트 반환 (WebGL 3경로 공유 유틸)
 * Preview/Taffy/Skia 모두 이 함수를 사용하여 동일한 텍스트를 생성
 *
 * 값이 없으면 icon 이다 — RSP 기본값이고 binding 기본값 (`necessityIndicator.default: "icon"`,
 * Properties 패널 표시) 과 같다. 필수 field 는 prop 을 고르지 않아도 `*` 를 붙인다 (사용자 결정
 * 2026-09-29).
 */
export function getNecessityIndicatorSuffix(
  necessityIndicator?: string,
  isRequired?: boolean,
): string {
  if (!necessityIndicator || necessityIndicator === "icon")
    return isRequired ? " *" : "";
  if (necessityIndicator === "label")
    return isRequired ? " (required)" : " (optional)";
  return "";
}

/**
 * Label 뒤에 필수/선택 표시를 렌더링하는 유틸리티 컴포넌트 (Preview 전용)
 * - icon (값 없음 포함): * (asterisk)
 * - label: "(required)" or "(optional)"
 */
export function renderNecessityIndicator(
  necessityIndicator?: NecessityIndicator,
  isRequired?: boolean,
): ReactNode {
  if (!necessityIndicator || necessityIndicator === "icon") {
    if (!isRequired) return null;
    return createElement(
      "span",
      {
        className: "necessity-indicator icon",
        "aria-hidden": true,
      },
      "*",
    );
  }

  const text = isRequired ? "(required)" : "(optional)";
  return createElement(
    "span",
    {
      className: "necessity-indicator label",
      "aria-hidden": isRequired ? "true" : undefined,
    },
    text,
  );
}

/**
 * A field's Label (ADR-253). The catalog runtime passes the field's Label node as `label`: an
 * element that node's binding drew (a RAC Label inside this field's context, with what the field
 * appends to it), placed as it is. Any other `label` is composed here from the field's props.
 */
export function renderFieldLabel(
  label: ReactNode,
  necessityIndicator?: NecessityIndicator,
  isRequired?: boolean,
): ReactNode {
  if (!label) return null;
  if (isValidElement(label)) return label;
  return createElement(
    Label,
    null,
    label,
    renderNecessityIndicator(necessityIndicator, isRequired),
  );
}

/**
 * A field's description (ADR-253): the field's Description node element from the catalog runtime
 * (placed as it is), else composed from the field's `description` prop.
 */
export function renderFieldDescription(description: ReactNode): ReactNode {
  if (!description) return null;
  if (isValidElement(description)) return description;
  return createElement(Text, { slot: "description" }, description);
}

/**
 * A field's error message (ADR-253): the field's FieldError node element from the catalog runtime
 * (a RAC FieldError its binding drew — RAC shows it while the field is invalid), else composed
 * from the field's `errorMessage` prop.
 */
export function renderFieldError(
  errorMessage: FieldErrorProps["children"],
): ReactNode {
  if (isValidElement(errorMessage)) return errorMessage;
  return createElement(FieldError, { children: errorMessage });
}

/**
 * A field's control (ADR-253): the field's Input node element from the catalog runtime (a RAC
 * Input its binding drew inside this field's context), else the control the field composes from
 * its own props.
 */
export function renderFieldInput(
  inputElement: ReactNode,
  composed: ReactNode,
): ReactNode {
  return isValidElement(inputElement) ? inputElement : composed;
}
