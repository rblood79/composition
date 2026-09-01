/**
 * CSS Cascade Resolver
 *
 * CSS `inherit` 키워드와 상속 가능 속성(inheritable properties)을 처리한다.
 * 부모의 computed style에서 자식으로 값을 전파하며,
 * 명시적 `inherit` 키워드는 부모 값을 그대로 유지한다.
 *
 * Phase 5 (2026-02-19):
 * - currentColor 키워드: color 속성 값을 색상 속성에 전파
 * - initial 키워드: CSS 사양 초기값으로 되돌림
 * - unset 키워드: 상속 가능 → inherit, 비상속 → initial
 * - revert 키워드: 노코드 빌더에서는 initial과 동일하게 처리
 * - font shorthand: parseFontShorthand()로 개별 속성 분리
 * - logical properties: LTR horizontal-tb 기준으로 물리 속성으로 변환
 *
 * @since 2026-02-16 S4 - CSS Cascade (inherit + var())
 * @updated 2026-02-19 Phase 5 - currentColor + initial/unset/revert
 */

import { parseFontShorthand } from "./cssValueParser";
import { FONT_STRETCH_KEYWORD_MAP } from "@composition/specs";
import { useThemeConfigStore } from "../../../../../stores/themeConfigStore";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../fonts/customFonts";

// ============================================
// 상속 가능 속성 목록
// ============================================

/**
 * CSS 명세에서 기본적으로 상속되는 속성 목록
 *
 * 참고: https://developer.mozilla.org/en-US/docs/Web/CSS/inheritance
 */
export const INHERITABLE_PROPERTIES = new Set([
  "color",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textAlign",
  "textTransform",
  "textIndent",
  "visibility",
  "wordBreak",
  "overflowWrap",
  "whiteSpace",
]);

// ============================================
// CSS 속성 초기값 맵 (initial 키워드용)
// ============================================

/**
 * CSS 속성별 초기값 (CSS 명세 기반)
 *
 * `initial` 키워드를 처리할 때 이 맵에서 초기값을 조회한다.
 * `revert` 키워드도 노코드 빌더에서는 initial과 동일하게 처리한다.
 *
 * 참고: https://developer.mozilla.org/en-US/docs/Web/CSS/initial_value
 */
export const CSS_INITIAL_VALUES: Record<string, string | number> = {
  // 상속 속성
  color: "#000000",
  fontSize: 16,
  fontWeight: "400",
  fontStyle: "normal",
  fontFamily: "sans-serif",
  fontVariant: "normal",
  fontStretch: "normal",
  textAlign: "start",
  textDecoration: "none",
  textTransform: "none",
  letterSpacing: 0,
  wordSpacing: 0,
  lineHeight: "normal",
  textIndent: 0,
  visibility: "visible",
  whiteSpace: "normal",
  wordBreak: "normal",
  overflowWrap: "normal",
  // 비상속 속성
  backgroundColor: "transparent",
  borderColor: "#000000",
  borderWidth: 0,
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderRadius: 0,
  borderStyle: "none",
  margin: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  padding: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  opacity: 1,
  display: "inline",
  position: "static",
  overflow: "visible",
  textDecorationColor: "currentColor",
  outlineColor: "invert",
  zIndex: "auto",
};

// ============================================
// 색상 속성 목록 (currentColor 대체 대상)
// ============================================

/**
 * currentColor 키워드 대체가 필요한 색상 속성 목록
 *
 * 이 속성들의 값이 'currentColor'이면 현재 요소의 `color` 값으로 대체한다.
 */
const COLOR_PROPERTIES = new Set([
  "borderColor",
  "backgroundColor",
  "textDecorationColor",
  "outlineColor",
  "boxShadow",
]);

// ============================================
// font-variant → OpenType feature type 매핑
// ============================================

export interface FontFeatureTag {
  name: string;
  value: number;
}

