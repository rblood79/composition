/**
 * ADR-912 family ②(fields) — Input leaf RAC primitive 의 `PrimitiveBinding`.
 * (단계 5 선행-6: field/form leaf catalog 등록 — RAC source, generic box+text 커버.)
 *
 * inventory(§B)는 Input 을 field 자식 sub-part 로 분류한다 — TextField/NumberField/SearchField 등의
 * origin template (`reusableOriginLibrary.ts`) 이 입력 영역 자식 노드로 둔다. RAC `<Input>` 은 부모
 * `<TextField>` Context 의 controller(value/onChange/focus/disabled)를 **slot 으로 자동 소비**하므로,
 * DOM 은 field 안에서 `<RAC.Input>` 이다 (`domBinding.tsx` `fieldInputBinding` — 여러 줄 field 는
 * `RAC.TextArea`). generic div 로 그리면 controller 가 끊긴다.
 *
 * **분류 = rac source catalog (사용자 confirm 2026-06-05)**: Input 은 "시각=자기 rule(bg/border/
 * text) + controller=부모 RAC slot(value/focus)" 혼합이다. 시각 source 가 자기 것이라 catalog 전환
 * 가능 — TextArea(rac source) 선례 동형. controller 는 RAC slot 이 그대로 처리(시각 무관).
 *
 * D1: RAC `Input` → `<input>` + 부모 TextField controller slot. RAC 가 ARIA/포커스 권위.
 * D2: type/placeholder + size.
 * D3: 시각(배경/테두리/폰트)은 input box — value-dependent 시각 없음(placeholder/value 는 단순 text)
 *     → box+text generic(buildCatalogShapes)으로 커버, skiaPrimitive 불필요. size 는 data-*
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
    },
    toRacProps: "default",
  },
};
