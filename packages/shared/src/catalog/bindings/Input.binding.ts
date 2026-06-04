/**
 * ADR-912 family ②(fields) — Input leaf RAC primitive 의 `PrimitiveBinding`.
 * (단계 5 선행-6: field/form leaf catalog 등록 — RAC source, generic box+text 커버.)
 *
 * inventory(§B)는 Input 을 field 자식 sub-part 로 분류한다 — `createInput` 단독 factory 가 없고
 * TextField/NumberField/SearchField/DateField 가 입력 영역 자식으로 자동 생성한다(FormComponents.ts:57
 * / DateColorComponents.ts:420). RAC `<Input>` 은 부모 `<TextField>` Context 의 controller(value/
 * onChange/focus/disabled)를 **slot 으로 자동 소비**하므로, DOM 은 catalog cutover 후에도 `<RAC.Input>`
 * 을 유지해야 controller 연결이 보존된다(generic div 전환 시 controller 단절).
 *
 * **분류 = rac source catalog (사용자 confirm 2026-06-05)**: Input 은 "시각=자기 source(bg/border/
 * text, Input.spec.ts:215-252) + controller=부모 RAC slot(value/focus)" 혼합이다. 시각 source 가
 * 자기 것이라 catalog 발효 가능 — TextArea(rac source) 선례 동형. controller 는 RAC slot 이 그대로
 * 처리(시각 무관).
 *
 * D1: RAC `Input` → `<input>` + 부모 TextField controller slot. RAC 가 ARIA/포커스 권위.
 * D2: type/placeholder/value + size/variant + state(disabled/readonly/invalid).
 * D3: 시각(배경/테두리/폰트)은 input box — value-dependent 시각 없음(placeholder/value 는 단순 text)
 *     → box+text generic(buildCatalogShapes)으로 커버, skiaPrimitive 불필요. size/variant 는 data-*
 *     라우팅(theme 가 시각 적용).
 */

import type { PrimitiveBinding } from "../types";

export const inputBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Input",
  },
  rac: {
    primitive: "Input",
    parts: ["input"],
    slots: [],
    states: ["isDisabled", "isInvalid", "isReadOnly"],
    renderProps: ["isDisabled", "isInvalid", "isReadOnly"],
    dataAttributes: ["data-disabled", "data-invalid", "data-readonly"],
  },
  props: {
    accepts: {
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      value: { kind: "string", label: "Value", section: "content" },
      type: {
        kind: "enum",
        label: "Type",
        section: "content",
        default: "text",
        options: [
          { value: "text", label: "Text" },
          { value: "email", label: "Email" },
          { value: "password", label: "Password" },
          { value: "search", label: "Search" },
          { value: "tel", label: "Tel" },
          { value: "url", label: "URL" },
          { value: "number", label: "Number" },
        ],
      },
      // 시각 차원 → data-size / data-variant (theme 가 값 집합 제공)
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      variant: {
        kind: "enum",
        label: "Variant",
        section: "appearance",
        default: "default",
        options: [
          { value: "default", label: "Default" },
          { value: "accent", label: "Accent" },
          { value: "negative", label: "Negative" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
    },
    toRacProps: "default",
  },
};