const FONT_VARIANT_FEATURE_MAP: Record<string, FontFeatureTag[]> = {
  "small-caps": [{ name: "smcp", value: 1 }],
  "all-small-caps": [
    { name: "smcp", value: 1 },
    { name: "c2sc", value: 1 },
  ],
  "petite-caps": [{ name: "pcap", value: 1 }],
  "all-petite-caps": [
    { name: "pcap", value: 1 },
    { name: "c2pc", value: 1 },
  ],
  unicase: [{ name: "unic", value: 1 }],
  "titling-caps": [{ name: "titl", value: 1 }],
  "oldstyle-nums": [{ name: "onum", value: 1 }],
  "lining-nums": [{ name: "lnum", value: 1 }],
  "tabular-nums": [{ name: "tnum", value: 1 }],
  "proportional-nums": [{ name: "pnum", value: 1 }],
};

export function resolveFontVariantFeatures(
  fontVariant: string,
): FontFeatureTag[] {
  const lower = fontVariant.toLowerCase().trim();
  if (lower === "normal" || lower === "") return [];
  return FONT_VARIANT_FEATURE_MAP[lower] ?? [];
}

/**
 * CSS :root의 font-feature-settings와 동일한 기본 OpenType features.
 * App.css: --default-font-feature-settings: "cv02", "cv03", "cv04", "cv11"
 * CanvasKit은 브라우저처럼 CSS 상속을 하지 않으므로 명시적으로 전달해야 한다.
 */
export const DEFAULT_FONT_FEATURES: FontFeatureTag[] = [
  { name: "cv02", value: 1 },
  { name: "cv03", value: 1 },
  { name: "cv04", value: 1 },
  { name: "cv11", value: 1 },
];

// ============================================
// font-stretch → CanvasKit FontWidth 인덱스 매핑
// ============================================
// ADR-091 Phase 1: FONT_STRETCH_KEYWORD_MAP 은 `@composition/specs` primitives/font 로 이관.

const FONT_STRETCH_PERCENT_BREAKPOINTS: [number, number][] = [
  [50, 1],
  [62.5, 2],
  [75, 3],
  [87.5, 4],
  [100, 5],
  [112.5, 6],
  [125, 7],
  [150, 8],
  [200, 9],
];

export function resolveFontStretchWidth(fontStretch: string): number {
  const lower = fontStretch.toLowerCase().trim();

  const keyword = FONT_STRETCH_KEYWORD_MAP[lower];
  if (keyword !== undefined) return keyword;

  if (lower.endsWith("%")) {
    const pct = parseFloat(lower);
    if (isNaN(pct)) return 5;

    let closest = FONT_STRETCH_PERCENT_BREAKPOINTS[0];
    let minDiff = Math.abs(pct - closest[0]);

    for (const bp of FONT_STRETCH_PERCENT_BREAKPOINTS) {
      const diff = Math.abs(pct - bp[0]);
      if (diff < minDiff) {
        minDiff = diff;
        closest = bp;
      }
    }
    return closest[1];
  }

  return 5;
}

// ============================================
// 타입 정의
// ============================================

/**
 * 계산된 스타일 (상속 가능 속성만 포함)
 *
 * 각 요소의 최종 computed value를 표현한다.
 * 부모로부터 상속된 값과 자체 선언 값이 병합된 결과.
 */
export interface ComputedStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle: string;
  fontVariant: string;
  fontStretch: string;
  lineHeight?: number;
  letterSpacing: number;
  wordSpacing: number;
  textAlign: string;
  textTransform: string;
  textIndent?: number | string;
  visibility: string;
  wordBreak: string;
  overflowWrap: string;
  whiteSpace: string;
}

// ============================================
// 루트 기본값
// ============================================

/**
 * 루트 요소의 기본 computed style (정적 상수 — 하위 호환용)
 *
 * 최상위 요소(body/root)에서 사용되는 초기값.
 * CSS 명세의 initial value 기반.
 *
 * @deprecated getRootComputedStyle() 사용 권장 (ADR-056: themeConfigStore 동적 반영)
 */
export const ROOT_COMPUTED_STYLE: ComputedStyle = {
  color: "#000000",
  fontSize: 16,
  fontFamily: `"Pretendard", "Inter Variable", system-ui, sans-serif`,
  fontWeight: 400,
  fontStyle: "normal",
  fontVariant: "normal",
  fontStretch: "normal",
  lineHeight: 1.5,
  letterSpacing: 0,
  wordSpacing: 0,
  textAlign: "left",
  textTransform: "none",
  visibility: "visible",
  wordBreak: "normal",
  overflowWrap: "normal",
  whiteSpace: "normal",
};

