// ADR-912 6 registry collapse §2-5 #3 — Factory/default props 파생 SSOT
//
// 목적: `createDefault{Type}Props()` 손-코딩(unified.types.ts)을 catalog binding accepts.default
// 파생 + builder-local overlay 로 대체. 6 registry 중 #3(getDefaultProps/Factory default)을
// 단일 source 파생으로 collapse. ComponentList(#1) 의 catalog.panel 파생(paletteItems.ts)과 동형 —
// catalog SSOT + builder-local overlay 2층.
//
// 2층 구조:
//   [Layer 1 — catalog base]   shared getCatalogDefaultProps(type)
//                               = binding.props.accepts 중 default 가 있는 키(variant/size/
//                                 fillStyle/type/strokeWidth/staticColor 등 D2/D3 enum·number).
//   [Layer 2 — builder-local]  FACTORY_LOCAL_DEFAULTS[type]
//                               = catalog 에 표현 못 하는 잔여만 명시(children placeholder 텍스트 /
//                                 name / href / boolean state 초기값 / style placeholder).
//   [합성]                     { ...catalogBase, ...FACTORY_LOCAL_DEFAULTS[type] }
//                               builder-local 이 catalog base 를 override(의도적 충돌 지점은
//                               overlay 에 명시 + 주석으로 사유).
//
// 정합 보강(옵션 B, 사용자 결정 2026-06-11): factory 가 누락하던 catalog default(Button
// fillStyle:fill/type:button, Badge fillStyle:bold, Link staticColor:auto, Icon variant:default)는
// 파생 시 초기 props 에 포함된다 — catalog SSOT 가 권위 source 이므로 정합 개선. 신규 컴포넌트
// 생성 시 props 가 보강되며, Skia↔CSS 대칭은 cross-check 로 확증.
//
// 검증: __tests__/defaultPropsDerivation.test.ts — deriveDefaultPropsFromCatalog(type) ==
// FACTORY_ORACLE(현 factory ∪ catalog 목표값) 1:1. 회귀 0 이 #3 collapse kill criteria.

import { getCatalogDefaultProps } from "@composition/shared";
import type { ComponentElementProps } from "./unified.types";

/**
 * catalog 에 표현 못 하는 builder-local 잔여 default. type 별 명시.
 *
 * 포함 대상(catalog accepts 가 default 를 못 담는 것):
 * - children placeholder 텍스트 — accepts.children 은 kind:"string"(편집 surface)이라 default 없음.
 * - name:"" — form field id 초기값(builder runtime). href:"#" — nav-local.
 * - boolean state 초기값(isDisabled:false 등) — RAC controlled default 와 동치이나 명시 보존.
 * - style placeholder — layout/width 등 factory 합성, catalog 무관 영구 잔여.
 *
 * paletteItems.ts 의 PALETTE_ONLY overlay 와 동일 역할(catalog SSOT + builder-local).
 */
const FACTORY_LOCAL_DEFAULTS: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  Button: {
    children: "Button",
    name: "",
    isDisabled: false,
    isPending: false,
  },
  Badge: {
    children: "Badge",
    isDot: false,
    isPulsing: false,
  },
  Link: {
    children: "Link",
    href: "#",
    isDisabled: false,
    isExternal: false,
    showExternalIcon: true,
  },
  ToggleButton: {
    children: "Toggle Button",
    isEmphasized: false,
    isQuiet: false,
    isSelected: false,
    isDisabled: false,
  },
  Text: {
    children: "Text",
  },
  // Icon: iconName 은 random placeholder(POPULAR_ICONS) → 비결정적이라 overlay 에 두지 않고
  // deriveDefaultPropsFromCatalog 호출처(factory)가 합성. iconFontFamily 만 고정 overlay.
  Icon: {
    iconFontFamily: "lucide",
  },
};

/**
 * 6 registry collapse #3 의 단일 source. catalog binding accepts.default 파생 base 위에
 * builder-local overlay 를 합성하여 컴포넌트 초기 props 를 만든다.
 *
 * - catalog base: getCatalogDefaultProps(type) (variant/size/fillStyle/type 등 D2/D3 default).
 * - overlay: FACTORY_LOCAL_DEFAULTS[type] (children placeholder / name / state / style).
 *
 * overlay 가 catalog base 를 override — 의도적 충돌(conflict)은 overlay 에 키를 두고 주석 명기.
 * proof family(Button/Badge/Link/ToggleButton/Icon/Text)는 conflict 0.
 */
export function deriveDefaultPropsFromCatalog(
  type: string,
): ComponentElementProps {
  const catalogBase = getCatalogDefaultProps(type);
  const overlay = FACTORY_LOCAL_DEFAULTS[type] ?? {};
  return { ...catalogBase, ...overlay } as ComponentElementProps;
}

/**
 * 파생 family — collapse 대상으로 전환 완료된 type 집합. 이 집합의 createDefault*Props 는
 * deriveDefaultPropsFromCatalog 위임으로 대체됐다. conflict 0 + binding 보유 leaf 만 포함.
 *
 * 확장 시: conflict 키 검증(catalog default ↔ factory default 일치) + Skia↔CSS 대칭 cross-check
 * 통과 후 추가. conflict 보유 type(CheckboxGroup orientation / Table size / Meter value 등)은
 * 정본 SSOT 확정 전 자동 파생 금지(recon 2026-06-11 risk).
 */
export const CATALOG_DERIVED_DEFAULT_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "Badge",
  "Link",
  "ToggleButton",
  "Text",
  // Icon 은 iconName random 합성이 필요해 factory 가 deriveDefaultPropsFromCatalog 위에
  // iconName 만 추가 — 부분 파생. CATALOG_DERIVED 집합에는 포함(파생 base 사용).
  "Icon",
]);

/**
 * ADR-914 Phase 2 — `DEFAULT_PROPS_MAP` literal row 삭제 + `getDefaultProps` entry-derived
 * 단일 source 전환이 **완료된** type 집합.
 *
 * `CATALOG_DERIVED_DEFAULT_TYPES` 와의 차이:
 * - `CATALOG_DERIVED_DEFAULT_TYPES` = ADR-912 가 factory 본문을 파생으로 바꾼 6종 (row 는 잔존).
 * - `ENTRY_DERIVED_DEFAULT_TYPES` = ADR-914 가 row 를 삭제하고 `getDefaultProps` 가 파생만 답하는
 *   type. **Icon 제외** — Icon 의 live palette-add 경로는 random `iconName` 합성을 요구하는데
 *   `deriveDefaultPropsFromCatalog("Icon")` 는 iconName 미포함 → row 삭제 시 빈 아이콘 회귀.
 *   따라서 Icon row 는 `createDefaultIconProps` (random 합성) 로 유지한다.
 *
 * Phase 2a: Button 단일 (7-step ownership-transfer 메커니즘 검증).
 * Phase 2b: Badge/Link/ToggleButton/Text 확장 (각 deep-equal + strict key-set + G8 smoke 통과).
 *   4종 모두 현 row 가 이미 deriveDefaultPropsFromCatalog 위임이라 row 삭제 = 호출 경로 단축,
 *   값 byte-identical (conflict 0, random 합성 0). Icon 만 제외 (위 사유).
 */
export const ENTRY_DERIVED_DEFAULT_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "Badge",
  "Link",
  "ToggleButton",
  "Text",
]);
