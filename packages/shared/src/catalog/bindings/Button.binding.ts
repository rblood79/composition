/**
 * ADR-142 — Button leaf RAC primitive 의 첫 `PrimitiveBinding` (Phase 1 파일럿, M1 #7).
 *
 * 파일럿 발견 (legacy `ButtonSpec` 대비):
 * - **icon 합성 분리**: legacy ButtonSpec 은 `iconName`/`iconPosition`/`iconStrokeWidth`
 *   를 번들했으나, ADR-142 모델에서 "아이콘이 붙은 Button" 은 **reusable 조합 문서**
 *   (설계 §3 line 193). leaf Button primitive 의 `accepts` 는 RAC Button D2 surface
 *   로만 한정 → 조합은 데이터(reusable)로 분리된다는 논지를 검증.
 * - **fillStyle (foundation #2 추가)**: `fillStyle` 은 D3 visual 차원으로, visual-enum
 *   data-* 라우팅 규칙(`kind:"fillStyle"` → `data-fill-style`, camelCase→kebab) 위에서
 *   accepts 에 포함. theme CSS `[data-fill-style="outline"]` 가 styling, Skia 는
 *   `buildCatalogShapes` 가 `fill.outline`/`subtle` 소비.
 *
 * 시각(variant/size 값 집합, 색상)은 theme/tokens 가 `data-*` 규칙으로 적용 — 본 binding 에 없음.
 */

import type { PrimitiveBinding, PropContract } from "../types";
import { formBinding } from "./Form.binding";

const {
  method: { default: _methodDefault, ...formMethod },
  encType: formEncType,
  target: formTarget,
} = formBinding.props.accepts as Required<typeof formBinding.props.accepts>;

/**
 * S2 `ButtonProps` · `ActionButtonProps` (RAC `ButtonProps`) 의 form 제출 · focus 속성. 개발자용 HTML
 * 속성이라 받기만 하고 패널에 내지 않는다 (2026-11-11 사용자 결정) — ActionButton 2026-11-14,
 * Button 2026-11-18 (사용자 §7-4 「ActionButton 처럼 숨김 추가」). LinkButton (RAC `LinkProps`) 은
 * 받지 않는다.
 */
export const BUTTON_FORM_FOCUS_ACCEPTS: Readonly<Record<string, PropContract>> =
  {
    name: {
      kind: "string",
      label: "Name",
      section: "forms",
      editorHidden: true,
    },
    value: {
      kind: "string",
      label: "Submit value",
      section: "forms",
      editorHidden: true,
    },
    form: {
      kind: "string",
      label: "Form",
      section: "forms",
      editorHidden: true,
    },
    formAction: {
      kind: "string",
      label: "Form action",
      section: "forms",
      editorHidden: true,
    },
    formMethod: { ...formMethod, label: "Form method", section: "forms" },
    formEncType: { ...formEncType, label: "Form enc type", section: "forms" },
    formTarget: { ...formTarget, label: "Form target", section: "forms" },
    formNoValidate: {
      kind: "boolean",
      label: "Form no validate",
      section: "forms",
      editorHidden: true,
    },
    excludeFromTabOrder: {
      kind: "boolean",
      label: "Exclude from tab order",
      section: "state",
      editorHidden: true,
    },
    preventFocusOnPress: {
      kind: "boolean",
      label: "Prevent focus on press",
      section: "state",
      editorHidden: true,
    },
  };

export const buttonBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Button",
  },
  rac: {
    primitive: "Button",
    parts: ["button"],
    slots: [],
    states: [
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
      "isPending",
    ],
    renderProps: [
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
      "isPending",
    ],
    dataAttributes: [
      "data-hovered",
      "data-pressed",
      "data-focused",
      "data-focus-visible",
      "data-disabled",
      "data-pending",
    ],
  },
  props: {
    accepts: {
      // The authored context role remains available to Code and composed defaults.
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
      children: { kind: "string", label: "Label", section: "content" },
      // 시각 차원 → data-variant / data-size (theme 가 값 집합 제공)
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "primary",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // visual-enum (fixed options) → data-fill-style 라우팅 (theme/Skia 가 시각 적용)
      fillStyle: {
        kind: "fillStyle",
        label: "Fill Style",
        section: "appearance",
        default: "fill",
        options: [
          { value: "fill", label: "Fill" },
          { value: "outline", label: "Outline" },
        ],
      },
      // RSP S2 staticColor (2026-08-20 채택) — 유색/이미지 배경 위 고정 흑백 스킴.
      //   Link.binding 과 동일 surface. CSS: Button.css [data-static-color] /
      //   Skia: buildCatalogShapes static 블록 + resolveButtonChildColor.
      staticColor: {
        kind: "enum",
        label: "Static Color",
        section: "appearance",
        options: [
          { value: "", label: "None" },
          { value: "auto", label: "Auto" },
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ],
      },
      // RAC Button props
      type: {
        kind: "enum",
        label: "Type",
        section: "state",
        default: "button",
        options: [
          { value: "button", label: "Button" },
          { value: "submit", label: "Submit" },
          { value: "reset", label: "Reset" },
        ],
      },
      isPending: { kind: "boolean", label: "Pending", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — generic toRacProps 경로.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      ...BUTTON_FORM_FOCUS_ACCEPTS,
    },
    toRacProps: "default",
  },
};