/**
 * 현재 프로젝트의 root computed style (themeConfigStore에서 동적 구성)
 *
 * ADR-056: Base Typography SSOT
 * themeConfigStore.baseTypography를 읽어 fontFamily/fontSize/lineHeight를 동적으로 반영.
 * themeConfigStore 미초기화 시 DEFAULT_BASE_TYPOGRAPHY fallback.
 *
 * 호출 빈도가 높은 레이아웃 루프 내에서도 안전하게 사용 가능.
 * (getState()는 O(1), 내부 캐싱 없음 — 단순 객체 반환)
 */
export function getRootComputedStyle(): ComputedStyle {
  const typo =
    useThemeConfigStore.getState().baseTypography ?? DEFAULT_BASE_TYPOGRAPHY;

  return {
    ...ROOT_COMPUTED_STYLE,
    fontFamily: typo.fontFamily,
    fontSize: typo.fontSize,
    lineHeight: typo.lineHeight,
  };
}

// ============================================
// currentColor 해석
// ============================================

/**
 * 색상 값에서 currentColor 키워드를 해석하여 실제 색상으로 대체한다.
 *
 * CSS 명세: currentColor는 요소의 `color` 속성 계산값과 동일한 값을 갖는다.
 * box-shadow 등 색상이 포함된 복합 속성은 문자열 내 'currentColor' 토큰을 교체한다.
 *
 * @param value - 원본 속성값
 * @param resolvedColor - 현재 요소의 계산된 color 값
 * @returns currentColor가 대체된 값
 */
export function resolveCurrentColor(
  value: unknown,
  resolvedColor: string,
): unknown {
  if (typeof value !== "string") return value;
  if (!value.toLowerCase().includes("currentcolor")) return value;

  // 전체 값이 currentColor인 경우 (대소문자 무관)
  if (value.toLowerCase() === "currentcolor") {
    return resolvedColor;
  }

  // box-shadow 등 복합 속성에서 currentColor 토큰을 교체
  return value.replace(/\bcurrentColor\b/gi, resolvedColor);
}

// ============================================
// cascade 키워드 해석
// ============================================

/**
 * CSS cascade 키워드를 해석하여 실제 적용할 값을 반환한다.
 *
 * - `inherit`: 부모 값 유지 (null 반환 → 호출자가 부모 값 유지)
 * - `initial`: CSS 사양 초기값
 * - `unset`: 상속 속성이면 inherit, 비상속 속성이면 initial
 * - `revert`: 노코드 빌더에서는 initial과 동일하게 처리
 *
 * @param prop - CSS 속성명 (camelCase)
 * @param value - 선언된 값
 * @param parentValue - 부모 computed 값
 * @returns 해석된 값, 또는 'INHERIT' 센티넬(부모 값 그대로 사용 의미)
 */
const INHERIT_SENTINEL = Symbol("inherit");

function resolveCascadeKeyword(
  prop: string,
  value: unknown,
  _parentValue: unknown,
): unknown | typeof INHERIT_SENTINEL {
  if (typeof value !== "string") return value;

  // ADR-923 r14m1 — CSS 키워드는 ASCII 대소문자 무시 + 앞뒤 공백 무시 (`" INHERIT "` 도 inherit).
  //   trim 없이 소문자화만 하면 키워드로 못 읽어 computed 에 raw 가 남는다 (Chrome 부모 pre 상속 60 / 40).
  const lower = value.trim().toLowerCase();

  switch (lower) {
    case "inherit":
      return INHERIT_SENTINEL;

    case "initial":
    case "revert": {
      // CSS 초기값 맵에서 조회, 없으면 값 그대로 유지
      const initial = CSS_INITIAL_VALUES[prop];
      return initial !== undefined ? initial : value;
    }

    case "unset":
      // 상속 속성: inherit처럼 동작
      if (INHERITABLE_PROPERTIES.has(prop)) {
        return INHERIT_SENTINEL;
      }
      // 비상속 속성: initial처럼 동작
      {
        const initial = CSS_INITIAL_VALUES[prop];
        return initial !== undefined ? initial : value;
      }

    default:
      return value;
  }
}

// ============================================
// CSS Logical Properties → Physical Properties 변환
// ============================================

