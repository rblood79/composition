/**
 * ADR-142 family ①(primitives/actions) — ToggleButton leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * ToggleButton 은 Button 류 box+text leaf 에 selection 축(isSelected/isEmphasized)이 더해진다.
 * Skia 는 buildCatalogShapes 가 selected 축(fill.default.selected/emphasizedSelected 데이터)
 * 으로 재현. icon 합성은 reusable(아이콘 ToggleButton).
 *
 * D1: RAC `ToggleButton` 이 `<button aria-pressed>` 를 emit. isSelected/isDisabled RAC props.
 * D2: size/isSelected/isEmphasized/isQuiet/children 편집 surface.
 * D3: 시각(selected 배경/텍스트)은 theme/tokens data-* (data-selected/data-emphasized) rules.
 */

import type { PrimitiveBinding } from "../types";

export const toggleButtonBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ToggleButton",
  },
  rac: {
    primitive: "ToggleButton",
    parts: ["button"],
    slots: [],
    states: [
      "isSelected",
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
    ],
    renderProps: [
      "isSelected",
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
    ],
    dataAttributes: [
      "data-selected",
      "data-hovered",
      "data-pressed",
      "data-focused",
      "data-focus-visible",
      "data-disabled",
    ],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // RSP S2 staticColor (2026-08-21 채택) — 유색/이미지 배경 위 고정 흑백 스킴.
      //   Button/Link 와 동일 surface. CSS: 수동 ToggleButton.css [data-static-color]
      //   (catalog 토큰으로 표현 불가한 고정 흑백) / Skia: buildCatalogShapes 의 static
      //   블록이 컴포넌트 식별 없이 staticColor prop + fill 채널로만 분기해 이미 커버.
      staticColor: {
        kind: "enum",
        label: "Static Color",
        section: "appearance",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ],
      },
      // RAC ToggleButton selection / state props
      isSelected: { kind: "boolean", label: "Selected", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — renderToggleButton 배선 동반.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
};
