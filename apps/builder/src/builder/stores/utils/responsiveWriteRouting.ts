import { isResponsiveEligibleStyleProp } from "@composition/shared";
import type {
  BreakpointName,
  ElementResponsiveConfig,
} from "@composition/shared";

/**
 * shorthand → longhand 분배 대상 (store longhand 정책, ADR-909).
 * `responsive.styles` 에 담기는 실제 키는 longhand 이므로 override 존재 판정도 longhand 로 본다.
 */
export const SHORTHAND_TO_LONGHAND: Record<string, readonly string[]> = {
  gap: ["rowGap", "columnGap"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
};

/**
 * style 값을 숫자로 coerce 하는 대상 속성 (Canvas spec shapes 는 숫자 기대). **base·responsive
 * 저장 경로 단일 SSOT** — base(`applyBaseStyleEntry` / write 3함수)와 responsive override
 * (`buildResponsiveStyleOverride`)가 동일 집합을 써야 override 토글이 단위 표현을 바꾸지 않는다.
 *
 * **width / height / margin / top / left 등 dimensional 축은 제외** — `%` / `vw` / `auto` 같은
 * 단위·키워드를 보존해야 하므로 문자열 그대로 저장한다(레이아웃 엔진이 문자열을 파싱). 과거
 * responsive 경로만 width/height/margin/order 를 추가로 coerce 해 `"50%"` → `50`(→ 50px) 로
 * 단위가 유실되던 비대칭(ADR-154 개정 1 후속 fix, 2026-07-23)을 본 단일화로 제거.
 */
export const NUMERIC_COERCE_STYLE_PROPS: ReadonlySet<string> = new Set([
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "opacity",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
  "borderWidth",
  "borderRadius",
]);

/**
 * numeric 대상 속성이면 `parseFloat` 로 숫자 변환(NaN 이면 원문 유지), 그 외(width/height 등
 * dimensional·키워드)는 문자열 그대로. base·responsive 저장 경로 공용.
 */
export function toStyleNumericValue(
  property: string,
  value: string,
): string | number {
  if (NUMERIC_COERCE_STYLE_PROPS.has(property)) {
    const num = parseFloat(value);
    if (!Number.isNaN(num)) return num;
  }
  return value;
}

/**
 * ADR-154 개정 1 후속(valueless-toggle): eligible prop 의 CSS-initial seed 값.
 *
 * "Add override" 토글 ON 시 현재 effective(base ⊕ cascade) 값을 tier override 로 복사하는데,
 * factory 기본값이 없는 prop(minWidth/maxWidth/flexGrow/alignSelf/aspectRatio 등)은 복사할 값이
 * 없어 아무것도 안 써지고 → data-derived 토글이 즉시 OFF 로 읽혀 override 가 안 걸렸다. 그 경우
 * 이 helper 의 CSS-initial 값으로 seed 해 토글을 고정하고 편집 가능한 필드를 노출한다. 초기값은
 * 시각 변화 0(예: minWidth:auto, flexGrow:0)이라 토글 순간 화면은 그대로다.
 *
 * 카테고리 기반이라 신규 eligible prop 추가 시에도 length→auto fallback 으로 자동 커버되며,
 * `responsiveWriteRouting.test.ts` 가 32개 eligible prop 전수에 대해 non-empty seed 를 정적 확증.
 */
const ENUM_SEED_DEFAULTS: Record<string, string> = {
  display: "flex",
  position: "static",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "stretch",
  justifyContent: "flex-start",
  alignSelf: "auto",
  justifySelf: "auto",
};

const NUMERIC_SEED_DEFAULTS: Record<string, string> = {
  flexGrow: "0",
  flexShrink: "1",
};

/** spacing 계열(gap/padding/margin + longhand)은 CSS-initial 이 0. */
const ZERO_SEED_PROPS: ReadonlySet<string> = new Set([
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);

export function resolveEligibleSeedDefault(property: string): string {
  if (property in ENUM_SEED_DEFAULTS) return ENUM_SEED_DEFAULTS[property];
  if (property in NUMERIC_SEED_DEFAULTS) return NUMERIC_SEED_DEFAULTS[property];
  if (ZERO_SEED_PROPS.has(property)) return "0";
  // width/height/min*/max*/top/left/flexBasis/aspectRatio 등 length 축 → auto(무변화).
  return "auto";
}

/**
 * ADR-154 개정 1: 해당 breakpoint tier 에 이 속성의 **명시 override 가 존재**하는지
 * (= 토글 ON 상태). shorthand(gap/padding/margin)는 longhand 중 하나라도 존재하면 ON.
 * cascade 상속값은 제외 — 자기 tier 의 명시 override 만 본다.
 */
export function hasOwnTierOverride(
  responsive: ElementResponsiveConfig | undefined,
  property: string,
  breakpoint: BreakpointName,
): boolean {
  const styles = responsive?.styles as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!styles) return false;
  const longhands = SHORTHAND_TO_LONGHAND[property] ?? [property];
  return longhands.some((key) => styles[key]?.[breakpoint] !== undefined);
}

/**
 * ADR-154 개정 1 — write 라우팅 단일 판정 (write 3함수 공통, R10).
 *
 * 편집을 base(전역) 대신 breakpoint tier override 로 라우팅할지 결정한다. 조건:
 * 비-desktop + eligible(Layout·Transform) + 해당 tier 토글 ON(명시 override 존재).
 * 하나라도 아니면 base 로 저장(어느 breakpoint 에서 편집하든 전역 적용 — 개정 기본 모델).
 * 토글 ON 은 `setResponsiveStyleOverrideEnabled` 로만 생성되므로, 토글 없이 편집하면
 * 항상 전역이다.
 */
export function shouldWriteBreakpointOverride(
  responsive: ElementResponsiveConfig | undefined,
  property: string,
  activeBreakpoint: BreakpointName,
): boolean {
  return (
    activeBreakpoint !== "desktop" &&
    isResponsiveEligibleStyleProp(property) &&
    hasOwnTierOverride(responsive, property, activeBreakpoint)
  );
}