/**
 * camelCase 논리 속성명 → 물리 속성명 직접 매핑 테이블 (LTR horizontal-tb 기준)
 *
 * shorthand(`insetInline` 등)는 포함하지 않으며 별도 처리한다.
 */
const LOGICAL_TO_PHYSICAL: Record<string, string> = {
  // margin
  marginInlineStart: "marginLeft",
  marginInlineEnd: "marginRight",
  marginBlockStart: "marginTop",
  marginBlockEnd: "marginBottom",
  // padding
  paddingInlineStart: "paddingLeft",
  paddingInlineEnd: "paddingRight",
  paddingBlockStart: "paddingTop",
  paddingBlockEnd: "paddingBottom",
  // border-width
  borderInlineStartWidth: "borderLeftWidth",
  borderInlineEndWidth: "borderRightWidth",
  borderBlockStartWidth: "borderTopWidth",
  borderBlockEndWidth: "borderBottomWidth",
  // border-color
  borderInlineStartColor: "borderLeftColor",
  borderInlineEndColor: "borderRightColor",
  borderBlockStartColor: "borderTopColor",
  borderBlockEndColor: "borderBottomColor",
  // border-style
  borderInlineStartStyle: "borderLeftStyle",
  borderInlineEndStyle: "borderRightStyle",
  borderBlockStartStyle: "borderTopStyle",
  borderBlockEndStyle: "borderBottomStyle",
  // inset (단일)
  insetInlineStart: "left",
  insetInlineEnd: "right",
  insetBlockStart: "top",
  insetBlockEnd: "bottom",
  // size
  inlineSize: "width",
  blockSize: "height",
  minInlineSize: "minWidth",
  maxInlineSize: "maxWidth",
  minBlockSize: "minHeight",
  maxBlockSize: "maxHeight",
};

/**
 * camelCase shorthand 논리 속성 → [물리 속성 시작, 물리 속성 끝] 매핑
 *
 * shorthand는 단일 값이면 양쪽 모두, 공백 구분 두 값이면 start/end 각각 적용한다.
 */
const LOGICAL_SHORTHAND_TO_PHYSICAL: Record<string, [string, string]> = {
  insetInline: ["left", "right"],
  insetBlock: ["top", "bottom"],
  marginInline: ["marginLeft", "marginRight"],
  marginBlock: ["marginTop", "marginBottom"],
  paddingInline: ["paddingLeft", "paddingRight"],
  paddingBlock: ["paddingTop", "paddingBottom"],
};

/**
 * CSS Logical Properties를 물리 속성으로 변환한다 (LTR horizontal-tb 기준).
 *
 * - 물리 속성이 이미 있으면 논리 속성을 무시한다 (물리 속성 우선).
 * - shorthand는 start/end 두 물리 속성으로 분리한다.
 * - 원본 객체는 수정하지 않는다.
 *
 * @param style - 요소의 원본 스타일
 * @returns 논리 속성이 물리 속성으로 대체된 새 객체
 */
export function resolveLogicalProperties(
  style: Record<string, unknown>,
): Record<string, unknown> {
  const hasLogical = Object.keys(style).some(
    (k) => k in LOGICAL_TO_PHYSICAL || k in LOGICAL_SHORTHAND_TO_PHYSICAL,
  );
  if (!hasLogical) return style;

  const result: Record<string, unknown> = { ...style };

  // shorthand 처리
  for (const [logicalKey, [physStart, physEnd]] of Object.entries(
    LOGICAL_SHORTHAND_TO_PHYSICAL,
  )) {
    if (!(logicalKey in result)) continue;

    const raw = result[logicalKey];
    delete result[logicalKey];

    if (typeof raw === "string" && raw.trim().includes(" ")) {
      const parts = raw.trim().split(/\s+/);
      const startVal = parts[0];
      const endVal = parts[1];
      if (result[physStart] === undefined) result[physStart] = startVal;
      if (result[physEnd] === undefined) result[physEnd] = endVal;
    } else {
      if (result[physStart] === undefined) result[physStart] = raw;
      if (result[physEnd] === undefined) result[physEnd] = raw;
    }
  }

  // 단일 논리 속성 처리
  for (const [logicalKey, physKey] of Object.entries(LOGICAL_TO_PHYSICAL)) {
    if (!(logicalKey in result)) continue;

    const raw = result[logicalKey];
    delete result[logicalKey];

    if (result[physKey] === undefined) {
      result[physKey] = raw;
    }
  }

  return result;
}

