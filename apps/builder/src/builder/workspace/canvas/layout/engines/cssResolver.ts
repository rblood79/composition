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
const INHERITABLE_PROPERTIES = new Set([
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
const CSS_INITIAL_VALUES: Record<string, string | number> = {
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

interface FontFeatureTag {
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
const ROOT_COMPUTED_STYLE: ComputedStyle = {
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
