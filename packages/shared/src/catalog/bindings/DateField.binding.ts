/**
 * ADR-142 family ②(fields) — DateField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<DateField>` 가 Label/DateInput/
 * DateSegment slot 합성(D1 — DateInput/DateSegment 는 sub-part, 독립 binding 없음). leaf binding.
 *
 * D2: label/description + size/labelPosition/isQuiet + state. min/max/placeholderValue 는
 *     DateValue 타입(문자열 직렬화)이라 미노출(후속 — RAC 고급 props).
 * D3: 자식 DateInput 이 배경/세그먼트, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const dateFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "DateField",
  },
  rac: {
    primitive: "DateField",
    parts: ["label", "dateInput", "dateSegment", "description", "fieldError"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    renderProps: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    dataAttributes: [
      "data-disabled",
      "data-invalid",
      "data-readonly",
      "data-required",
    ],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      hideTimeZone: {
        kind: "boolean",
        label: "Hide Time Zone",
        section: "locale",
      },
      shouldForceLeadingZeros: {
        kind: "boolean",
        label: "Force Leading Zeros",
        section: "locale",
      },
      granularity: {
        kind: "enum",
        label: "Granularity",
        section: "content",
        options: [
          { value: "day", label: "Day" },
          { value: "hour", label: "Hour" },
          { value: "minute", label: "Minute" },
          { value: "second", label: "Second" },
        ],
      },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
    },
    toRacProps: "default",
    // size 는 DateField.tsx(DELEGATING 렌더)가 **React prop 으로 직접 소비**한다 (하위 Label/
    //   DateInput 크기 결정 + 자기 `data-size={size}` 를 `{...props}` 뒤에 재작성). catalog 의
    //   size kind 는 기본 data-attr 라우팅(`data-size`)이라 그대로 두면 wrapper 의 size 가
    //   undefined → **default("md") 고정**, 게다가 그 "md" 가 toRacProps 의 `data-size="xl"` 를
    //   **덮어써** Preview 가 size 변경을 전혀 반영 못 한다 (DatePicker 에서 재현된 버그와 동일
    //   구조 — 2026-07-14 전수 확장). ProgressCircle/Avatar/StatusLight 선례 동형.
    propPassthrough: ["size"],
  },
};