// ============================================
// !important 전처리
// ============================================

/**
 * !important 전처리 결과
 */
export interface ImportantSplit {
  normal: Record<string, unknown>;
  important: Record<string, unknown>;
}

/**
 * 스타일 객체에서 !important 선언을 분리한다.
 *
 * 각 속성값을 검사하여 "!important"로 끝나는 값을 important 객체로 분리하고,
 * 값에서 " !important"를 제거한 실제 값을 저장한다.
 *
 * @param style - 원본 스타일 객체
 * @returns normal (일반 속성), important (!important 속성) 분리 결과
 *
 * @example
 * preprocessImportant({ color: 'red !important', fontSize: '14px' })
 * // { normal: { fontSize: '14px' }, important: { color: 'red' } }
 */
export function preprocessImportant(
  style: Record<string, unknown>,
): ImportantSplit {
  const normal: Record<string, unknown> = {};
  const important: Record<string, unknown> = {};

  for (const prop of Object.keys(style)) {
    const value = style[prop];
    if (typeof value === "string" && value.endsWith("!important")) {
      important[prop] = value
        .slice(0, value.length - "!important".length)
        .trimEnd();
    } else {
      normal[prop] = value;
    }
  }

  return { normal, important };
}

// ============================================
// 스타일 해석
// ============================================

/**
 * 요소의 스타일을 부모 computed style 기반으로 해석
 *
 * - style이 없으면 부모 값을 전부 상속
 * - `inherit` 키워드는 부모 값 유지
 * - `initial` 키워드는 CSS 사양 초기값으로 되돌림
 * - `unset` 키워드는 상속 속성이면 inherit, 비상속이면 initial
 * - `revert` 키워드는 노코드 빌더에서 initial과 동일하게 처리
 * - 명시적 값은 부모 값을 덮어씀
 * - fontSize의 em/rem 단위는 부모 fontSize 기준으로 해석
 * - 색상 속성의 `currentColor`는 현재 요소의 color 값으로 대체
 * - 논리 속성은 LTR horizontal-tb 기준 물리 속성으로 변환
 * - `!important` 속성은 normal 속성 적용 후 덮어씀
 *
 * 처리 순서: inline !important > inline normal > inherited
 *
 * @param style - 요소의 선언된 스타일 (props.style)
 * @param parentComputed - 부모의 computed style
 * @returns 요소의 computed style
 */
export function resolveStyle(
  style: Record<string, unknown> | undefined,
  parentComputed: ComputedStyle,
): ComputedStyle {
  // 스타일 미선언 시 부모 값 전체 상속
  if (!style) return { ...parentComputed };

  // !important 분리
  const { normal: normalStyle, important: importantStyle } =
    preprocessImportant(style);

  // 논리 속성을 물리 속성으로 전환 (물리 속성 우선)
  const afterLogicalNormal = resolveLogicalProperties(normalStyle);
  const afterLogicalImportant = resolveLogicalProperties(importantStyle);

  function expandFontShorthand(
    src: Record<string, unknown>,
  ): Record<string, unknown> {
    if (src["font"] === undefined) return src;
    const parsed = parseFontShorthand(src["font"]);
    if (!parsed) return src;
    const expanded: Record<string, unknown> = { ...src };
    delete expanded["font"];
    if (parsed.fontStyle !== undefined && expanded["fontStyle"] === undefined) {
      expanded["fontStyle"] = parsed.fontStyle;
    }
    if (
      parsed.fontWeight !== undefined &&
      expanded["fontWeight"] === undefined
    ) {
      expanded["fontWeight"] = parsed.fontWeight;
    }
    if (parsed.fontSize !== undefined && expanded["fontSize"] === undefined) {
      expanded["fontSize"] = parsed.fontSize;
    }
    if (
      parsed.lineHeight !== undefined &&
      expanded["lineHeight"] === undefined
    ) {
      expanded["lineHeight"] = parsed.lineHeight;
    }
    if (
      parsed.fontFamily !== undefined &&
      expanded["fontFamily"] === undefined
    ) {
      expanded["fontFamily"] = parsed.fontFamily;
    }
    return expanded;
  }

  const effectiveNormal = expandFontShorthand(afterLogicalNormal);
  const effectiveImportant = expandFontShorthand(afterLogicalImportant);

  // 부모 computed 기반으로 시작 (상속 가능 속성 기본값)
  const computed = { ...parentComputed };

  // 1단계: normal 속성 적용
  for (const prop of INHERITABLE_PROPERTIES) {
    const rawValue = effectiveNormal[prop];
    if (rawValue === undefined || rawValue === null || rawValue === "")
      continue;

    const resolved = resolveCascadeKeyword(
      prop,
      rawValue,
      computed[prop as keyof ComputedStyle],
    );

    if (resolved === INHERIT_SENTINEL) continue;

    (computed as Record<string, unknown>)[prop] = resolved;
  }

  // 2단계: !important 속성 적용 (normal 값을 덮어씀)
  for (const prop of INHERITABLE_PROPERTIES) {
    const rawValue = effectiveImportant[prop];
    if (rawValue === undefined || rawValue === null || rawValue === "")
      continue;

    const resolved = resolveCascadeKeyword(
      prop,
      rawValue,
      computed[prop as keyof ComputedStyle],
    );

    if (resolved === INHERIT_SENTINEL) continue;

    (computed as Record<string, unknown>)[prop] = resolved;
  }

  // fontSize 상대 단위 해석 (em, rem, px)
  if (typeof computed.fontSize === "string") {
    const fs = String(computed.fontSize);
    if (fs.endsWith("em") && !fs.endsWith("rem")) {
      // em: 부모 fontSize 기준
      computed.fontSize = parseFloat(fs) * parentComputed.fontSize;
    } else if (fs.endsWith("rem")) {
      // rem: 루트 fontSize 기준 (16px 고정)
      computed.fontSize = parseFloat(fs) * 16;
    } else if (fs.endsWith("px")) {
      computed.fontSize = parseFloat(fs);
    } else {
      computed.fontSize = parseFloat(fs) || parentComputed.fontSize;
    }
  }

  return computed;
}

// ============================================
// 스타일 전처리 (비상속 속성의 cascade 키워드 + currentColor 해석)
// ============================================

/**
 * 요소의 전체 스타일(비상속 속성 포함)에서 cascade 키워드와 currentColor를 전처리한다.
 *
 * `resolveStyle()`이 상속 속성만 처리하는 것과 달리,
 * 이 함수는 borderColor, backgroundColor 등 비상속 색상 속성의
 * `currentColor`, `initial`, `unset`, `revert` 키워드를 해석하여
 * 렌더러가 바로 사용할 수 있는 구체적인 값으로 변환한다.
 *
 * @param style - 요소의 원본 스타일
 * @param computedColor - 현재 요소의 계산된 color 값 (resolveStyle() 결과)
 * @returns 전처리된 스타일 (원본을 수정하지 않고 새 객체 반환)
 */
export function preprocessStyle(
  style: Record<string, unknown>,
  computedColor: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...style };

  for (const prop of Object.keys(result)) {
    const rawValue = result[prop];
    if (rawValue === undefined || rawValue === null || rawValue === "")
      continue;

    // cascade 키워드 해석 (부모 없는 flat 처리: 비상속 속성은 initial로 fallback)
    if (typeof rawValue === "string") {
      const lower = rawValue.trim().toLowerCase(); // r14m1 — 키워드는 trim + 소문자

      if (lower === "initial" || lower === "revert") {
        const initial = CSS_INITIAL_VALUES[prop];
        if (initial !== undefined) {
          result[prop] = initial;
          continue;
        }
      } else if (lower === "unset") {
        if (INHERITABLE_PROPERTIES.has(prop)) {
          // 상속 속성의 unset은 resolveStyle()에서 처리됨, 여기서는 건너뜀
          continue;
        }
        const initial = CSS_INITIAL_VALUES[prop];
        if (initial !== undefined) {
          result[prop] = initial;
          continue;
        }
      }
    }

    // currentColor 키워드 해석
    if (COLOR_PROPERTIES.has(prop)) {
      result[prop] = resolveCurrentColor(rawValue, computedColor);
    }
  }

  return result;
}
