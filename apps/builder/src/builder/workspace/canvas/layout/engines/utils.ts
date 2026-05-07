/**
 * Layout Engine 공유 유틸리티
 *
 * 입력 규약 (P0):
 * - width, height: px, %, vh, vw, em, rem, calc(), number, auto 지원
 * - margin, padding: px, number, % 지원 (% = 포함 블록 width 기준)
 * - border-width: px, number, border shorthand("1px solid red") 지원
 * - intrinsic sizing: fit-content, min-content, max-content 지원 (모든 요소)
 *
 * @since 2026-01-28 Phase 2 - 하이브리드 레이아웃 엔진
 * @updated 2026-01-28 Phase 6 - P2 기능 (vertical-align, line-height)
 */

import type { Margin, BoxModel, VerticalAlign } from "./types";
import type { Element } from "../../../../../types/core/store.types";
import {
  fontFamily as specFontFamily,
  BreadcrumbsSpec,
  InputSpec,
  ButtonSpec,
  BadgeSpec,
  TagSpec,
  ToggleButtonSpec,
  TabSpec,
  CardSpec,
  resolveToken,
  breadcrumbSeparatorAfterPaddingXPx,
  normalizeBreadcrumbRspSizeKey,
  PROGRESSBAR_DIMENSIONS,
  PROGRESSCIRCLE_DIMENSIONS,
  METER_DIMENSIONS,
  STATUSLIGHT_DIMENSIONS,
  resolveListBoxSpacingMetric,
  isListBoxSectionEntry,
  resolveGridListSpacingMetric,
  isGridListSectionEntry,
  TAG_CHIP_SIZES,
  parsePxValue,
} from "@composition/specs";
import type { SizeSpec } from "@composition/specs";
import {
  TabsSpec,
  TabPanelsSpec,
  // ADR-091 Phase 3: Class A spec.sizes 직접 참조 — Record 해체 대응.
  IconSpec,
  CalendarHeaderSpec,
  DateInputSpec,
  ComboBoxSpec,
  SelectTriggerSpec,
  // ADR-091 Addendum 2: DateField intrinsic height SSOT.
  DateFieldSpec,
  // ADR-096 Phase 4: HTML primitive defaults 직접 참조 — DEFAULT_ELEMENT_WIDTHS/HEIGHTS 해체.
  HTML_PRIMITIVE_DEFAULT_WIDTHS,
  HTML_PRIMITIVE_DEFAULT_HEIGHTS,
} from "@composition/specs";
import { LOWERCASE_TAG_SPEC_MAP } from "./tagSpecLookup";
import { extractSpecTextStyle } from "../../utils/specTextStyle";
import {
  measureWrappedTextHeight,
  measureFontMetrics,
  getTextMeasurer,
} from "../../utils/textMeasure";
import type { FontMetrics } from "../../utils/textMeasure";
import {
  resolveCSSSizeValue,
  FIT_CONTENT as CSS_FIT_CONTENT,
  MIN_CONTENT as CSS_MIN_CONTENT,
  MAX_CONTENT as CSS_MAX_CONTENT,
  parseBorderShorthand,
} from "./cssValueParser";
import type { CSSValueContext, CSSVariableScope } from "./cssValueParser";
import { resolveStyle, getRootComputedStyle } from "./cssResolver";
import type { ComputedStyle } from "./cssResolver";
import type { LayoutContext } from "./LayoutEngine";
import { applyTextTransform } from "../../sprites/styleConverter";
import { getImageNaturalDimensions } from "../../skia/imageCache";
import {
  parseAspectRatio,
  shouldSetAutoHeightForAspectRatio,
} from "../../../../utils/aspectRatio";

// ─── Phantom Indicator 설정 (단일 소스) ─────────────────────────────────
// Switch/Checkbox/Radio: Preview DOM에는 [indicator + label] 구조이지만
// WebGL element tree에는 label 자식만 존재.
// 값의 원천: packages/specs/src/components/{Switch,Checkbox,Radio}.spec.ts

interface PhantomIndicatorConfig {
  widths: { sm: number; md: number; lg: number };
  heights: { sm: number; md: number; lg: number };
  gaps: { sm: number; md: number; lg: number };
  rowHeights: { sm: number; md: number; lg: number };
}

export const PHANTOM_INDICATOR_CONFIGS: Record<string, PhantomIndicatorConfig> =
  {
    switch: {
      widths: { sm: 32, md: 36, lg: 44 },
      heights: { sm: 18, md: 20, lg: 24 },
      gaps: { sm: 8, md: 10, lg: 12 },
      rowHeights: { sm: 18, md: 20, lg: 24 },
    },
    checkbox: {
      widths: { sm: 16, md: 20, lg: 24 },
      heights: { sm: 16, md: 20, lg: 24 },
      gaps: { sm: 6, md: 8, lg: 10 },
      rowHeights: { sm: 20, md: 24, lg: 28 }, // spec.sizes.height (전체 행 높이)
    },
    radio: {
      widths: { sm: 16, md: 20, lg: 24 },
      heights: { sm: 16, md: 20, lg: 24 },
      gaps: { sm: 6, md: 8, lg: 10 },
      rowHeights: { sm: 20, md: 24, lg: 28 }, // spec.sizes.height (전체 행 높이)
    },
  };

/** Phantom indicator의 width + gap (Row용). 해당 태그가 아니면 null */
export function getPhantomIndicatorSpace(
  type: string,
  size?: string,
): { width: number; height: number; gap: number } | null {
  const config = PHANTOM_INDICATOR_CONFIGS[type];
  if (!config) return null;
  const s = (size ?? "md") as "sm" | "md" | "lg";
  const w = config.widths[s] ?? config.widths.md;
  const h = config.heights[s] ?? config.heights.md;
  const gap = config.gaps[s] ?? config.gaps.md;
  return { width: w + gap, height: h, gap };
}

/** Phantom indicator의 width + gap (number, 폴백 0) */
export function getPhantomIndicatorWidth(type: string, size?: string): number {
  const space = getPhantomIndicatorSpace(type, size);
  return space?.width ?? 0;
}

/**
 * 중복 경고 방지용 Set
 *
 * 주의: 모듈 전역이므로 장시간 세션에서 메모리 누적 가능.
 * 100개 초과 시 clear하여 메모리 제한.
 */
const warnedTokens = new Set<string>();

/**
 * 동일 메시지는 1회만 경고
 *
 * 트레이드오프: 100개 초과 시 전체 clear하므로 동일 경고가 주기적으로 재출력될 수 있음.
 */
function warnOnce(message: string): void {
  if (warnedTokens.size > 100) {
    warnedTokens.clear();
  }
  if (!warnedTokens.has(message)) {
    warnedTokens.add(message);
    console.warn(message);
  }
}

/** 테스트용 초기화 */
export function resetWarnedTokens(): void {
  warnedTokens.clear();
}

/**
 * CSS intrinsic sizing sentinel 값
 *
 * Yoga/WASM가 fit-content를 네이티브 지원하지 않으므로,
 * parseSize()에서 sentinel 값으로 변환하여 BlockEngine/WASM에 전달한다.
 * AUTO(-1)와 동일한 패턴으로 Float32Array 직렬화 시 그대로 전달 가능.
 *
 * 통합 파서(cssValueParser.ts)에서 정의된 값을 re-export한다.
 */
export const FIT_CONTENT = CSS_FIT_CONTENT;
export const MIN_CONTENT = CSS_MIN_CONTENT;
export const MAX_CONTENT = CSS_MAX_CONTENT;

/** 허용되는 단위 패턴 */
const PX_NUMBER_PATTERN = /^-?\d+(\.\d+)?(px)?$/;

/**
 * 숫자 값 파싱 (px, number만 허용)
 *
 * @returns 파싱된 숫자 또는 undefined (미지원 단위)
 */
function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // px 또는 숫자만 허용
    if (!PX_NUMBER_PATTERN.test(value.trim())) {
      return undefined; // rem, em, %, calc 등 미지원
    }
    return parseFloat(value);
  }
  return undefined;
}

// store 는 gap shorthand 를 rowGap/columnGap longhand 로 분배 저장 —
// longhand 우선으로 읽지 않으면 편집이 무시된다.
function readGapValue(
  style: Record<string, unknown> | undefined,
): number | undefined {
  return parseNumericValue(style?.rowGap ?? style?.columnGap ?? style?.gap);
}

/**
 * 크기 값 파싱 (width/height용: px, %, vh, vw, em, rem, calc, number, auto 허용)
 *
 * 내부적으로 resolveCSSSizeValue()에 위임하여 일관된 단위 해석을 제공한다.
 *
 * W3-7: variableScope 파라미터 추가로 var() 참조 해석 지원.
 * 디자인 토큰(color/spacing/typography)이 var()로 참조될 때 정상 해석된다.
 *
 * @param value - 파싱할 값
 * @param available - % 계산 시 기준값 (부모 content-box)
 * @param viewportWidth - vw 계산 시 기준값
 * @param viewportHeight - vh 계산 시 기준값
 * @param variableScope - CSS 변수 스코프 (var() 해석용, W3-7)
 * @returns 파싱된 숫자 또는 undefined (auto 또는 미지원 단위)
 */
export function parseSize(
  value: unknown,
  available: number,
  viewportWidth?: number,
  viewportHeight?: number,
  variableScope?: CSSVariableScope,
): number | undefined {
  if (value === undefined || value === "auto") return undefined;

  // C2: % 값인데 available이 음수(sentinel -1)이면 auto로 처리
  // CSS 스펙: auto height 부모의 블록 컨텍스트에서 자식의 percentage height는 auto
  if (typeof value === "string" && value.endsWith("%") && available < 0) {
    return undefined;
  }

  const ctx: CSSValueContext = {
    containerSize: available,
    viewportWidth,
    viewportHeight,
    variableScope,
  };

  return resolveCSSSizeValue(value, ctx);
}

/**
 * C3: % 값을 containerWidth 기준으로 해석
 *
 * 개별 margin/padding 속성의 % 값 해석용
 * CSS 스펙: margin/padding의 % 값은 포함 블록의 inline-size(width) 기준
 */
function resolvePercentValue(
  value: unknown,
  containerWidth?: number,
): number | undefined {
  if (typeof value !== "string" || !value.endsWith("%")) return undefined;
  if (containerWidth === undefined || containerWidth <= 0) return undefined;
  const pct = parseFloat(value);
  if (isNaN(pct)) return undefined;
  return (pct / 100) * containerWidth;
}

/**
 * shorthand 개별 값 파싱 (px, number만 허용)
 *
 * @returns 파싱된 숫자 또는 undefined
 */
function parseShorthandValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!PX_NUMBER_PATTERN.test(trimmed)) {
    return undefined; // 미지원 단위
  }
  return parseFloat(trimmed);
}

/**
 * shorthand 속성 파싱 (margin, padding, borderWidth)
 * "10px" → 모두 10
 * "10px 20px" → 상하 10, 좌우 20
 * "10px 20px 30px" → 상 10, 좌우 20, 하 30
 * "10px 20px 30px 40px" → 상 10, 우 20, 하 30, 좌 40
 *
 * C3: % 단위 지원 - containerWidth가 제공되면 % 값을 해석
 * CSS 스펙: padding/margin의 % 값은 포함 블록의 width 기준 (4면 모두)
 *
 * 미지원 단위가 포함되면 해당 값은 0으로 처리
 */
function parseShorthand(value: unknown, containerWidth?: number): Margin {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof value !== "string") return zero;

  const tokens = value.split(/\s+/);
  const parts = tokens.map((token) => {
    // px/number 먼저 시도
    const parsed = parseShorthandValue(token);
    if (parsed !== undefined) return parsed;
    // C3: % 해석 시도 (containerWidth 기준)
    if (
      token.endsWith("%") &&
      containerWidth !== undefined &&
      containerWidth > 0
    ) {
      const pct = parseFloat(token);
      if (!isNaN(pct)) return (pct / 100) * containerWidth;
    }
    // 개발 모드에서만 경고 (디버깅 용이성, 중복 방지)
    if (import.meta.env.DEV) {
      warnOnce(`[parseShorthand] Unsupported token "${token}", fallback to 0`);
    }
    return 0;
  });

  switch (parts.length) {
    case 1:
      return {
        top: parts[0],
        right: parts[0],
        bottom: parts[0],
        left: parts[0],
      };
    case 2:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[0],
        left: parts[1],
      };
    case 3:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[1],
      };
    case 4:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[3],
      };
    default:
      return zero;
  }
}

/**
 * 스타일에서 마진 파싱
 *
 * 개별 속성(marginTop 등)이 shorthand(margin)보다 우선합니다.
 * shorthand는 개별 속성이 없는 방향에만 적용됩니다.
 *
 * C3: containerWidth가 제공되면 % 값을 해석
 * CSS 스펙: margin의 % 값은 포함 블록의 width 기준 (4면 모두)
 */
export function parseMargin(
  style: Record<string, unknown> | undefined,
  containerWidth?: number,
): Margin {
  if (!style) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // shorthand를 기본값으로 파싱
  const base =
    style.margin !== undefined
      ? parseShorthand(style.margin, containerWidth)
      : { top: 0, right: 0, bottom: 0, left: 0 };

  // 개별 속성으로 override (% 해석 포함)
  return {
    top:
      parseNumericValue(style.marginTop) ??
      resolvePercentValue(style.marginTop, containerWidth) ??
      base.top,
    right:
      parseNumericValue(style.marginRight) ??
      resolvePercentValue(style.marginRight, containerWidth) ??
      base.right,
    bottom:
      parseNumericValue(style.marginBottom) ??
      resolvePercentValue(style.marginBottom, containerWidth) ??
      base.bottom,
    left:
      parseNumericValue(style.marginLeft) ??
      resolvePercentValue(style.marginLeft, containerWidth) ??
      base.left,
  };
}

/**
 * 스타일에서 패딩 파싱
 *
 * C3: containerWidth가 제공되면 % 값을 해석
 * CSS 스펙: padding의 % 값은 포함 블록의 width 기준 (4면 모두)
 */
export function parsePadding(
  style: Record<string, unknown> | undefined,
  containerWidth?: number,
): Margin {
  if (!style) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const base =
    style.padding !== undefined
      ? parseShorthand(style.padding, containerWidth)
      : { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    top:
      parseNumericValue(style.paddingTop) ??
      resolvePercentValue(style.paddingTop, containerWidth) ??
      base.top,
    right:
      parseNumericValue(style.paddingRight) ??
      resolvePercentValue(style.paddingRight, containerWidth) ??
      base.right,
    bottom:
      parseNumericValue(style.paddingBottom) ??
      resolvePercentValue(style.paddingBottom, containerWidth) ??
      base.bottom,
    left:
      parseNumericValue(style.paddingLeft) ??
      resolvePercentValue(style.paddingLeft, containerWidth) ??
      base.left,
  };
}

/**
 * 스타일에서 보더 너비 파싱
 *
 * H4: CSS border shorthand `border: "1px solid red"` 지원 추가
 * 빌더의 개별 속성(borderTopWidth 등) 우선, borderWidth shorthand 차선,
 * border shorthand("1px solid red")가 최종 폴백으로 적용됩니다.
 */
export function parseBorder(
  style: Record<string, unknown> | undefined,
): Margin {
  if (!style) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // H4: border shorthand 먼저 파싱 ("1px solid red" → width: 1)
  let shorthandWidth = 0;
  if (style.border !== undefined) {
    const parsed = parseBorderShorthand(style.border);
    if (parsed) shorthandWidth = parsed.width;
  }

  // borderWidth shorthand (숫자만)가 border shorthand보다 우선
  const base =
    style.borderWidth !== undefined
      ? parseShorthand(style.borderWidth)
      : {
          top: shorthandWidth,
          right: shorthandWidth,
          bottom: shorthandWidth,
          left: shorthandWidth,
        };

  // 개별 속성으로 override
  return {
    top: parseNumericValue(style.borderTopWidth) ?? base.top,
    right: parseNumericValue(style.borderRightWidth) ?? base.right,
    bottom: parseNumericValue(style.borderBottomWidth) ?? base.bottom,
    left: parseNumericValue(style.borderLeftWidth) ?? base.left,
  };
}

// ADR-096 Phase 4: DEFAULT_ELEMENT_WIDTHS Record 해체.
//   - Spec 있는 태그 (input/select/textarea/image) → `ComponentSpec.defaultWidth`
//   - HTML primitive (img/video/canvas/iframe) → `HTML_PRIMITIVE_DEFAULT_WIDTHS`
//   lookup 체인: spec.defaultWidth → HTML_PRIMITIVE_DEFAULT_WIDTHS → DEFAULT_WIDTH

/** 기본 너비 (알 수 없는 태그, 텍스트 없을 때) */
const DEFAULT_WIDTH = 80;

/**
 * 버튼 size별 설정
 *
 * @composition/specs ButtonSpec.sizes와 1:1 동기화
 * paddingLeft/paddingRight: ButtonSpec.sizes[size].paddingX (좌우 동일)
 * paddingY: ButtonSpec.sizes[size].paddingY (상하 동일)
 * fontSize: typography 토큰 resolved 값
 *
 * 🚀 Phase 12 Fix: height 제거, paddingY 추가
 * 기존 height는 ButtonSpec.height (예: sm=32)였으나 PixiButton 실제 렌더링은
 * max(paddingY*2 + textHeight, MIN_HEIGHT) 공식으로 계산되어 불일치 발생.
 * 동일 공식을 사용하여 CSS/WebGL 정합성 보장.
 */
// ─── ADR-036: SIZE_CONFIG → Spec.sizes 파생 ────────────────────────────────
// SizeSpec의 TokenRef fontSize를 resolved number로 변환하는 헬퍼
interface ResolvedSizeConfig {
  height?: number;
  paddingLeft: number;
  paddingRight: number;
  paddingY: number;
  fontSize: number;
  lineHeight: number;
  borderWidth: number;
  iconSize: number;
  iconGap: number;
}

function deriveSizeConfig(
  sizes: Record<string, SizeSpec>,
): Record<string, ResolvedSizeConfig> {
  const result: Record<string, ResolvedSizeConfig> = {};
  for (const [key, s] of Object.entries(sizes)) {
    const rawFs = s.fontSize;
    const fontSize =
      typeof rawFs === "number"
        ? rawFs
        : typeof rawFs === "string" && rawFs.startsWith("{")
          ? (resolveToken(rawFs) ?? 14)
          : 14;
    result[key] = {
      paddingLeft: s.paddingLeft ?? s.paddingX,
      paddingRight: s.paddingRight ?? s.paddingX,
      paddingY: s.paddingY,
      fontSize: fontSize as number,
      lineHeight:
        typeof s.lineHeight === "number"
          ? s.lineHeight
          : typeof s.lineHeight === "string" && s.lineHeight.startsWith("{")
            ? Number(resolveToken(s.lineHeight)) || 20
            : 20,
      borderWidth: s.borderWidth ?? 1,
      iconSize: s.iconSize ?? 16,
      iconGap: s.iconGap ?? s.gap ?? 8,
    };
  }
  return result;
}

// ADR-036: Spec이 단일 소스 — SIZE_CONFIG 수동 동기화 불필요
const BUTTON_SIZE_CONFIG = deriveSizeConfig(ButtonSpec.sizes);

/** CSS에 min-height 없음 → padding + line-height로 자연 결정 */
const MIN_BUTTON_HEIGHT = 0;

// ADR-036: BadgeSpec.sizes에서 파생
const BADGE_SIZE_CONFIG = deriveSizeConfig(BadgeSpec.sizes);

// ADR-036: TagSpec.sizes에서 파생 (Badge와 paddingX가 다름)
const TAG_SIZE_CONFIG = deriveSizeConfig(TagSpec.sizes);

// ADR-036: ToggleButtonSpec.sizes에서 파생
const TOGGLEBUTTON_SIZE_CONFIG = deriveSizeConfig(ToggleButtonSpec.sizes);

// ADR-036: TabSpec.sizes에서 파생
const TAB_SIZE_CONFIG = deriveSizeConfig(TabSpec.sizes);

// ADR-036: CardSpec.sizes에서 파생
const CARD_SIZE_CONFIG: Record<string, { padding: number }> =
  Object.fromEntries(
    Object.entries(CardSpec.sizes).map(([key, s]) => [
      key,
      { padding: s.paddingX },
    ]),
  );

/** inline-level UI 컴포넌트 태그 → size config 매핑 */
const INLINE_UI_SIZE_CONFIGS: Record<
  string,
  Record<
    string,
    {
      paddingLeft: number;
      paddingRight: number;
      paddingY: number;
      fontSize: number;
      lineHeight?: number;
      borderWidth: number;
      minWidth?: number;
      height?: number;
    }
  >
> = {
  badge: BADGE_SIZE_CONFIG,
  type: TAG_SIZE_CONFIG,
  chip: BADGE_SIZE_CONFIG,
  togglebutton: TOGGLEBUTTON_SIZE_CONFIG,
  tab: TAB_SIZE_CONFIG,
  submitbutton: BUTTON_SIZE_CONFIG,
  fancybutton: BUTTON_SIZE_CONFIG,
};

function getTagRemoveAdjustedPaddingRight(
  type: string,
  sizeConfig: {
    paddingRight: number;
    paddingY: number;
  },
  allowsRemoving: boolean,
): number {
  if (type === "tag" && allowsRemoving) {
    // CSS TagGroup.css: allowsRemoving 상태에서는 우측 패딩이 size별 paddingY 값으로 축소된다.
    return sizeConfig.paddingY;
  }

  return sizeConfig.paddingRight;
}

// ── Layout pass 컨텍스트: TagGroup allowsRemoving 상태 ──
// fullTreeLayout DFS 시작 시 설정, calculateContentWidth/parseBoxModel에서 조회
// delegation 경로(DFS/flex engine/recursive)에 무관하게 일관된 값 제공
let _tagGroupAllowsRemovingMap = new Map<string, boolean>();

/** fullTreeLayout DFS 시작 전 호출 — TagGroup의 allowsRemoving 상태 수집
 *  childrenMap 기반 DFS로 TagGroup 하위 전체 서브트리 ID를 등록하여
 *  중간 래퍼 유무와 무관하게 remove 공간 계산이 일관되게 동작 */
export function setTagGroupAllowsRemovingContext(
  elementsMap: Map<string, Element>,
  childrenMap: Map<string | null, string[]>,
): void {
  _tagGroupAllowsRemovingMap = new Map();
  for (const el of elementsMap.values()) {
    if (el.type === "TagGroup") {
      const ar = Boolean(
        (el.props as Record<string, unknown> | undefined)?.allowsRemoving,
      );
      if (ar) {
        // DFS(stack)로 TagGroup 하위 전체 서브트리 등록
        // 중간 래퍼가 끼어도 Tag의 parent_id 조회가 항상 맵에 히트
        const stack: string[] = [el.id];
        while (stack.length > 0) {
          const id = stack.pop()!;
          _tagGroupAllowsRemovingMap.set(id, true);
          const children = childrenMap.get(id);
          if (children) {
            for (const childId of children) {
              stack.push(childId);
            }
          }
        }
      }
    }
  }
}

/** Tag element의 조상 TagGroup이 allowsRemoving인지 조회
 *  DFS 서브트리 등록으로 parent_id 단일 조회만으로 충분 */
export function isTagAllowsRemoving(
  element: Element,
  _elementsMap?: Map<string, Element>,
): boolean {
  // props에 직접 있으면 (delegation된 경우)
  if ((element.props as Record<string, unknown> | undefined)?.allowsRemoving)
    return true;
  // DFS 서브트리 맵에서 parent_id 조회 — 중간 래퍼 포함 전체 등록됨
  return element.parent_id
    ? _tagGroupAllowsRemovingMap.has(element.parent_id)
    : false;
}

/**
 * 버튼 계열 요소의 size config 조회 (단일 소스)
 *
 * 엔진 모듈에서 버튼 크기 계산 시
 * BUTTON_SIZE_CONFIG / TOGGLEBUTTON_SIZE_CONFIG의 단일 진입점으로 사용.
 *
 * @returns 해당 type/size의 config. 버튼 계열이 아니면 null.
 */
export function getButtonSizeConfig(
  type: string,
  sizePropValue?: string,
): {
  paddingY: number;
  paddingX: number;
  fontSize: number;
  borderWidth: number;
} | null {
  const t = type.toLowerCase();

  // button / submitbutton / fancybutton → BUTTON_SIZE_CONFIG
  if (t === "button" || t === "submitbutton" || t === "fancybutton") {
    const size = sizePropValue ?? "md";
    const c = BUTTON_SIZE_CONFIG[size] ?? BUTTON_SIZE_CONFIG["md"];
    return {
      paddingY: c.paddingY,
      paddingX: c.paddingLeft,
      fontSize: c.fontSize,
      borderWidth: c.borderWidth,
    };
  }

  // togglebutton → TOGGLEBUTTON_SIZE_CONFIG
  if (t === "togglebutton") {
    const size = sizePropValue ?? "md";
    const c = TOGGLEBUTTON_SIZE_CONFIG[size] ?? TOGGLEBUTTON_SIZE_CONFIG["md"];
    return {
      paddingY: c.paddingY,
      paddingX: c.paddingLeft,
      fontSize: c.fontSize,
      borderWidth: c.borderWidth,
    };
  }

  return null;
}

/**
 * 활성 TextMeasurer를 사용하여 텍스트 너비 측정
 *
 * Phase 4-1: getTextMeasurer() 전략 패턴 적용
 * - CanvasKit 초기화 후: CanvasKit Paragraph API (HarfBuzz 정확도)
 * - CanvasKit 미로드 시: Canvas 2D API (기존 동작)
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리 (기본 Pretendard)
 * @param fontWeight - 폰트 두께 (기본 400)
 * @param extra - 렌더러 ParagraphStyle 정합성을 위한 추가 스타일 (기존 호출자 하위 호환)
 */
export function measureTextWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
  extra?: {
    letterSpacing?: number;
    wordSpacing?: number;
    fontStyle?: number | string;
    fontStretch?: string;
    fontVariant?: string;
    lineHeight?: number;
  },
): number {
  if (!text) return 0;

  return getTextMeasurer().measureWidth(text, {
    fontSize,
    fontFamily,
    fontWeight,
    ...extra,
  });
}

/**
 * 텍스트 콘텐츠 추출
 *
 * 다양한 prop에서 텍스트 문자열 추출
 * 우선순위: children > text > label > title > placeholder > value
 */
function extractTextContent(
  props: Record<string, unknown> | undefined,
): string {
  if (!props) return "";

  // 우선순위에 따라 텍스트 소스 확인
  const textSources = [
    props.children,
    props.text,
    props.label,
    props.title,
    props.placeholder,
    props.value,
  ];

  for (const source of textSources) {
    const text = extractFromValue(source);
    if (text) return text;
  }

  return "";
}

/**
 * 단일 값에서 텍스트 추출
 */
function extractFromValue(value: unknown): string {
  if (value === undefined || value === null) return "";

  // 문자열
  if (typeof value === "string") return value;

  // 숫자
  if (typeof value === "number") return String(value);

  // 배열 (복수 children)
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number") return String(item);
        return "";
      })
      .join("");
  }

  return "";
}

/** BUTTON_SIZE_CONFIG 경로를 사용하는 태그 (calculateContentWidth/Height 공통) */
const BUTTON_LIKE_TAGS = new Set(["button", "input", "select", "a", "menu"]);

/** BUTTON_SIZE_CONFIG 경로 (parseBoxModel용, select/a 제외) */
const BUTTON_LIKE_BOX_TAGS = new Set(["button", "input", "menu"]);

/**
 * Calendar 계열 type (lowercase). RangeCalendarSpec은 CalendarSpec을 spread하므로
 * layout 계산(`calculateContentHeight` 3.5 분기, `parseBoxModel` border-box)에서
 * 두 태그를 대칭 처리해야 자식 0개·유무에 관계없이 height가 일치한다.
 * Pascal-case 버전은 `SHELL_ONLY_CONTAINER_TAGS`(buildSpecNodeData.ts).
 */
const CALENDAR_LIKE_TAGS = new Set(["calendar", "rangecalendar"]);

/** 컴포넌트별 기본 size prop 값 */
const DEFAULT_SIZE_BY_TAG: Record<string, string> = {
  // Badge 계열: 'md' 기본값 (CSS TagGroup 기본 size=md와 동기화)
  badge: "md",
  type: "md",
  chip: "md",
  // Button 계열: 'md' 기본값
  button: "md",
  submitbutton: "md",
  fancybutton: "md",
  input: "md",
  select: "sm",
  a: "md",
  togglebutton: "md",
  menu: "md",
};

/**
 * 요소의 콘텐츠 너비 계산
 *
 * CSS width: auto 동작 모방:
 * 1. 텍스트 콘텐츠가 있으면 텍스트 기반 너비 추정
 * 2. 텍스트가 없으면 태그별 기본 너비 사용
 *
 * @returns 콘텐츠 기반 너비
 */
export function calculateContentWidth(
  element: Element,
  childElements?: Element[],
  getChildElements?: (id: string) => Element[],
  computedStyle?: ComputedStyle,
): number {
  const style = element.props?.style as Record<string, unknown> | undefined;
  const type = (element.type ?? "").toLowerCase();

  // 1. 명시적 width가 있으면 사용
  const explicitWidth = parseNumericValue(style?.width);
  if (explicitWidth !== undefined) return explicitWidth;

  // 1.05. Icon: iconSize 기반 intrinsic width (fit-content)
  // ADR-091 Phase 3: ICON_SIZE_MAP Record → IconSpec.sizes.iconSize 직접 참조.
  if (type === "icon") {
    const props = element.props as Record<string, unknown> | undefined;
    // fontSize 오버라이드 시 iconSize = fontSize
    const overrideFs = parseNumericValue(style?.fontSize);
    if (overrideFs != null) return overrideFs;
    const sizeName = String(props?.size ?? "md");
    return IconSpec.sizes[sizeName]?.iconSize ?? 18;
  }

  // 1.1. StatusLight: dot + gap + text width
  if (type === "statuslight") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = String(props?.size ?? "md");
    const dims = STATUSLIGHT_DIMENSIONS[sizeName] ?? STATUSLIGHT_DIMENSIONS.md;
    const text = String(props?.children ?? "");
    if (!text) return dims.dotSize;
    const specStyle = extractSpecTextStyle("statuslight", props ?? {});
    const fontSize = specStyle?.fontSize ?? dims.fontSize;
    const fontWeight = specStyle?.fontWeight ?? 400;
    const ffamily = specStyle?.fontFamily ?? specFontFamily.sans;
    const textWidth = measureTextWidth(text, fontSize, ffamily, fontWeight);
    return Math.ceil(dims.dotSize + dims.gap + textWidth);
  }

  // 1.15. Link: padding/border 없는 텍스트 전용 인라인 요소
  if (type === "link") {
    const props = element.props as Record<string, unknown> | undefined;
    const text = String(props?.children ?? props?.text ?? "");
    if (!text) return 0;
    const specStyle = extractSpecTextStyle("link", props ?? {});
    const fontSize =
      parseNumericValue(style?.fontSize) ?? specStyle?.fontSize ?? 14;
    const fontWeight = specStyle?.fontWeight ?? 500;
    const ffamily = specStyle?.fontFamily ?? specFontFamily.sans;
    const textWidth = measureTextWidth(text, fontSize, ffamily, fontWeight);
    return Math.ceil(textWidth);
  }

  // 1.2a. CalendarGrid / CalendarHeader: intrinsic width = cellSize * 7 + gap * 6
  if (type === "calendargrid" || type === "calendarheader") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const calDims: Record<string, { iconSize: number; gap: number }> = {
      sm: { iconSize: 20, gap: 4 },
      md: { iconSize: 26, gap: 6 },
      lg: { iconSize: 32, gap: 8 },
    };
    const d = calDims[sizeName] ?? calDims.md;
    const cellSize = d.iconSize + 4;
    return cellSize * 7 + d.gap * 6;
  }

  // 1.17. Breadcrumb (child) — ADR-086 P5: implicitStyles 의 style 주입 제거 후
  //   각 Breadcrumb 의 intrinsic width 를 여기서 산출. 부모 Breadcrumbs 는 자식 isLast 맥락을
  //   가지고 있으나 utils.ts 는 element 단위 호출 → isLast 미지. 보수적으로 "항상 separator
  //   포함" 최대 폭 산출 (last item 은 표시되지 않으므로 trailing whitespace 가 약간 남음).
  if (type === "breadcrumb") {
    const props = element.props as Record<string, unknown> | undefined;
    const parentSize = String(props?.size ?? "M");
    const rspSize = normalizeBreadcrumbRspSizeKey(parentSize);
    const label = String(props?.children ?? props?.label ?? props?.title ?? "");
    if (!label) return 0;
    const specStyle = extractSpecTextStyle("breadcrumb", {
      size: rspSize,
    });
    const fontSize = specStyle?.fontSize ?? 16;
    const fontWeight = specStyle?.fontWeight ?? 400;
    const ffamily = specStyle?.fontFamily ?? specFontFamily.sans;
    // isLast 맥락이 없으므로 non-last 로 가정 (보수적 최대 폭).
    //   실제 last 인 경우 separator 만큼 trailing whitespace 발생 — 시각상 무해.
    const separator = String(props?._separator ?? "›");
    const separatorPadding = breadcrumbSeparatorAfterPaddingXPx(rspSize);
    const isLast = Boolean(props?._isLast);
    const textW = measureTextWidth(
      label,
      fontSize,
      ffamily,
      isLast ? 600 : fontWeight,
    );
    const sepExtra = isLast
      ? 0
      : separatorPadding * 2 +
        measureTextWidth(separator, fontSize, ffamily, 400);
    return Math.ceil(textW + sepExtra);
  }

  // 1.2. Breadcrumbs: ToggleButtonGroup과 동일 패턴 — 자식 Breadcrumb 텍스트 실측 합산
  // fullTreeLayout.ts에서 rawChildren을 enrichChildren으로 전달하여 자식 기반 계산 가능
  if (type === "breadcrumbs") {
    const props = element.props as Record<string, unknown> | undefined;
    const rspSize = normalizeBreadcrumbRspSizeKey(String(props?.size ?? "M"));
    const separator = (props?.separator as string) ?? "›";

    const specStyle = extractSpecTextStyle("breadcrumbs", {
      size: rspSize,
    });
    const fontSize = specStyle?.fontSize ?? 16;
    const fontWeight = specStyle?.fontWeight ?? 400;
    const ffamily = specStyle?.fontFamily ?? specFontFamily.sans;

    // 자식 Breadcrumb 요소에서 레이블 추출 (caller-provided source order)
    const crumbs: string[] = [];
    if (childElements && childElements.length > 0) {
      for (const child of childElements) {
        const childProps = child.props as Record<string, unknown> | undefined;
        const label = String(
          childProps?.children ?? childProps?.label ?? childProps?.title ?? "",
        );
        if (label) crumbs.push(label);
      }
    }
    // 자식이 없으면 기본값
    if (crumbs.length === 0) {
      crumbs.push("Home", "Products", "Detail");
    }

    const separatorPadding = breadcrumbSeparatorAfterPaddingXPx(rspSize);

    // 1) 실측 기반 폭 (모든 텍스트를 measureTextWidth로 계산)
    let measuredWidth = 0;
    for (let i = 0; i < crumbs.length; i++) {
      const isLast = i === crumbs.length - 1;
      const crumbWeight = isLast ? 600 : fontWeight;
      measuredWidth += measureTextWidth(
        crumbs[i],
        fontSize,
        ffamily,
        crumbWeight,
      );
      if (!isLast) {
        const sepWidth = measureTextWidth(separator, fontSize, ffamily, 400);
        measuredWidth += separatorPadding + sepWidth + separatorPadding;
      }
    }

    return Math.ceil(measuredWidth);
  }

  // 1.3. ProgressCircle: diameter 기반 고정 크기
  if (type === "progresscircle") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = String(props?.size ?? "md");
    const dims =
      PROGRESSCIRCLE_DIMENSIONS[sizeName] ?? PROGRESSCIRCLE_DIMENSIONS.md;
    return dims.diameter;
  }

  // 🚀 ToggleButtonGroup: 자식 버튼 텍스트 크기 합산
  // PixiToggleButtonGroup.tsx의 buttonSizes/contentWidth와 동일한 공식
  if (type === "togglebuttongroup") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const sizeConfig =
      TOGGLEBUTTON_SIZE_CONFIG[sizeName] ?? TOGGLEBUTTON_SIZE_CONFIG["md"];
    const borderWidth = sizeConfig.borderWidth;
    const paddingX = sizeConfig.paddingLeft; // paddingLeft === paddingRight
    const orientation = String(props?.orientation || "horizontal");
    const isHorizontal = orientation === "horizontal";
    const gap = readGapValue(style) ?? 0; // CSS gap (0 = default -1px overlap)

    // Spec에서 ToggleButton의 실제 text style 추출 (fontWeight/fontFamily 정합성)
    // children prop을 전달해야 Spec이 text shape를 생성하여 fontWeight 등을 반환함
    const tbSpecStyle = extractSpecTextStyle("togglebutton", {
      size: sizeName,
      children: "x",
    });
    const tbFontSize = tbSpecStyle?.fontSize ?? sizeConfig.fontSize;
    const tbFontWeight = tbSpecStyle?.fontWeight ?? 400;
    const tbFontFamily = tbSpecStyle?.fontFamily ?? specFontFamily.sans;

    // items 배열에서 레이블 추출
    const items = Array.isArray(props?.items) ? (props.items as unknown[]) : [];

    // items prop이 없으면 child elements에서 레이블 추출
    if (items.length === 0 && childElements && childElements.length > 0) {
      for (const child of childElements) {
        const childProps = child.props as Record<string, unknown> | undefined;
        const label = String(
          childProps?.children ?? childProps?.text ?? childProps?.label ?? "",
        );
        if (label) {
          items.push(label);
        }
      }
    }

    if (items.length > 0) {
      const buttonWidths = items.map((item) => {
        const label =
          typeof item === "string"
            ? item
            : (((item as Record<string, unknown>)?.label as string) ??
              ((item as Record<string, unknown>)?.children as string) ??
              "");
        const textWidth = measureTextWidth(
          String(label),
          tbFontSize,
          tbFontFamily,
          tbFontWeight,
        );
        // Math.ceil: enrichWithIntrinsicSize와 동일하게 반올림하여
        // 그룹 폭과 자식 개별 폭 합계의 정합성 유지 (Taffy f32 정밀도)
        const bw = Math.max(
          40,
          Math.ceil(
            borderWidth + paddingX + textWidth + paddingX + borderWidth,
          ),
        );
        return bw;
      });
      if (isHorizontal) {
        // horizontal: 버튼 너비 합 + gap * (n-1)
        // CSS는 margin-inline-start:-1px 오버랩이 있지만 Taffy 자식에는 해당 마진이 없으므로
        // 오버랩 차감 없이 자식 border-box 합계와 일치시켜 Taffy 축소 방지
        return (
          buttonWidths.reduce((sum, w) => sum + w, 0) + gap * (items.length - 1)
        );
      }
      // vertical: 가장 넓은 버튼
      return Math.max(...buttonWidths);
    }
    // items도 children도 없으면 기본값
    return DEFAULT_WIDTH;
  }

  // Phantom indicator space (모듈 스코프 PHANTOM_INDICATOR_CONFIGS 사용)
  const _phantomProps = element.props as Record<string, unknown> | undefined;
  const _phantomSize = (_phantomProps?.size as string) ?? "md";
  const phantomSpace = getPhantomIndicatorSpace(type, _phantomSize);
  const phantomW = phantomSpace?.width ?? 0;

  // 2. Flex 컨테이너: childElements 기반 재귀 너비 계산 (텍스트 추출보다 먼저 처리)
  // TagGroup(flex column, fit-content), TagList(flex row) 등 컨테이너 컴포넌트의
  // intrinsic width를 자식 요소들의 실제 border-box 너비에서 산출
  // ⚠️ 반드시 extractTextContent보다 먼저 와야 함:
  //    TagGroup.props.label = "Tag Group"이 텍스트로 추출되면 ~63px이 반환되어
  //    자식 기반 너비(~132px)에 도달하지 못함
  if (childElements && childElements.length > 0) {
    const display = style?.display;
    if (display === "flex" || display === "inline-flex") {
      const flexDir = (style?.flexDirection as string) || "row";
      const gap = readGapValue(style) ?? 0;
      const isRow = flexDir === "row" || flexDir === "row-reverse";

      const childWidths = childElements.map((child) => {
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        const explicitW = parseNumericValue(childStyle?.width);
        if (explicitW !== undefined) return explicitW;
        // content-box 너비
        const grandChildren = getChildElements?.(child.id);
        const contentW = calculateContentWidth(
          child,
          grandChildren,
          getChildElements,
        );
        // border-box 산출: enrichWithIntrinsicSize와 동일하게 padding + border 추가
        // (Tag, Badge 등 INLINE_BLOCK_TAGS의 spec padding/border가 포함되어야 함)
        const childBox = parseBoxModel(child, 0, -1);
        return (
          contentW +
          childBox.padding.left +
          childBox.padding.right +
          childBox.border.left +
          childBox.border.right
        );
      });

      // Phantom indicator: Checkbox/Radio/Switch의 indicator는 element tree에 없지만
      // spec shapes(Skia)가 시각적으로 그리므로 width 계산에 반영
      // CSS gap이 설정되면 specGap을 제거하고 CSS gap으로 대체
      const hasCSSGapW =
        style?.gap !== undefined || style?.columnGap !== undefined;
      const effectivePhantomW =
        hasCSSGapW && phantomW > 0
          ? phantomW - (phantomSpace?.gap ?? 0)
          : phantomW;

      if (isRow) {
        // phantomW > 0이면 phantom도 flex child로 간주 → gap 횟수에 포함
        const gapCount =
          childElements.length - 1 + (effectivePhantomW > 0 ? 1 : 0);
        return (
          childWidths.reduce((sum, w) => sum + w, 0) +
          gap * Math.max(0, gapCount) +
          effectivePhantomW
        );
      }
      return Math.max(...childWidths, phantomW, 0);
    }
  }

  // 2.5. Button icon-only: text 없이 iconName만 있는 경우 icon 크기 반환
  if (type === "button" || type === "submitbutton" || type === "fancybutton") {
    const btnProps = element.props as Record<string, unknown> | undefined;
    const iconName = btnProps?.iconName as string | undefined;
    const btnText = extractTextContent(btnProps ?? {});
    if (iconName && !btnText) {
      const defaultSize = DEFAULT_SIZE_BY_TAG[type] ?? "md";
      const size = (btnProps?.size as string) ?? defaultSize;
      const sizeConfig =
        BUTTON_SIZE_CONFIG[size] ??
        BUTTON_SIZE_CONFIG[defaultSize] ??
        Object.values(BUTTON_SIZE_CONFIG)[0];
      const btnConfig = sizeConfig as { iconSize?: number };
      const baseIconSize = btnConfig.iconSize ?? 16;
      // fontSize 오버라이드 시 iconSize = fontSize
      const overrideFs = parseNumericValue(style?.fontSize);
      return overrideFs != null ? overrideFs : baseIconSize;
    }
  }

  // 3. 텍스트 콘텐츠 기반 너비 측정 (Canvas 2D measureText 사용)
  // childElements가 없는 legacy Checkbox/Radio/Switch 요소의 fallback 경로
  const text = extractTextContent(element.props as Record<string, unknown>);

  const indicatorConfig = PHANTOM_INDICATOR_CONFIGS[type];
  if (indicatorConfig) {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const s = sizeName as "sm" | "md" | "lg";
    const indicatorSize =
      indicatorConfig.widths[s] ?? indicatorConfig.widths.md;
    const specIndicatorGap = indicatorConfig.gaps[s] ?? indicatorConfig.gaps.md;
    // CSS gap이 설정되면 specGap 대신 CSS gap 사용
    const hasCSSGapSec3 =
      style?.gap !== undefined ||
      style?.rowGap !== undefined ||
      style?.columnGap !== undefined;
    const indicatorGap = hasCSSGapSec3
      ? (readGapValue(style) ?? specIndicatorGap)
      : specIndicatorGap;
    // Spec에서 실제 text style 추출 (fontWeight/fontFamily 정합성)
    const indicatorSpecStyle = extractSpecTextStyle(
      type,
      props as Record<string, unknown>,
    );
    // fallback: typography 토큰 매칭 text-sm=14, text-md=16, text-lg=18
    const fontSize =
      indicatorSpecStyle?.fontSize ??
      (sizeName === "S" ? 14 : sizeName === "L" ? 18 : 16);
    const indicatorFontWeight = indicatorSpecStyle?.fontWeight ?? 400;
    const indicatorFontFamily =
      indicatorSpecStyle?.fontFamily ?? specFontFamily.sans;
    const labelText = String(
      props?.children ?? props?.label ?? props?.text ?? "",
    );
    // Canvas 2D 측정값 사용 (CSS 정합), CanvasKit 렌더링 오차는 nodeRendererText에서 처리
    const textWidth = labelText
      ? Math.ceil(
          measureTextWidth(
            labelText,
            fontSize,
            indicatorFontFamily,
            indicatorFontWeight,
          ),
        )
      : 0;
    const flexDir = style?.flexDirection as string | undefined;
    const isColumn = flexDir === "column" || flexDir === "column-reverse";
    if (isColumn) {
      // Column: 너비 = max(indicator, text)
      return Math.max(indicatorSize, textWidth);
    }
    // Row: 너비 = indicator + gap + text
    return indicatorSize + indicatorGap + textWidth;
  }

  if (text) {
    const props = element.props as Record<string, unknown> | undefined;

    // 버튼, 인풋 등은 size prop에 따라 fontSize 결정
    // padding/border는 parseBoxModel에서 처리 → 여기서는 텍스트 너비만 반환
    // (inline padding 변경 시 이중 계산 방지)
    const isFormElement = BUTTON_LIKE_TAGS.has(type);
    const inlineUIConfig = INLINE_UI_SIZE_CONFIGS[type];
    if (isFormElement || inlineUIConfig) {
      // Spec에서 실제 text style 추출 — 렌더러와 동일한 fontWeight/fontFamily 보장
      const inlineSpecStyle = extractSpecTextStyle(
        type,
        props as Record<string, unknown>,
      );

      const defaultSize = DEFAULT_SIZE_BY_TAG[type] ?? "md";
      const size = (props?.size as string) ?? defaultSize;
      const configMap = isFormElement ? BUTTON_SIZE_CONFIG : inlineUIConfig!;
      const sizeConfig =
        configMap[size] ??
        configMap[defaultSize] ??
        Object.values(configMap)[0];
      // Spec 기반 font 속성 (style override는 Spec 내부에서 반영됨)
      const fontSize =
        parseNumericValue(style?.fontSize) ??
        inlineSpecStyle?.fontSize ??
        sizeConfig.fontSize;
      const inlineFontWeight = inlineSpecStyle?.fontWeight ?? 400;
      const inlineFontFamily =
        inlineSpecStyle?.fontFamily ?? specFontFamily.sans;
      const textWidth = measureTextWidth(
        text,
        fontSize,
        inlineFontFamily,
        inlineFontWeight,
        inlineSpecStyle?.letterSpacing
          ? { letterSpacing: inlineSpecStyle.letterSpacing }
          : undefined,
      );

      // Button icon 너비 반영: iconName이 있으면 iconSize + gap 추가
      let iconExtra = 0;
      if (
        type === "button" ||
        type === "submitbutton" ||
        type === "fancybutton"
      ) {
        const iconName = props?.iconName as string | undefined;
        if (iconName) {
          const btnConfig = sizeConfig as {
            iconSize?: number;
            iconGap?: number;
          };
          let iconSize = btnConfig.iconSize ?? 16;
          // fontSize 오버라이드 시 iconSize = fontSize
          const overrideFs = parseNumericValue(style?.fontSize);
          if (overrideFs != null) {
            iconSize = overrideFs;
          }
          const iconGap = readGapValue(style) ?? btnConfig.iconGap ?? 8;
          if (text) {
            // icon + gap + text
            iconExtra = iconSize + iconGap;
          } else {
            // icon-only: iconSize만 반환
            return iconSize;
          }
        }
      }

      // Tag remove 버튼 너비: allowsRemoving 시 X 아이콘 + gap + padding 추가
      let removeExtra = 0;
      const tagAllowsRemoving = type === "tag" && isTagAllowsRemoving(element);
      if (type === "tag") {
        if (tagAllowsRemoving) {
          const removeIconSize = Math.round(fontSize * 0.75);
          const removeGap = 2; // CSS .tag-remove-btn margin-left
          const removePad = 2; // --spacing-2xs
          removeExtra = removeGap + removePad * 2 + removeIconSize;
        }
      }

      // minWidth 적용: totalWidth = contentWidth + padding >= minWidth
      // PixiBadge와 동일한 너비 계산 (cssVariableReader.ts BADGE_FALLBACKS 참조)
      const minWidth = (sizeConfig as { minWidth?: number }).minWidth;
      if (minWidth !== undefined) {
        const effectivePaddingRight = getTagRemoveAdjustedPaddingRight(
          type,
          sizeConfig,
          tagAllowsRemoving,
        );
        const padding = sizeConfig.paddingLeft + effectivePaddingRight;
        const minContentWidth = Math.max(0, minWidth - padding);
        return Math.max(minContentWidth, textWidth + iconExtra + removeExtra);
      }

      return textWidth + iconExtra + removeExtra;
    }

    // 일반 요소: Spec → inline style → computedStyle → 기본값 순으로 font 속성 해소
    // inline style에 font 속성이 모두 있으면 Spec 조회 스킵 (hot-path 최적화)
    const needsSpecFallback =
      style?.fontSize == null ||
      style?.fontWeight == null ||
      style?.fontFamily == null;
    const specStyle = needsSpecFallback
      ? extractSpecTextStyle(type, element.props as Record<string, unknown>)
      : null;
    // ADR-058 Phase 1: Text가 Spec 경로로 전환되면서 extractSpecTextStyle이
    // 실제 shape에서 fontSize를 읽어오므로 5-point patch 분기 제거.
    const fontSize =
      parseNumericValue(style?.fontSize) ??
      specStyle?.fontSize ??
      computedStyle?.fontSize ??
      16;
    const fontFamily =
      (style?.fontFamily as string) ??
      specStyle?.fontFamily ??
      computedStyle?.fontFamily ??
      specFontFamily.sans;
    const fontWeight =
      style?.fontWeight ??
      specStyle?.fontWeight ??
      computedStyle?.fontWeight ??
      400;
    const letterSpacing =
      parseNumericValue(style?.letterSpacing) ??
      computedStyle?.letterSpacing ??
      0;
    const wordSpacing =
      parseNumericValue(style?.wordSpacing) ?? computedStyle?.wordSpacing ?? 0;

    // textTransform 적용: 렌더러(TextSprite.tsx)는 applyTextTransform() 후 텍스트를 그림
    // 측정도 동일한 변환 후 텍스트로 수행해야 폭이 일치
    const textTransform =
      (style?.textTransform as string | undefined) ??
      computedStyle?.textTransform;
    const measuredText = applyTextTransform(text, textTransform);

    // lineHeight 계산: styleConverter.ts convertToTextStyle()와 동일 로직
    // 렌더러(nodeRenderers.ts)의 ParagraphStyle.heightMultiplier와 일치시키기 위해 필수
    const rawLineHeight = style?.lineHeight ?? computedStyle?.lineHeight;
    let lineHeight: number | undefined;
    if (rawLineHeight != null) {
      const lh = parseNumericValue(rawLineHeight);
      if (lh != null) {
        const isMultiplier =
          lh < 10 &&
          (typeof rawLineHeight === "number" ||
            (typeof rawLineHeight === "string" &&
              /^\d*\.?\d+$/.test(String(rawLineHeight).trim())));
        lineHeight = isMultiplier ? lh * fontSize : lh;
      }
    } else {
      // Tailwind CSS v4 기본 line-height: 1.5
      lineHeight = 1.5 * fontSize;
    }

    const baseWidth = measureTextWidth(
      measuredText,
      fontSize,
      fontFamily,
      fontWeight as number | string,
      {
        letterSpacing,
        wordSpacing,
        fontStyle: (style?.fontStyle ?? computedStyle?.fontStyle) as
          | number
          | string
          | undefined,
        fontStretch: (style?.fontStretch ?? computedStyle?.fontStretch) as
          | string
          | undefined,
        fontVariant: (style?.fontVariant ?? computedStyle?.fontVariant) as
          | string
          | undefined,
        lineHeight,
      },
    );
    // Canvas 2D 측정값 사용 (CSS 정합), CanvasKit 렌더링 오차는 nodeRendererText에서 처리
    return Math.ceil(baseWidth);
  }

  // 4. Image: 자연 치수 캐시에서 로드된 이미지의 실제 너비 사용 (fit-content/auto)
  if (type === "image") {
    const props = element.props as Record<string, unknown> | undefined;
    const src = String(props?.src || props?.source || "");
    if (src) {
      const dims = getImageNaturalDimensions(src);
      if (dims) return dims.width;
    }
  }

  // 5. 태그별 기본 너비 사용 (ADR-096 Phase 4)
  //    5a. ComponentSpec.defaultWidth (Spec 있는 태그: input/select/textarea/image)
  const spec = LOWERCASE_TAG_SPEC_MAP.get(type);
  if (spec?.defaultWidth !== undefined) return spec.defaultWidth;

  //    5b. HTML primitive default (img/video/canvas/iframe)
  const primitiveWidth = HTML_PRIMITIVE_DEFAULT_WIDTHS[type];
  if (primitiveWidth !== undefined) return primitiveWidth;

  // 6. 알 수 없는 태그는 기본값 사용
  return DEFAULT_WIDTH;
}

// ADR-091 Phase 2: TABS_BAR_HEIGHT / TABS_PANEL_PADDING 중간 캐시 제거.
//   소비처는 `TabsSpec.sizes[size].height` / `TabPanelsSpec.sizes[size].paddingX` 직접 참조
//   또는 `specSizeField("tabs"/"tabpanels", sizeName, "height"/"paddingX")` (implicitStyles 경로) 사용.

// ADR-096 Phase 4: DEFAULT_ELEMENT_HEIGHTS Record 해체.
//   - Spec 있는 태그 (button/select/textarea/image) → `ComponentSpec.defaultHeight`
//   - HTML primitive (p/span/h1~h6/div/section/... 26 type) → `HTML_PRIMITIVE_DEFAULT_HEIGHTS`
//   lookup 체인: spec.defaultHeight → HTML_PRIMITIVE_DEFAULT_HEIGHTS → estimateTextHeight() fallback
//   - input: InputSpec.sizes 기반 동적 계산 (step 2.5) — defaultHeight 미설정
//   - label: Tailwind CSS v4 line-height:1.5 적용 → step 7에서 동적 계산 (fontSize*1.5)

/**
 * 텍스트 높이 추정
 *
 * Canvas 2D measureText()는 width만 정확하고 height는 브라우저마다 다름.
 * CSS/PixiJS의 텍스트 높이와 동일하게 fontSize * lineHeight 비율로 추정.
 *
 * @param fontSize - 폰트 크기 (px)
 * @param lineHeight - 명시적 line-height (px); undefined이면 fontBoundingBox 기반 측정
 * @param fontFamily - 폰트 패밀리 (기본 Pretendard)
 * @param fontWeight - 폰트 두께 (기본 400)
 * @returns 추정 텍스트 높이
 */
function estimateTextHeight(
  fontSize: number,
  lineHeight?: number,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
): number {
  // 명시적 lineHeight가 있으면 float 그대로 반환 (Math.round 제거)
  if (lineHeight !== undefined) {
    return lineHeight;
  }
  // CSS line-height: normal 근사값 (fontBoundingBox 기반)
  // Button 등 UI 컴포넌트는 line-height: normal이 적용됨
  const fm = measureFontMetrics(fontFamily, fontSize, fontWeight);
  return fm.lineHeight;
}

/**
 * 요소의 콘텐츠 높이 계산
 *
 * @param element - 대상 요소
 * @param availableWidth - 사용 가능한 너비 (Card 등 텍스트 wrap 높이 계산용)
 * @returns 콘텐츠 기반 높이 (자식이 없으면 태그별 기본 높이)
 */
export function calculateContentHeight(
  element: Element,
  availableWidth?: number,
  childElements?: Element[],
  getChildElements?: (id: string) => Element[],
  computedStyle?: ComputedStyle,
): number {
  const style = element.props?.style as Record<string, unknown> | undefined;

  // 0. display: none → 레이아웃에서 제외, 높이 0
  if (style?.display === "none") return 0;

  // 1. 명시적 height가 있으면 사용
  const explicitHeight = parseNumericValue(style?.height);
  if (explicitHeight !== undefined) return explicitHeight;

  // 1.45. Icon: iconSize 기반 intrinsic height (fit-content)
  const tag1 = (element.type ?? "").toLowerCase();
  if (tag1 === "icon") {
    const props = element.props as Record<string, unknown> | undefined;
    // fontSize 오버라이드 시 iconSize = fontSize
    // ADR-091 Phase 3: ICON_SIZE_MAP Record (R7) → IconSpec.sizes.iconSize 직접 참조.
    const overrideFs = parseNumericValue(style?.fontSize);
    if (overrideFs != null) return overrideFs;
    const sizeName = String(props?.size ?? "md");
    return IconSpec.sizes[sizeName]?.iconSize ?? 18;
  }

  // 1.5. StatusLight: spec sizes에 정의된 고정 높이
  if (tag1 === "statuslight") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = String(props?.size ?? "md");
    const dims = STATUSLIGHT_DIMENSIONS[sizeName] ?? STATUSLIGHT_DIMENSIONS.md;
    return dims.height;
  }

  // 1.55. Link: padding/border 없는 텍스트 전용 인라인 요소 — fontSize 기반 높이
  if (tag1 === "link") {
    const props = element.props as Record<string, unknown> | undefined;
    const specStyle = extractSpecTextStyle("link", props ?? {});
    const fontSize =
      parseNumericValue(style?.fontSize) ?? specStyle?.fontSize ?? 14;
    return estimateTextHeight(fontSize, undefined);
  }

  // 1.55b. ListBox: items SSOT 기반 intrinsic border-box height.
  // ADR-907 Layer D: `render.shapes` 와 동일한 `resolveListBoxSpacingMetric` 심볼을
  // 호출해 padding/gap/borderWidth/item/header metric 을 공유 — style.rowGap/columnGap/gap
  // longhand+shorthand 전개는 Layer B (resolveContainerSpacing) 가 처리.
  if (tag1 === "listbox") {
    const props = element.props as Record<string, unknown> | undefined;
    const rawEntries = props?.items;
    const fontSize = parseNumericValue(style?.fontSize) ?? 14;
    const metric = resolveListBoxSpacingMetric({
      style: style as Record<string, unknown> | undefined,
      defaultFontSize: fontSize,
    });

    const entries =
      Array.isArray(rawEntries) && rawEntries.length > 0
        ? rawEntries
        : [
            { id: "item-1", label: "Item 1" },
            { id: "item-2", label: "Item 2" },
            { id: "item-3", label: "Item 3" },
          ];
    let totalItems = 0;
    let sectionCount = 0;
    let nonFirstSectionCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (isListBoxSectionEntry(entry)) {
        sectionCount++;
        totalItems += entry.items.length;
        if (i > 0) nonFirstSectionCount++;
      } else {
        totalItems += 1;
      }
    }
    const entryCount = totalItems + sectionCount;
    const innerHeight =
      totalItems * metric.itemHeight +
      sectionCount * metric.headerHeight +
      Math.max(0, entryCount - 1) * metric.rowGap +
      nonFirstSectionCount * metric.sectionTopPad;
    return (
      metric.paddingTop +
      metric.paddingBottom +
      innerHeight +
      metric.borderWidth * 2
    );
  }

  // 1.55c. GridList (ADR-099 Phase 5): items SSOT 기반 intrinsic border-box height.
  // 신규 GridList 는 자식 GridListItem element 없이 props.items 로 카드 목록을 렌더한다.
  // 따라서 layout 도 spec.render.shapes 와 동일하게 entries/items + section/header +
  // layout(stack|grid) 를 기준으로 높이를 계산해야 item 수 변화가 즉시 반영된다.
  if (tag1 === "gridlist") {
    const props = element.props as Record<string, unknown> | undefined;
    const rawEntries = props?.items;
    const entries =
      Array.isArray(rawEntries) && rawEntries.length > 0
        ? rawEntries
        : [
            { id: "i1", label: "Item 1", description: "Description" },
            { id: "i2", label: "Item 2", description: "Description" },
            { id: "i3", label: "Item 3", description: "Description" },
            { id: "i4", label: "Item 4", description: "Description" },
          ];

    const layout = String(props?.layout ?? "stack");
    // ADR-907 Phase 3 Wave B: Layer D resolver 단일 경로.
    //   style.gap/padding/borderWidth/fontSize 소비 + resolveGridListItemMetric 분기 캡슐화.
    //   4-way padding 지원 (paddingTop+paddingBottom) — 기존 paddingY*2 대칭 가정 해소.
    const metric = resolveGridListSpacingMetric({
      style: style as Record<string, unknown> | undefined,
      layout: layout === "grid" ? "grid" : "stack",
      columns: Number(props?.columns ?? 2) || 2,
    });
    const {
      rowGap: gap,
      paddingTop,
      paddingBottom,
      borderWidth,
      fontSize,
      numCols,
      cardPaddingY,
      descGap,
    } = metric;
    const descFontSize = fontSize - 2;
    const HEADER_HEIGHT = Math.round(fontSize * 1.75);
    const SECTION_TOP_PAD = Math.round(fontSize * 0.5);

    const cardHeight = (item: { description?: string }) =>
      cardPaddingY * 2 +
      fontSize +
      (item.description ? descFontSize + descGap : 0);

    const measureGridRows = (
      items: Array<{ description?: string }>,
    ): number => {
      if (items.length === 0) return 0;
      let total = 0;
      for (let i = 0; i < items.length; i += numCols) {
        const rowItems = items.slice(i, i + numCols);
        const rowHeight = rowItems.reduce(
          (max, item) => Math.max(max, cardHeight(item)),
          0,
        );
        total += rowHeight;
        if (i + numCols < items.length) total += gap;
      }
      return total;
    };

    let innerHeight = 0;
    let hasRenderedBlock = false;
    let pendingTopLevelItems: Array<{ description?: string }> = [];

    const flushPendingTopLevelItems = (): void => {
      if (pendingTopLevelItems.length === 0) return;
      if (hasRenderedBlock) innerHeight += gap;
      innerHeight +=
        layout === "grid"
          ? measureGridRows(pendingTopLevelItems)
          : pendingTopLevelItems.reduce((sum, item, index) => {
              const next = sum + cardHeight(item);
              return index < pendingTopLevelItems.length - 1
                ? next + gap
                : next;
            }, 0);
      pendingTopLevelItems = [];
      hasRenderedBlock = true;
    };

    for (const entry of entries) {
      if (isGridListSectionEntry(entry)) {
        flushPendingTopLevelItems();
        if (hasRenderedBlock) innerHeight += SECTION_TOP_PAD;
        innerHeight += HEADER_HEIGHT;
        if (entry.items.length > 0) innerHeight += gap;
        innerHeight +=
          layout === "grid"
            ? measureGridRows(entry.items)
            : entry.items.reduce((sum, item, index) => {
                const next = sum + cardHeight(item);
                return index < entry.items.length - 1 ? next + gap : next;
              }, 0);
        hasRenderedBlock = true;
      } else {
        pendingTopLevelItems.push(entry);
      }
    }
    flushPendingTopLevelItems();

    return paddingTop + paddingBottom + innerHeight + borderWidth * 2;
  }

  // 1.55d. TagList (ADR-097 Phase 4B): items SSOT + row-wrap 기반 intrinsic height.
  // Migration 후 Tag element 가 orphan 처리된 상태 (childElements=0) 에서 TagList
  // 자신은 자식 없는 컨테이너로 취급되지만, TagGroup.propagation 으로 items 를 수신한
  // TagList spec shapes 가 wrap 시뮬레이션으로 chips 를 self-render 한다.
  // layout 도 동일 공식 (availableWidth 기반 행 시뮬레이션) 으로 rows × chipHeight +
  // (rows-1) × rowGap 반환.
  // (ADR-105-d — formerly @sync F5-8 annotation)
  // TagList.spec.ts shapes() 의 wrap 시뮬레이션(availableWidth 기반 행 계산) 을 미러링.
  // TAG_CHIP_SIZES 상수는 ADR-105-a 에서 primitives 로 이관 완료.
  // TagList.spec.ts shapes() wrap 알고리즘 변경 시 이 레이아웃 계산도 동시 갱신 필요.
  if (tag1 === "taglist") {
    const props = element.props as Record<string, unknown> | undefined;
    const items = props?.items as Array<{ label?: string }> | undefined;
    if (!items || items.length === 0) return 0;

    const sizeName = (props?.size as keyof typeof TAG_CHIP_SIZES) ?? "md";
    const chipSize = TAG_CHIP_SIZES[sizeName] ?? TAG_CHIP_SIZES.md;
    const fontSize = parseNumericValue(style?.fontSize) ?? chipSize.fontSize;
    // Tag spec 정식 치수 공식: height = lineHeight + paddingY*2 (fontSize 아님).
    // TagList.spec.ts shapes() 와 반드시 동일해야 Skia/layout 정합성 유지.
    const tagHeight = chipSize.lineHeight + chipSize.paddingY * 2;
    const gap = chipSize.gap;
    const rowGap = gap;

    const allowsRemoving = Boolean(props?.allowsRemoving);
    // Tag.spec.ts / TagList.spec.ts 관례: allowsRemoving 시 paddingRight=paddingY
    //   (text-X 레이아웃 과밀 방지). chipWidth 공식도 이에 맞춰 paddingLeft+paddingRight
    //   형태로 분리.
    const chipPaddingRight = allowsRemoving
      ? chipSize.paddingY
      : chipSize.paddingX;
    // X 아이콘 예약 폭: gap(4) + iconSize(fontSize)
    const iconGap = 4;
    const removeExtraWidth = allowsRemoving ? iconGap + fontSize : 0;

    const maxRowsRaw = props?.maxRows;
    const maxRows = typeof maxRowsRaw === "number" ? maxRowsRaw : 0;

    const containerWidth =
      availableWidth && availableWidth > 0 ? availableWidth : 350;

    // wrap 시뮬레이션 중 실제 chip 이 "배치된" 마지막 행/우측 끝을 추적.
    //   rowIndex 는 다음 chip 이 들어갈 후보 행이므로, maxRows break 시점에는
    //   이미 +1 된 would-be 행을 가리킨다(chip 미배치). 따라서 `rowIndex + 1` 로
    //   높이를 계산하면 항상 한 행이 과다 예약되는 기존 버그가 발생한다.
    let currentRowWidth = 0;
    let rowIndex = 0;
    let shouldShowAll = false;
    let hasAnyPlaced = false;
    let lastPlacedRowIndex = 0;
    let lastPlacedRowEnd = 0;

    for (let i = 0; i < items.length; i++) {
      const label = items[i].label || `Tag ${i + 1}`;
      const textWidth = measureTextWidth(label, fontSize, "Pretendard", 400);
      const chipWidth =
        textWidth + chipSize.paddingX + chipPaddingRight + removeExtraWidth;
      const gapBefore = i > 0 && currentRowWidth > 0 ? gap : 0;

      if (i > 0 && currentRowWidth + gapBefore + chipWidth > containerWidth) {
        rowIndex++;
        currentRowWidth = 0;
      }

      if (maxRows > 0 && rowIndex >= maxRows) {
        shouldShowAll = true;
        break;
      }

      const x = currentRowWidth === 0 ? 0 : currentRowWidth + gap;
      currentRowWidth = x + chipWidth;
      hasAnyPlaced = true;
      lastPlacedRowIndex = rowIndex;
      lastPlacedRowEnd = currentRowWidth;
    }

    if (!hasAnyPlaced) return 0;

    // Show all chip 배치 규칙 — TagList.spec.ts shapes() Phase 3 과 반드시 동일:
    //   lastPlacedRowEnd + gap + showAllWidth <= containerWidth  → 같은 행(+0)
    //   초과  → 다음 행 wrap (+1)
    // 두 경로가 어긋나면 Show all 이 컨테이너 경계 밖으로 돌출하거나 하단 여백 과다.
    let extraRow = 0;
    if (shouldShowAll) {
      const showAllTextWidth = measureTextWidth(
        "Show all",
        fontSize,
        "Pretendard",
        400,
      );
      const showAllWidth = showAllTextWidth + chipSize.paddingX * 2;
      const fitsOnSameRow =
        lastPlacedRowEnd + gap + showAllWidth <= containerWidth;
      extraRow = fitsOnSameRow ? 0 : 1;
    }

    const rows = lastPlacedRowIndex + 1 + extraRow;
    return rows * tagHeight + Math.max(0, rows - 1) * rowGap;
  }

  // 1.6. ToggleButtonGroup: 자식 ToggleButton의 border-box 높이 기반 계산
  // ToggleButtonGroup 자체는 padding/border 없는 flex 컨테이너이므로
  // content-box height = 자식 ToggleButton의 border-box height
  const tag0 = (element.type ?? "").toLowerCase();
  if (tag0 === "togglebuttongroup") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const sizeConfig =
      TOGGLEBUTTON_SIZE_CONFIG[sizeName] ?? TOGGLEBUTTON_SIZE_CONFIG["md"];
    const fontSize = sizeConfig.fontSize;
    // CSS 명시적 line-height 기반 텍스트 높이 + padding + border
    const textHeight = estimateTextHeight(fontSize, sizeConfig.lineHeight);
    return textHeight + sizeConfig.paddingY * 2 + sizeConfig.borderWidth * 2;
  }

  // 2. Self-rendering 요소는 size prop에 따라 높이 결정
  // contentHeight는 content-box 높이(텍스트 영역)만 반환해야 함
  // padding/border는 parseBoxModel에서 별도 관리 → BlockEngine이 합산
  const type = (element.type ?? "").toLowerCase();
  const inlineUIConfig = INLINE_UI_SIZE_CONFIGS[type];
  const isButtonLike = BUTTON_LIKE_BOX_TAGS.has(type);
  if (isButtonLike || inlineUIConfig) {
    const props = element.props as Record<string, unknown> | undefined;
    const defaultSize = DEFAULT_SIZE_BY_TAG[type] ?? "md";
    const size = (props?.size as string) ?? defaultSize;
    const configMap = isButtonLike ? BUTTON_SIZE_CONFIG : inlineUIConfig!;
    const sizeConfig =
      configMap[size] ?? configMap[defaultSize] ?? Object.values(configMap)[0];

    // 사용자가 인라인 padding을 설정했는지 확인 (configHeight 분기보다 먼저 판별 필요)
    const hasInlinePadding =
      style?.padding !== undefined ||
      style?.paddingTop !== undefined ||
      style?.paddingBottom !== undefined;

    // configHeight: border-box 기준 → content-box로 변환
    const configHeight = (sizeConfig as { height?: number }).height;
    const configContentHeight =
      configHeight !== undefined && !hasInlinePadding
        ? Math.max(
            0,
            configHeight - sizeConfig.paddingY * 2 - sizeConfig.borderWidth * 2,
          )
        : undefined;

    const fontSize = parseNumericValue(style?.fontSize) ?? sizeConfig.fontSize;
    const resolvedLineHeight = parseLineHeight(style, fontSize);
    // CSS Button은 명시적 line-height를 사용 → inline style이 없으면 config의 lineHeight 적용
    const configLineHeight = (sizeConfig as { lineHeight?: number }).lineHeight;
    const effectiveLineHeight = resolvedLineHeight ?? configLineHeight;
    const textHeight = estimateTextHeight(fontSize, effectiveLineHeight);
    // MIN_BUTTON_HEIGHT는 border-box 기준 → content-box 최소값으로 변환
    // 사용자가 인라인 padding을 설정한 경우 MIN_BUTTON_HEIGHT 미적용 (padding:0으로 축소 허용)
    const minContentHeight = hasInlinePadding
      ? 0
      : Math.max(
          0,
          MIN_BUTTON_HEIGHT -
            sizeConfig.paddingY * 2 -
            sizeConfig.borderWidth * 2,
        );

    // 텍스트 줄바꿈 높이 계산: availableWidth가 제공되면 줄바꿈 고려
    // configHeight보다 먼저 체크하여 텍스트가 줄바꿈되면 더 큰 높이를 사용
    if (availableWidth != null && availableWidth > 0) {
      const paddingX =
        parseNumericValue(style?.paddingLeft) ??
        parseNumericValue(style?.padding) ??
        sizeConfig.paddingLeft;
      const maxTextWidth = availableWidth - paddingX * 2;
      if (maxTextWidth > 0) {
        const textContent = String(
          props?.children ?? props?.text ?? props?.label ?? "",
        );
        if (textContent) {
          // Button/Badge 등은 CSS 기본 white-space: normal → width 제약 시 줄바꿈 허용
          // 사용자가 white-space를 명시적으로 설정한 경우만 그 값을 사용
          const ws = (style?.whiteSpace as string) ?? "normal";
          const fw = parseNumericValue(style?.fontWeight) ?? 500;
          const wbVal = (style?.wordBreak as string) ?? undefined;
          const owVal = (style?.overflowWrap as string) ?? undefined;
          const measured = measureTextWithWhiteSpace(
            textContent,
            fontSize,
            specFontFamily.sans,
            fw,
            ws,
            maxTextWidth,
            wbVal,
            owVal,
            effectiveLineHeight,
          );
          if (measured.height > textHeight + 0.5) {
            const wrappedHeight = Math.max(measured.height, minContentHeight);
            // 텍스트 줄바꿈 높이가 configHeight보다 크면 확장
            return configContentHeight !== undefined
              ? Math.max(wrappedHeight, configContentHeight)
              : wrappedHeight;
          }
        }
      }
    }

    // 텍스트 줄바꿈 없음: configHeight가 있으면 고정 높이 사용
    if (configContentHeight !== undefined) {
      return configContentHeight;
    }

    return Math.max(textHeight, minContentHeight);
  }

  // 2.5. Input: fontSize 기반 동적 높이 계산 (Text 컴포넌트와 동일 패턴)
  // InputSpec.sizes에서 fontSize를 읽고, line-height: 1.5 기준으로 텍스트 높이 반환
  if (type === "input") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const sizeConfig = InputSpec.sizes[sizeName] ?? InputSpec.sizes.md;
    const rawFontSize = sizeConfig.fontSize;
    const specFontSize =
      typeof rawFontSize === "number"
        ? rawFontSize
        : typeof rawFontSize === "string" && rawFontSize.startsWith("{")
          ? (resolveToken(
              rawFontSize as Parameters<typeof resolveToken>[0],
            ) as number)
          : 16;
    const fontSize = parseNumericValue(style?.fontSize) ?? specFontSize;
    const resolvedLineHeight = parseLineHeight(style, fontSize);
    // CSS Input은 명시적 line-height 사용 → BUTTON_SIZE_CONFIG에서 lineHeight 참조
    // Input height = Button height (동일 size에서 동일 높이)
    const configLineHeight = BUTTON_SIZE_CONFIG[sizeName]?.lineHeight;
    const effectiveLineHeight = resolvedLineHeight ?? configLineHeight;
    return estimateTextHeight(fontSize, effectiveLineHeight);
  }

  // 2.6a. ProgressCircle: diameter 기반 고정 크기
  if (type === "progresscircle") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = String(props?.size ?? "md");
    const dims =
      PROGRESSCIRCLE_DIMENSIONS[sizeName] ?? PROGRESSCIRCLE_DIMENSIONS.md;
    return dims.diameter;
  }

  // 2.6. ProgressBar/Meter: spec shapes 기반 높이 계산
  // label/showValue가 있으면 fontSize + gap + barHeight, 없으면 barHeight만
  if (
    type === "progressbar" ||
    type === "progress" ||
    type === "loadingbar" ||
    type === "meter" ||
    type === "gauge"
  ) {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = String(props?.size ?? "md");
    const isMeter = type === "meter" || type === "gauge";
    const dims = isMeter
      ? (METER_DIMENSIONS[sizeName] ?? METER_DIMENSIONS.md)
      : (PROGRESSBAR_DIMENSIONS[sizeName] ?? PROGRESSBAR_DIMENSIONS.md);
    const barHeight = dims.barHeight;

    // label 또는 showValue가 있으면 텍스트 행 높이 추가
    const hasLabel = !!props?.label;
    const hasValue = props?.showValueLabel !== false; // ProgressBar/Meter 모두 기본 true
    if (hasLabel || hasValue) {
      const fontSize = parseNumericValue(style?.fontSize) ?? 14;
      const gap = isMeter ? 8 : 8; // spec sizes[*].gap
      // ADR-051: label 텍스트가 줄바꿈될 수 있으므로 measureWrappedTextHeight 사용
      const labelText = String(props?.label ?? "");
      const fontWeight =
        parseNumericValue(style?.fontWeight) ??
        computedStyle?.fontWeight ??
        400;
      const ff =
        (style?.fontFamily as string) ??
        computedStyle?.fontFamily ??
        specFontFamily.sans;
      const resolvedLH = parseLineHeight(style, fontSize) ?? fontSize * 1.5;
      let textH = Math.ceil(resolvedLH);
      if (labelText && availableWidth != null && availableWidth > 0) {
        textH = measureWrappedTextHeight(
          labelText,
          fontSize,
          fontWeight,
          ff,
          availableWidth,
          resolvedLH,
        );
        textH = Math.max(textH, Math.ceil(resolvedLH));
      }
      return textH + gap + barHeight;
    }
    return barHeight;
  }

  // 3. SelectTrigger/ComboBoxWrapper: content-box 높이 반환
  // CSS border-box 높이 = lineHeight + paddingY*2 + borderWidth*2
  // calculateContentHeight는 content-box만 반환 → enrichWithIntrinsicSize에서 padding/border 추가
  // content-box = border-box - paddingY*2 (border는 SelectTrigger에 없고 부모 Button에 있음)
  if (type === "selecttrigger" || type === "comboboxwrapper") {
    const parentProps = element.props as Record<string, unknown> | undefined;
    const parentSize = (parentProps?.size as string) ?? "md";
    // content-box = border-box - paddingY*2 - borderWidth*2
    // borderWidth=1 (CSS .react-aria-Button / .combobox-container)
    // ADR-091 Phase 3: SelectTriggerSpec.sizes.contentHeight 직접 참조.
    //   SelectTrigger 와 ComboBoxWrapper 는 tagSpecMap 에서 동일 spec(SelectTriggerSpec) 참조.
    return SelectTriggerSpec.sizes[parentSize]?.contentHeight ?? 20;
  }

  // 3b. CardHeader/CardContent: 투명 컨테이너 — 자식 높이 합산/max
  // Card의 새 트리 구조(Card → CardHeader → Heading, Card → CardContent → Description)에서
  // 각 래퍼가 자신의 자식 높이를 올바르게 반환해야 Card 전체 높이 계산이 정확해짐
  // flexDirection에 따라: column → 합산+gap, row → max (일반 flex 컨테이너와 동일)
  if (type === "cardheader" || type === "cardcontent") {
    if (childElements && childElements.length > 0) {
      const gapValue = readGapValue(style) ?? 8;
      const flexDir = (style?.flexDirection as string) || "column";
      const isColumn = flexDir === "column" || flexDir === "column-reverse";

      const childHeights = childElements.map((child) => {
        const grandChildren = getChildElements?.(child.id);
        const contentH = calculateContentHeight(
          child,
          availableWidth,
          grandChildren,
          getChildElements,
        );
        // 자식의 border-box 높이 계산: content-box + padding + border
        // Button 등 자식이 auto height일 때 padding/border를 포함해야 정확한 합산
        // (일반 flex 컨테이너 브랜치와 동일 패턴)
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        const childTag = (child.type ?? "").toLowerCase();
        const childExplicitH = parseNumericValue(childStyle?.height);
        const childIsFormEl = ["button", "input", "select"].includes(childTag);
        const childBoxSizing = childStyle?.boxSizing as string | undefined;
        const childIsSectionLike = childTag === "section";
        const childIsCardLike = childTag === "card" || childTag === "box";
        const childIsBorderBox =
          childBoxSizing === "border-box" ||
          (childIsFormEl && childExplicitH !== undefined) ||
          ((childIsSectionLike || childIsCardLike) &&
            childBoxSizing !== "content-box" &&
            childExplicitH !== undefined);

        if (childExplicitH !== undefined && childIsBorderBox) {
          return childExplicitH;
        }
        const childBox = parseBoxModel(child, 0, -1);
        return (
          contentH +
          childBox.padding.top +
          childBox.padding.bottom +
          childBox.border.top +
          childBox.border.bottom
        );
      });

      if (isColumn) {
        return Math.max(
          childHeights.reduce((sum, h) => sum + h, 0) +
            gapValue * Math.max(0, childHeights.length - 1),
          0,
        );
      }
      // row: 높이 = 가장 큰 자식의 높이
      return Math.max(...childHeights, 0);
    }
    return 0;
  }

  // 3. Card 컴포넌트: 자식 기반 or 텍스트 콘텐츠 기반 높이 계산
  // 🚀 Card는 style.padding이 있으므로 BlockEngine이 padding을 별도로 추가함
  // contentHeight는 content-box 높이만 반환 (padding 제외)
  if (type === "card") {
    // childElements가 있으면 자식 기반 높이 계산 (display:flex column)
    // Card factory가 Heading + Description 자식을 생성하므로 이 경로가 우선
    if (childElements && childElements.length > 0) {
      const gap = readGapValue(style) ?? 8;
      // Card padding을 빼서 자식의 실제 텍스트 줄바꿈 너비 계산
      const cardPad = parsePadding(style, availableWidth);
      const childAvailableWidth =
        availableWidth != null
          ? availableWidth - cardPad.left - cardPad.right
          : availableWidth;
      let totalHeight = 0;
      for (let i = 0; i < childElements.length; i++) {
        const grandChildren = getChildElements?.(childElements[i].id);
        totalHeight += calculateContentHeight(
          childElements[i],
          childAvailableWidth,
          grandChildren,
          getChildElements,
        );
        if (i < childElements.length - 1) totalHeight += gap;
      }
      return Math.max(totalHeight, 36);
    }

    // fallback: props 기반 (자식 없는 Card)
    const props = element.props as Record<string, unknown> | undefined;
    const size = (props?.size as string) ?? "md";
    const cardConfig = CARD_SIZE_CONFIG[size] ?? CARD_SIZE_CONFIG.md;

    // padding은 style.padding 우선, 없으면 size config 사용
    const stylePadding = parseNumericValue(style?.padding);
    const cardPad = stylePadding ?? cardConfig.padding;

    // Card 너비: availableWidth가 있으면 사용, 없으면 200px 폴백
    const cardWidth = availableWidth ?? 200;
    const wrapWidth = cardWidth - cardPad * 2;
    const fontFamily = specFontFamily.sans;

    const cardTitle = String(props?.title || "");
    const description = String(props?.description || props?.children || "");

    let h = 0; // content-box height (padding 제외)

    if (cardTitle) {
      h += measureWrappedTextHeight(cardTitle, 16, 600, fontFamily, wrapWidth);
    }
    if (cardTitle) {
      h += 8; // marginBottom between header and content
    }
    if (description) {
      h += measureWrappedTextHeight(
        description,
        14,
        400,
        fontFamily,
        wrapWidth,
      );
    }

    // minHeight 36 (60 - 24px default padding = 36px content)
    return Math.max(h, 36);
  }

  // 3.5. Calendar/RangeCalendar Compositional Architecture: Card 패턴과 동일
  // Calendar → CalendarHeader + CalendarGrid 자식 높이 합산
  if (CALENDAR_LIKE_TAGS.has(type)) {
    if (childElements && childElements.length > 0) {
      const gap = readGapValue(style) ?? 6;
      const calPad = parsePadding(style, availableWidth);
      const childAvailableWidth =
        availableWidth != null
          ? availableWidth - calPad.left - calPad.right
          : availableWidth;
      let totalHeight = 0;
      for (let i = 0; i < childElements.length; i++) {
        totalHeight += calculateContentHeight(
          childElements[i],
          childAvailableWidth,
          undefined,
          getChildElements,
        );
        if (i < childElements.length - 1) totalHeight += gap;
      }
      return Math.max(totalHeight, 0);
    }
    return 0;
  }

  // CalendarHeader: intrinsic height = 버튼 높이 (sm:24, md:30, lg:36)
  // ADR-091 Phase 3: headerHeights Record → CalendarHeaderSpec.sizes.height 직접 참조.
  if (type === "calendarheader") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    return CalendarHeaderSpec.sizes[sizeName]?.height ?? 30;
  }

  // DateInput: intrinsic height — DateInputSpec.sizes.height 직접 참조 (ADR-091 Phase 3).
  if (type === "dateinput") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    return DateInputSpec.sizes[sizeName]?.height ?? 30;
  }

  // CalendarGrid: intrinsic height = weekdayRow + dateRows
  if (type === "calendargrid") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const gridDims: Record<string, { iconSize: number; gap: number }> = {
      sm: { iconSize: 20, gap: 4 },
      md: { iconSize: 26, gap: 6 },
      lg: { iconSize: 32, gap: 8 },
    };
    const d = gridDims[sizeName] ?? gridDims.md;
    const cellSize = d.iconSize + 4;
    const gp = d.gap;
    const now = new Date();
    const dayOffset =
      (props?.dayOffset as number) ??
      new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const totalDays =
      (props?.totalDays as number) ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const totalRows = Math.ceil((totalDays + dayOffset) / 7);
    return cellSize + totalRows * (cellSize + gp) - gp;
  }

  // 3.6a. DatePicker: 자식 기반 동적 높이 계산 (Card/Calendar 패턴)
  if (type === "datepicker") {
    if (childElements && childElements.length > 0) {
      const gap = readGapValue(style) ?? 8;
      const dpPad = parsePadding(style, availableWidth);
      const childAvailableWidth =
        availableWidth != null
          ? availableWidth - dpPad.left - dpPad.right
          : availableWidth;
      let totalHeight = 0;
      for (let i = 0; i < childElements.length; i++) {
        totalHeight += calculateContentHeight(
          childElements[i],
          childAvailableWidth,
          undefined,
          getChildElements,
        );
        if (i < childElements.length - 1) totalHeight += gap;
      }
      return Math.max(totalHeight, 0);
    }
    return 0;
  }

  // 3.6b. DateField: intrinsic height from size (sm:32, md:40, lg:48, xl:62)
  // ADR-091 Addendum 2: dfHeights Record → DateFieldSpec.sizes.intrinsicHeight 직접 참조.
  //   Label + gap + DateInput 합산 파생값을 spec 에 표면화 (composite 전체 intrinsic).
  if (type === "datefield") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    return DateFieldSpec.sizes[sizeName]?.intrinsicHeight ?? 40;
  }

  // 3.6c. ComboBox/Select: 자식 기반 동적 높이 계산 (Card 패턴)
  // Select/ComboBox: 실제 visible 자식들의 높이 합산 + gap (flexDirection:column)
  // Dropdown: 레거시 spec shapes 기반 계산
  // ADR-091 Phase 3: COMBOBOX_INPUT_HEIGHTS Record → ComboBoxSpec.sizes.height 직접 참조.
  const comboBoxHeight = (sz: string): number =>
    ComboBoxSpec.sizes[sz]?.height ?? 30;
  // ADR-073: SelectItem/ComboBoxItem element 소멸 → props.items SSOT 로 이관되어 childElements 에 애초 등장하지 않음.
  // ListBoxItem 만 드롭다운 전용 자식으로 남아 collapsed 상태에서 비표시.
  const SELECT_HIDDEN_CHILDREN = new Set(["ListBoxItem"]);
  if (type === "combobox" || type === "select" || type === "dropdown") {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const isCompositional = type === "select" || type === "combobox";

    // gap: display:flex일 때만 적용 (CSS gap은 block에서 미적용)
    const displayVal = style?.display;
    const isFlex = displayVal === "flex" || displayVal === "inline-flex";
    const gapRaw = style?.gap;
    const gap = isFlex ? parsePxValue(gapRaw, 8) : 0;

    // Select/ComboBox: 실제 visible 자식 요소 순회 (Card와 동일 패턴)
    // label prop이 없으면 Label 자식 제외 (web preview 동작과 일치)
    if (isCompositional && childElements) {
      const hasLabel = !!props?.label;
      // wrapper type: Select → SelectTrigger, ComboBox → ComboBoxWrapper
      const wrapperTag =
        type === "select" ? "SelectTrigger" : "ComboBoxWrapper";
      const visibleChildren = childElements.filter(
        (c) =>
          !SELECT_HIDDEN_CHILDREN.has(c.type ?? "") &&
          (c.type !== "Label" || hasLabel),
      );
      let totalH = 0;
      let visibleCount = 0;

      for (const child of visibleChildren) {
        const childTag = (child.type ?? "").toLowerCase();
        const childStyle = (child.props?.style || {}) as Record<
          string,
          unknown
        >;
        let childH: number;

        if (child.type === wrapperTag) {
          // SelectTrigger/ComboBoxWrapper: spec size.height를 직접 사용
          // CSS에서 trigger/wrapper 높이 = lineHeight + paddingY*2 + borderWidth*2
          // 이 값은 spec sizes.height에 이미 반영되어 있음
          childH = comboBoxHeight(sizeName);
        } else if (
          childTag === "label" ||
          childTag === "description" ||
          childTag === "fielderror"
        ) {
          // 텍스트 자식: explicit height 우선, 없으면 줄바꿈 포함 높이 계산
          // CSS Preview 정합성: LabelSpec lineHeight(--text-sm--line-height 등) 우선 사용
          const explicitH = parseNumericValue(childStyle.height);
          if (explicitH != null && explicitH > 0) {
            childH = explicitH;
          } else {
            const fontSize =
              parseFloat(String(childStyle.fontSize ?? 14)) || 14;
            const lh = parseLineHeight(
              childStyle as Record<string, unknown>,
              fontSize,
            );
            const resolvedLH =
              lh != null ? Math.ceil(lh) : Math.ceil(fontSize * 1.5);
            // ADR-051: Description/Label 텍스트 줄바꿈 시 높이 동적 확장
            // 텍스트가 있고 availableWidth가 있으면 measureWrappedTextHeight로 정확한 높이 계산
            const childProps = child.props as
              | Record<string, unknown>
              | undefined;
            const childText = String(
              childProps?.children ?? childProps?.text ?? "",
            );
            const childFontFamily =
              (childStyle.fontFamily as string) ??
              computedStyle?.fontFamily ??
              specFontFamily.sans;
            if (childText && availableWidth != null && availableWidth > 0) {
              const childPad = parsePadding(childStyle, availableWidth);
              const maxTextW = availableWidth - childPad.left - childPad.right;
              if (maxTextW > 0) {
                const wrappedH = measureWrappedTextHeight(
                  childText,
                  fontSize,
                  parseFloat(String(childStyle.fontWeight ?? 400)) || 400,
                  childFontFamily,
                  maxTextW,
                  resolvedLH,
                  childStyle.wordBreak as
                    | "normal"
                    | "break-all"
                    | "keep-all"
                    | undefined,
                  childStyle.overflowWrap as
                    | "normal"
                    | "break-word"
                    | "anywhere"
                    | undefined,
                );
                childH = Math.max(wrappedH, resolvedLH);
              } else {
                childH = resolvedLH;
              }
            } else {
              childH = resolvedLH;
            }
          }
        } else {
          // 기타 자식: explicit height 또는 텍스트 기반
          if (typeof childStyle.height === "number") {
            childH = childStyle.height;
          } else {
            // ADR-051: 텍스트가 있으면 줄바꿈 포함 높이 계산
            const otherProps = child.props as
              | Record<string, unknown>
              | undefined;
            const otherText = String(
              otherProps?.children ?? otherProps?.text ?? "",
            );
            const otherFs = parseFloat(String(childStyle.fontSize ?? 14)) || 14;
            const otherLH =
              parseLineHeight(childStyle as Record<string, unknown>, otherFs) ??
              otherFs * 1.5;
            if (otherText && availableWidth != null && availableWidth > 0) {
              const otherFw =
                parseFloat(String(childStyle.fontWeight ?? 400)) || 400;
              const otherFf =
                (childStyle.fontFamily as string) ??
                computedStyle?.fontFamily ??
                specFontFamily.sans;
              const otherPad = parsePadding(
                childStyle as Record<string, unknown>,
                availableWidth,
              );
              const otherMaxW = availableWidth - otherPad.left - otherPad.right;
              if (otherMaxW > 0) {
                const otherWrappedH = measureWrappedTextHeight(
                  otherText,
                  otherFs,
                  otherFw,
                  otherFf,
                  otherMaxW,
                  otherLH,
                );
                childH = Math.max(otherWrappedH, Math.ceil(otherLH));
              } else {
                childH = Math.ceil(otherLH);
              }
            } else {
              childH = Math.ceil(otherLH);
            }
          }
        }

        if (childH > 0) {
          totalH += childH;
          visibleCount++;
        }
      }

      // gap 추가 (visible 자식 사이)
      if (visibleCount > 1) {
        totalH += gap * (visibleCount - 1);
      }
      return totalH;
    }

    // Dropdown: 레거시 spec shapes 기반 계산
    const bodyHeight = comboBoxHeight(sizeName);
    const hasLabel = !!props?.label;
    if (hasLabel) {
      const labelChild = childElements?.find((c) => c.type === "Label");
      const labelStyle = (labelChild?.props?.style || {}) as Record<
        string,
        unknown
      >;
      const labelFontSize = parseFloat(String(labelStyle.fontSize ?? 14)) || 14;
      const labelLH =
        parseLineHeight(labelStyle, labelFontSize) ?? labelFontSize * 1.5;
      // ADR-051: Label 텍스트 줄바꿈 포함 높이 계산
      const labelProps = labelChild?.props as
        | Record<string, unknown>
        | undefined;
      const labelText = String(
        labelProps?.children ?? labelProps?.text ?? props?.label ?? "",
      );
      let labelHeight = Math.ceil(labelLH);
      if (labelText && availableWidth != null && availableWidth > 0) {
        const labelFw = parseFloat(String(labelStyle.fontWeight ?? 400)) || 400;
        const labelFf =
          (labelStyle.fontFamily as string) ??
          computedStyle?.fontFamily ??
          specFontFamily.sans;
        labelHeight = measureWrappedTextHeight(
          labelText,
          labelFontSize,
          labelFw,
          labelFf,
          availableWidth,
          labelLH,
        );
        labelHeight = Math.max(labelHeight, Math.ceil(labelLH));
      }
      return labelHeight + gap + bodyHeight;
    }
    return bodyHeight;
  }

  // 3.5. Checkbox/Radio/Switch: flexDirection에 따른 높이 계산
  // (PHANTOM_INDICATOR_CONFIGS 단일 소스 사용)
  const heightIndicatorConfig = PHANTOM_INDICATOR_CONFIGS[type];
  if (heightIndicatorConfig) {
    const props = element.props as Record<string, unknown> | undefined;
    const sizeName = (props?.size as string) ?? "md";
    const s = sizeName as "sm" | "md" | "lg";
    const indicatorH =
      heightIndicatorConfig.heights[s] ?? heightIndicatorConfig.heights.md;
    const specGap =
      heightIndicatorConfig.gaps[s] ?? heightIndicatorConfig.gaps.md;
    const hasCSSGapH =
      style?.gap !== undefined ||
      style?.rowGap !== undefined ||
      style?.columnGap !== undefined;
    const gap = hasCSSGapH ? (readGapValue(style) ?? specGap) : specGap;

    // Label 자식의 fontSize로 높이 추정 (size delegation 반영)
    let labelFs = 14;
    if (childElements && childElements.length > 0) {
      const labelChild = childElements.find((c) => c.type === "Label");
      if (labelChild) {
        const labelStyle = (labelChild.props?.style || {}) as Record<
          string,
          unknown
        >;
        const explicitFs = parseNumericValue(labelStyle.fontSize);
        if (explicitFs != null && explicitFs > 0) {
          labelFs = explicitFs;
        } else {
          // Label에 인라인 fontSize 없으면 spec size delegation에서 결정
          const specStyle = extractSpecTextStyle("Label", {
            ...labelChild.props,
            size: sizeName,
            children: "x",
          } as Record<string, unknown>);
          if (specStyle?.fontSize) labelFs = specStyle.fontSize;
        }
      }
    } else {
      // 자식 없는 synthetic label: spec size에서 fontSize 추출
      const specStyle = extractSpecTextStyle(type, {
        ...props,
        children: "x",
      } as Record<string, unknown>);
      if (specStyle?.fontSize) labelFs = specStyle.fontSize;
    }
    // CSS line-height 토큰: text-xs(12)=16, text-sm(14)=20, text-base(16)=24, text-lg(18)=28
    const LABEL_LH: Record<number, number> = { 12: 16, 14: 20, 16: 24, 18: 28 };
    const labelLineH = LABEL_LH[labelFs] ?? Math.round(labelFs * 1.5);

    const flexDir = style?.flexDirection as string | undefined;
    const isColumn = flexDir === "column" || flexDir === "column-reverse";
    if (isColumn) {
      return indicatorH + gap + labelLineH;
    }
    return Math.max(indicatorH, labelLineH);
  }

  // 4. Panel: spec shapes 기반 컴포넌트 — 자식 요소 없이 자체 렌더링
  // CSS Preview 기준 높이 추정 (title section + content section + border)
  // ⚠️ childElements 블록 밖에 배치: Panel은 element tree에 자식이 없음
  if (type === "panel") {
    const props = element.props as Record<string, unknown> | undefined;
    const hasTitle = !!props?.title;
    const sizeName = (props?.size as string) ?? "md";
    const PANEL_HEIGHTS: Record<
      string,
      { withTitle: number; noTitle: number }
    > = {
      sm: { withTitle: 80, noTitle: 44 },
      md: { withTitle: 104, noTitle: 64 },
      lg: { withTitle: 130, noTitle: 80 },
    };
    const heights = PANEL_HEIGHTS[sizeName] ?? PANEL_HEIGHTS.md;
    return hasTitle ? heights.withTitle : heights.noTitle;
  }

  // 4.2. Breadcrumbs: display:flex, align-items:center — 높이 = spec size.height
  // RSP API: S=16px, M=24px, L=24px (default M)
  if (type === "breadcrumbs") {
    const props = element.props as Record<string, unknown> | undefined;
    const rspSize = normalizeBreadcrumbRspSizeKey(String(props?.size ?? "M"));
    return BreadcrumbsSpec.sizes[rspSize]?.height ?? 24;
  }

  // 4.2b. Breadcrumb (child) — ADR-086 P5: implicitStyles style 주입 제거 후
  //   child height 를 부모 Breadcrumbs spec.sizes.height 로 산출 (동일 값).
  if (type === "breadcrumb") {
    const props = element.props as Record<string, unknown> | undefined;
    const rspSize = normalizeBreadcrumbRspSizeKey(String(props?.size ?? "M"));
    return BreadcrumbsSpec.sizes[rspSize]?.height ?? 24;
  }

  // 4.5. 컨테이너 컴포넌트: childElements 기반 높이 계산 (lineHeight보다 먼저 처리)
  // CheckboxGroup, RadioGroup 등 자식 요소를 포함하는 컨테이너의 intrinsic height 산출
  // ⚠️ lineHeight 체크보다 먼저 와야 함: 컨테이너의 높이는 자식 기반으로 산출해야 함
  if (childElements && childElements.length > 0) {
    // CheckboxGroup: 그룹 라벨 + 자식 Checkbox 세로 합산
    if (type === "checkboxgroup" || type === "radiogroup") {
      const props = element.props as Record<string, unknown> | undefined;
      const sizeName = (props?.size as string) ?? "md";
      const gap = sizeName === "S" ? 8 : sizeName === "L" ? 16 : 12;

      let totalHeight = 0;
      // 그룹 라벨
      if (props?.label) {
        // typography 토큰 매칭: text-sm=14, text-md=16, text-lg=18
        const labelFontSize =
          sizeName === "S" ? 14 : sizeName === "L" ? 18 : 16;
        totalHeight += estimateTextHeight(labelFontSize) + 8; // label + spacing
      }
      // 자식 Checkbox/Radio 항목
      for (let i = 0; i < childElements.length; i++) {
        const grandChildren = getChildElements?.(childElements[i].id);
        totalHeight += calculateContentHeight(
          childElements[i],
          availableWidth,
          grandChildren,
          getChildElements,
        );
        if (i < childElements.length - 1) totalHeight += gap;
      }
      return totalHeight;
    }

    // TagGroup: Label + TagList 세로 합산 (ADR-097 Phase 4A/4B).
    //   CheckboxGroup/RadioGroup 선례 대칭 — 일반 flex-column 분기가 style.display/
    //   flexDirection 누락 시 block 합산으로 흘러들어 TagList 의 maxRows/row-wrap 기반
    //   동적 높이가 반영되지 않는 문제를 전용 분기로 확정 처리.
    //   TagList 재귀 호출은 이미 tag1==="taglist" 분기에서 items + maxRows + availableWidth
    //   기반 row-wrap height 를 돌려주므로 여기서는 단순 세로 합산 + gap 만 담당.
    if (type === "taggroup") {
      const props = element.props as Record<string, unknown> | undefined;
      // containerStyles.gap = "{spacing.xs}" → 4. style.gap 편집 우선, 없으면 token fallback.
      const gap = readGapValue(style) ?? 4;
      // labelPosition="side" 시 row 배치 → 세로 합산이 아닌 max 여야 하지만, 동일 flex-column
      //   기본 케이스 우선 처리. side 케이스는 하위 flex 분기에서 이미 처리됨.
      const labelPos = (props?.labelPosition as string | undefined) ?? "top";
      const isSideLayout = labelPos === "side";

      let totalHeight = 0;
      const childHeights: number[] = [];
      for (let i = 0; i < childElements.length; i++) {
        const child = childElements[i];
        const grandChildren = getChildElements?.(child.id);
        // 자식 element 의 enriched style.height 가 있으면 calculateContentHeight 가
        //   explicitHeight 분기로 즉시 반환. 없으면 각 태그 전용 분기 (e.g. taglist)
        //   가 row-wrap 기반 intrinsic height 를 계산.
        const contentH = calculateContentHeight(
          child,
          availableWidth,
          grandChildren,
          getChildElements,
          computedStyle,
        );
        const childBox = parseBoxModel(child, 0, -1);
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        const childExplicitH = parseNumericValue(childStyle?.height);
        // content-box + padding + border (border-box) 환산. explicit border-box 가 있으면 그대로 사용.
        const childBorderBox =
          childExplicitH !== undefined && childStyle?.boxSizing === "border-box"
            ? childExplicitH
            : contentH +
              childBox.padding.top +
              childBox.padding.bottom +
              childBox.border.top +
              childBox.border.bottom;
        childHeights.push(childBorderBox);
      }

      if (isSideLayout) {
        // row: 가장 큰 자식의 높이 (Label 은 보통 TagList 보다 짧음)
        return Math.max(...childHeights, 0);
      }
      // column (default): 세로 합산 + gap
      for (let i = 0; i < childHeights.length; i++) {
        totalHeight += childHeights[i];
        if (i < childHeights.length - 1) totalHeight += gap;
      }
      return totalHeight;
    }

    // Tabs: 탭 바 높이 + TabPanel 패딩 + 활성 Panel 높이
    // CSS Preview 기준: Tabs(flex col) → TabList(30px) + TabPanel(pad=16px → Panel)
    if (type === "tabs") {
      const props = element.props as Record<string, unknown> | undefined;
      const sizeName = (props?.size as string) ?? "md";
      const tabBarHeight =
        TabsSpec.sizes[sizeName]?.height ?? TabsSpec.sizes.md.height;
      const tabPanelPadding =
        TabPanelsSpec.sizes[sizeName]?.paddingX ??
        TabPanelsSpec.sizes.md.paddingX;

      // 활성 Panel의 높이 계산 (Dual Lookup: 직속 → TabPanels 내부)
      let panelChildren = childElements.filter((c) => c.type === "TabPanel");
      if (panelChildren.length === 0) {
        const tabPanelsEl = childElements.find((c) => c.type === "TabPanels");
        if (tabPanelsEl && getChildElements) {
          panelChildren = getChildElements(tabPanelsEl.id).filter(
            (c) => c.type === "TabPanel",
          );
        }
      }
      const selectedKey =
        (props?.selectedKey as string | undefined) ??
        (props?.defaultSelectedKey as string | undefined);
      // ADR-066: TabPanel.props.itemId로 페어링
      const activePanel = selectedKey
        ? (panelChildren.find(
            (p) =>
              (p.props as Record<string, unknown> | undefined)?.itemId ===
              selectedKey,
          ) ?? panelChildren[0])
        : panelChildren[0];
      if (activePanel) {
        const panelGrandChildren = getChildElements?.(activePanel.id);
        const panelHeight = calculateContentHeight(
          activePanel,
          availableWidth,
          panelGrandChildren,
          getChildElements,
        );
        const panelBox = parseBoxModel(activePanel, 0, -1);
        const panelBorderBox =
          panelHeight +
          panelBox.padding.top +
          panelBox.padding.bottom +
          panelBox.border.top +
          panelBox.border.bottom;
        return tabBarHeight + tabPanelPadding * 2 + panelBorderBox;
      }
      return tabBarHeight;
    }

    // 일반 flex 컨테이너: flexDirection에 따라 자식 높이 합산/max
    const display = style?.display;
    if (display === "flex" || display === "inline-flex") {
      const flexDir = (style?.flexDirection as string) || "row";
      const gap = readGapValue(style) ?? 0;
      const isColumn = flexDir === "column" || flexDir === "column-reverse";

      // display: none 자식은 레이아웃에서 제외 (높이 0, gap 미적용)
      const visibleChildren = childElements.filter((child) => {
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        return childStyle?.display !== "none";
      });

      const childHeights = visibleChildren.map((child) => {
        const grandChildren = getChildElements?.(child.id);
        const contentH = calculateContentHeight(
          child,
          availableWidth,
          grandChildren,
          getChildElements,
        );
        // 자식에 explicit height가 있고 border-box로 처리되는 경우,
        // calculateContentHeight가 반환한 값이 이미 border-box 높이이므로
        // padding+border를 추가하면 이중 계산됨
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        const childTag = (child.type ?? "").toLowerCase();
        const childExplicitH = parseNumericValue(childStyle?.height);
        const childIsFormEl = ["button", "input", "select"].includes(childTag);
        const childBoxSizing = childStyle?.boxSizing as string | undefined;
        const childIsSectionLike = childTag === "section";
        const childIsCardLike = childTag === "card" || childTag === "box";
        const childIsBorderBox =
          childBoxSizing === "border-box" ||
          (childIsFormEl && childExplicitH !== undefined) ||
          ((childIsSectionLike || childIsCardLike) &&
            childBoxSizing !== "content-box" &&
            childExplicitH !== undefined);

        if (childExplicitH !== undefined && childIsBorderBox) {
          // border-box: explicit height가 이미 padding+border 포함
          return childExplicitH;
        }
        // content-box: padding + border 추가
        const childBox = parseBoxModel(child, 0, -1);
        return (
          contentH +
          childBox.padding.top +
          childBox.padding.bottom +
          childBox.border.top +
          childBox.border.bottom
        );
      });

      if (isColumn) {
        return (
          childHeights.reduce((sum, h) => sum + h, 0) +
          gap * Math.max(0, visibleChildren.length - 1)
        );
      }
      return Math.max(...childHeights, 0);
    }

    // 일반 block/기타 컨테이너: block flow에서 자식 높이 세로 합산
    // display:flex가 아닌 컨테이너(display:block, 미지정 등)도
    // 자식이 있으면 자식 높이를 합산해야 정확한 높이 반환
    // (Menu → MenuItem, Disclosure → DisclosureHeader/Content 등)
    const visibleBlockChildren = childElements.filter((child) => {
      const cs = child.props?.style as Record<string, unknown> | undefined;
      return cs?.display !== "none";
    });

    if (visibleBlockChildren.length > 0) {
      // Group: 자식이 원래 캔버스 좌표(left/top)를 유지하므로
      // block flow 합산이 아닌 bounding box 기반 높이 계산
      if (type === "group") {
        let minTop = Infinity;
        let maxBottom = 0;
        for (const child of visibleBlockChildren) {
          const childStyle = child.props?.style as
            | Record<string, unknown>
            | undefined;
          const childTop = parseNumericValue(childStyle?.top) ?? 0;
          const grandChildren = getChildElements?.(child.id);
          const contentH = calculateContentHeight(
            child,
            availableWidth,
            grandChildren,
            getChildElements,
          );
          const childBox = parseBoxModel(child, 0, -1);
          const borderBoxH =
            contentH +
            childBox.padding.top +
            childBox.padding.bottom +
            childBox.border.top +
            childBox.border.bottom;
          minTop = Math.min(minTop, childTop);
          maxBottom = Math.max(maxBottom, childTop + borderBoxH);
        }
        return minTop === Infinity ? 0 : maxBottom - minTop;
      }

      const blockChildHeights = visibleBlockChildren.map((child) => {
        const grandChildren = getChildElements?.(child.id);
        const contentH = calculateContentHeight(
          child,
          availableWidth,
          grandChildren,
          getChildElements,
        );
        const childStyle = child.props?.style as
          | Record<string, unknown>
          | undefined;
        const childTag = (child.type ?? "").toLowerCase();
        const childExplicitH = parseNumericValue(childStyle?.height);
        const childIsFormEl = ["button", "input", "select"].includes(childTag);
        const childBoxSizing = childStyle?.boxSizing as string | undefined;
        const childIsSectionLike = childTag === "section";
        const childIsCardLike = childTag === "card" || childTag === "box";
        const childIsBorderBox =
          childBoxSizing === "border-box" ||
          (childIsFormEl && childExplicitH !== undefined) ||
          ((childIsSectionLike || childIsCardLike) &&
            childBoxSizing !== "content-box" &&
            childExplicitH !== undefined);

        if (childExplicitH !== undefined && childIsBorderBox) {
          return childExplicitH;
        }
        const childBox = parseBoxModel(child, 0, -1);
        return (
          contentH +
          childBox.padding.top +
          childBox.padding.bottom +
          childBox.border.top +
          childBox.border.bottom
        );
      });

      // Block flow: 세로 합산 (gap 없음, margin collapse는 미지원)
      return blockChildHeights.reduce((sum, h) => sum + h, 0);
    }
  }

  // 4.9. Leaf text elements: 텍스트 줄바꿈 시 높이 자동 확장
  // TEXT_LEAF_TAGS 요소는 텍스트만 포함하는 리프 노드이므로
  // availableWidth가 있으면 줄바꿈을 고려한 실제 높이를 반환
  // whiteSpace: "nowrap"이면 줄바꿈 없으므로 스킵
  const ws49 = style?.whiteSpace as string | undefined;
  if (
    TEXT_LEAF_TAGS.has(type) &&
    availableWidth != null &&
    availableWidth > 0 &&
    ws49 !== "nowrap" &&
    ws49 !== "pre"
  ) {
    const props = element.props as Record<string, unknown> | undefined;
    const textContent = String(
      props?.children ?? props?.text ?? props?.label ?? "",
    );
    if (textContent) {
      // ADR-058 Phase 1: Text가 Spec 경로로 전환되면서 5-point patch 분기 제거.
      const fs0 =
        parseNumericValue(style?.fontSize) ?? computedStyle?.fontSize ?? 16;
      const fw0 =
        parseNumericValue(style?.fontWeight) ??
        computedStyle?.fontWeight ??
        400;
      const ff0 =
        (style?.fontFamily as string) ??
        computedStyle?.fontFamily ??
        specFontFamily.sans;
      const pad = parsePadding(style, availableWidth);
      const maxTextWidth = availableWidth - pad.left - pad.right;
      if (maxTextWidth > 0) {
        // Tailwind CSS v4 기본 line-height: 1.5 → fontSize * 1.5
        const resolvedLH = parseLineHeight(style, fs0) ?? fs0 * 1.5;
        const wb1 = style?.wordBreak as string as
          | "normal"
          | "break-all"
          | "keep-all"
          | undefined;
        const ow1 = style?.overflowWrap as string as
          | "normal"
          | "break-word"
          | "anywhere"
          | undefined;
        const wrappedHeight = measureWrappedTextHeight(
          textContent,
          fs0,
          fw0,
          ff0,
          maxTextWidth,
          resolvedLH,
          wb1,
          ow1,
        );
        const singleLineH = resolvedLH;
        if (wrappedHeight > singleLineH + 0.5) {
          return wrappedHeight;
        }
      }
    }
  }

  // 5. lineHeight가 명시적으로 지정되어 있으면 최소 높이로 사용
  const fontSize =
    parseNumericValue(style?.fontSize) ?? computedStyle?.fontSize;
  const resolvedLineHeight = parseLineHeight(style, fontSize);
  if (resolvedLineHeight !== undefined) {
    // float 정밀도 유지: Math.round 제거 → 소수점 절사로 인한 줄바꿈 방지
    return resolvedLineHeight;
  }

  // 6. Image: 자연 치수 캐시에서 로드된 이미지의 실제 높이 사용 (fit-content/auto)
  if (type === "image") {
    const props = element.props as Record<string, unknown> | undefined;
    const src = String(props?.src || props?.source || "");
    if (src) {
      const dims = getImageNaturalDimensions(src);
      if (dims) return dims.height;
    }
  }

  // 7. 태그별 기본 높이 사용 (ADR-096 Phase 4)
  //    7a. ComponentSpec.defaultHeight (Spec 있는 태그: button/select/textarea/image)
  const spec = LOWERCASE_TAG_SPEC_MAP.get(type);
  if (spec?.defaultHeight !== undefined) return spec.defaultHeight;

  //    7b. HTML primitive default (p/span/h1~h6/div/section/... 26 type)
  const primitiveHeight = HTML_PRIMITIVE_DEFAULT_HEIGHTS[type];
  if (primitiveHeight !== undefined) return primitiveHeight;

  // 8. Text/Heading 등 composition 커스텀 태그: CSS line-height: 1.5 상속
  // Preview iframe의 :root { line-height: 1.5 } (Tailwind CSS v4 기본)이
  // Text 컴포넌트에 상속되므로 fontSize * 1.5를 명시적으로 전달
  // (Button 등 UI 컴포넌트는 line-height: normal → step 2에서 fontBoundingBox 기반 처리)
  const fs = fontSize ?? 16;
  return estimateTextHeight(fs, fs * 1.5);
}

/**
 * 요소의 박스 모델 계산
 *
 * 🚀 Phase 11: min/max width/height 파싱, box-sizing: border-box 지원
 *
 * @param element - 대상 요소
 * @param availableWidth - 사용 가능한 너비 (% 계산용)
 * @param availableHeight - 사용 가능한 높이 (% 계산용)
 * @param viewportWidth - vw 계산용
 * @param viewportHeight - vh 계산용
 */
export function parseBoxModel(
  element: Element,
  availableWidth: number,
  availableHeight: number,
  viewportWidth?: number,
  viewportHeight?: number,
): BoxModel {
  const style = element.props?.style as Record<string, unknown> | undefined;

  // width/height 파싱 (%, px, vh, vw, auto 지원)
  let width = parseSize(
    style?.width,
    availableWidth,
    viewportWidth,
    viewportHeight,
  );
  let height = parseSize(
    style?.height,
    availableHeight,
    viewportWidth,
    viewportHeight,
  );

  // min/max 파싱
  const minWidth = parseSize(
    style?.minWidth,
    availableWidth,
    viewportWidth,
    viewportHeight,
  );
  const maxWidth = parseSize(
    style?.maxWidth,
    availableWidth,
    viewportWidth,
    viewportHeight,
  );
  const minHeight = parseSize(
    style?.minHeight,
    availableHeight,
    viewportWidth,
    viewportHeight,
  );
  const maxHeight = parseSize(
    style?.maxHeight,
    availableHeight,
    viewportWidth,
    viewportHeight,
  );

  // padding 파싱 (C3: availableWidth 전달로 % 값 해석)
  let padding = parsePadding(style, availableWidth);

  // border 파싱
  let border = parseBorder(style);

  // Self-rendering 요소: inline style이 없으면 size config 기본값 적용
  // Select는 Compositional Architecture (Card와 동일) — BUTTON_SIZE_CONFIG 미적용
  // Select 컨테이너는 web CSS에서 padding:0 + display:flex 구조이며,
  // 내부 SelectTrigger가 자체 padding을 처리
  const type = (element.type ?? "").toLowerCase();
  const isFormElement = BUTTON_LIKE_BOX_TAGS.has(type);
  const inlineUISizeConfig = INLINE_UI_SIZE_CONFIGS[type];
  const hasSizeConfig = isFormElement || !!inlineUISizeConfig;

  if (hasSizeConfig) {
    const props = element.props as Record<string, unknown> | undefined;
    const defaultSize = DEFAULT_SIZE_BY_TAG[type] ?? "md";
    const size = (props?.size as string) ?? defaultSize;
    const configMap = isFormElement ? BUTTON_SIZE_CONFIG : inlineUISizeConfig!;
    const sizeConfig =
      configMap[size] ?? configMap[defaultSize] ?? Object.values(configMap)[0];

    const hasInlinePadding =
      style?.padding !== undefined ||
      style?.paddingTop !== undefined ||
      style?.paddingRight !== undefined ||
      style?.paddingBottom !== undefined ||
      style?.paddingLeft !== undefined;
    if (!hasInlinePadding) {
      const tagAllowsRemoving = type === "tag" && isTagAllowsRemoving(element);
      // Icon-only 버튼: paddingX = paddingY (정사각형 패딩)
      const isIconOnlyButton =
        isFormElement &&
        !!(props?.iconName as string) &&
        !extractTextContent(props ?? {});
      const effectivePaddingLeft = isIconOnlyButton
        ? sizeConfig.paddingY
        : sizeConfig.paddingLeft;
      const effectivePaddingRight = isIconOnlyButton
        ? sizeConfig.paddingY
        : getTagRemoveAdjustedPaddingRight(type, sizeConfig, tagAllowsRemoving);
      padding = {
        top: sizeConfig.paddingY,
        right: effectivePaddingRight,
        bottom: sizeConfig.paddingY,
        left: effectivePaddingLeft,
      };
    }

    const hasInlineBorder =
      style?.borderWidth !== undefined ||
      style?.borderTopWidth !== undefined ||
      style?.borderRightWidth !== undefined ||
      style?.borderBottomWidth !== undefined ||
      style?.borderLeftWidth !== undefined;
    if (!hasInlineBorder) {
      border = {
        top: sizeConfig.borderWidth,
        right: sizeConfig.borderWidth,
        bottom: sizeConfig.borderWidth,
        left: sizeConfig.borderWidth,
      };
    }
  }

  // 🚀 Phase 11: box-sizing: border-box 처리
  // border-box인 경우 width/height에서 padding + border 제외하여 content-box 크기로 변환
  //
  // 🚀 Self-rendering 요소(button, input, select)도 border-box로 처리:
  // PixiButton 등은 명시적 width/height를 총 렌더링 크기(border-box)로 취급하지만,
  // BlockEngine은 content-box + padding + border로 합산하므로 이중 계산 발생.
  // Flex 경로에서는 stripSelfRenderedProps()로 해결하지만,
  // BlockEngine 경로에서는 parseBoxModel 단계에서 border-box 변환으로 해결.
  const boxSizing = style?.boxSizing as string | undefined;
  // Preview iframe는 전역 `* { box-sizing: border-box; }`를 사용한다.
  // Section/Card(Box)는 style.boxSizing이 비어 있어도 명시적 width/height를
  // border-box로 해석해야 Web 모드와 동일하게 총 크기(패딩 포함)가 유지된다.
  const isSectionElement = type === "section";
  const isCardLikeElement = type === "card" || type === "box";
  const isCalendarElement = CALENDAR_LIKE_TAGS.has(type);
  const isDatePickerElement = type === "datepicker";
  const treatAsBorderBox =
    boxSizing === "border-box" ||
    (isFormElement && (width !== undefined || height !== undefined)) ||
    ((isSectionElement ||
      isCardLikeElement ||
      isCalendarElement ||
      isDatePickerElement) &&
      boxSizing !== "content-box" &&
      (width !== undefined || height !== undefined));

  // Button 등 self-rendering 요소의 텍스트 줄바꿈 높이를 정확히 계산하려면
  // 요소 자체의 border-box width를 사용해야 함 (부모의 availableWidth가 아닌)
  // border-box 변환 전에 원래 width를 저장
  const originalBorderBoxWidth = width;

  if (treatAsBorderBox) {
    const paddingH = padding.left + padding.right;
    const borderH = border.left + border.right;
    const paddingV = padding.top + padding.bottom;
    const borderV = border.top + border.bottom;

    // FIT_CONTENT sentinel은 border-box 변환 대상이 아님 (실제 px 값이 아니므로)
    if (width !== undefined && width !== FIT_CONTENT) {
      width = Math.max(0, width - paddingH - borderH);
    }
    if (height !== undefined && height !== FIT_CONTENT) {
      height = Math.max(0, height - paddingV - borderV);
    }
  }

  // 콘텐츠 크기 계산
  const elementAvailableWidth =
    originalBorderBoxWidth !== undefined &&
    originalBorderBoxWidth !== FIT_CONTENT
      ? originalBorderBoxWidth
      : availableWidth;
  const contentWidth = calculateContentWidth(element);
  const contentHeight = calculateContentHeight(element, elementAvailableWidth);

  return {
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    contentWidth,
    contentHeight,
    padding,
    border,
  };
}

// ---------------------------------------------------------------------------
// Intrinsic Size 주입 (§6 P1: Taffy 엔진 공유)
// ---------------------------------------------------------------------------

/**
 * CSS 스펙에서 기본 display가 inline-block인 태그
 *
 * 레이아웃 엔진이 이 요소들을 block으로 처리할 때,
 * width가 없으면 100%로 확장된다.
 * fit-content 동작을 에뮬레이트하기 위해 intrinsic width를 주입한다.
 */
export const INLINE_BLOCK_TAGS = new Set([
  "button",
  "submitbutton",
  "fancybutton",
  "togglebutton",
  "badge",
  "progresscircle",
  "type",
  "chip",
  "checkbox",
  "radio",
  "switch",
  "togglebuttongroup",
  "toolbar",
  "statuslight",
  "link",
  "linkbutton",
  "breadcrumbs",
  // ADR-086 P5: Breadcrumb child — implicitStyles 의 width/height 주입이 제거되므로
  //   enrichWithIntrinsicSize 가 calculateContentWidth/Height 의 breadcrumb 분기로
  //   intrinsic 치수를 산출해야 Taffy 가 배치할 수 있다.
  "breadcrumb",
  "icon",
  "menu",
  "tab",
]);

/**
 * 텍스트만 포함하는 리프 태그 — 줄바꿈 시 높이가 width에 따라 동적으로 변함
 * enrichWithIntrinsicSize 2-pass에서 width 변경 시 높이 재계산 대상
 */
export const TEXT_LEAF_TAGS = new Set([
  "text",
  "heading",
  "description",
  "label",
  "paragraph",
  // ADR-058 Phase 3: 신설 Kbd/Code spec이 렌더하는 lowercase 시맨틱 태그
  "kbd",
  "code",
]);

/** intrinsic 크기 키워드 — height/width에서 enrichWithIntrinsicSize가 개입해야 하는 값 */
const INTRINSIC_SIZE_KEYWORDS = new Set([
  "fit-content",
  "min-content",
  "max-content",
  "auto",
]);

/** replaced element 태그 — 자연 치수(natural size)를 가져야 하는 요소 */
const IMAGE_INTRINSIC_TAGS = new Set(["image", "avatar", "logo", "thumbnail"]);

/** spec shapes 기반 입력 컴포넌트 — contentHeight=0이어도 height 주입이 필요한 태그 */
const SPEC_SHAPES_INPUT_TAGS = new Set([
  "dropdown",
  "breadcrumbs",
  // ADR-086 P5: Breadcrumb child — spec.render shapes 로 label/separator 렌더,
  //   childElements 없이도 height 주입 필요 (breadcrumbsHeight).
  "breadcrumb",
  // ProgressBar/Meter/ProgressCircle: spec shapes가 렌더링, height 미설정 시 0이 됨
  "progressbar",
  "progress",
  "loadingbar",
  "progresscircle",
  "meter",
  "gauge",
  // ADR-076 P6+: items SSOT 로 자식 Element 소멸 → calculateContentHeight 가
  // items.length × itemH + gap 으로 intrinsic 산출. childElements=0 이어도 주입 필요.
  "listbox",
  // ADR-097 Phase 4A/4B: TagList 도 items SSOT (chip self-render) — row-wrap 기반
  //   intrinsic 높이를 calculateContentHeight(taglist 분기) 가 산출. childElements=0
  //   이어도 wrap 행 수에 따른 height 주입이 필수 (2+ row 에서 chip clip 방지).
  "taglist",
]);

/**
 * 리프 UI 컴포넌트에 intrinsic size(width/height)를 주입
 *
 * 레이아웃 엔진(Dropflow/Taffy)은 자식이 없는 블록의 height를 0으로 collapse하고,
 * block 요소의 width를 부모 100%로 확장한다.
 *
 * Button, Badge 등은 텍스트/인디케이터가 props에만 있어
 * 엔진이 콘텐츠 크기를 계산할 수 없다.
 *
 * parseBoxModel()의 contentWidth/contentHeight + spec padding/border를
 * 사용하여 border-box 크기를 CSS width/height로 주입한다.
 *
 * @param computedStyle - 상속 적용 후 해당 요소의 computed style (fontSize 등 활용)
 */
export function enrichWithIntrinsicSize(
  element: Element,
  availableWidth: number,
  availableHeight: number,
  _computedStyle?: ComputedStyle,
  childElements?: Element[],
  getChildElements?: (id: string) => Element[],
  isFlexChild?: boolean,
): Element {
  const style = element.props?.style as Record<string, unknown> | undefined;
  const type = (element.type ?? "").toLowerCase();

  // DC-6: overflow cap — height/width: auto + overflow != visible 조합에서
  // 자식 합산이 availableHeight/Width를 초과하지 않도록 제한
  const overflow = (style?.overflow as string) ?? "visible";
  const isOverflowClipped = overflow !== "visible";

  const rawHeight = style?.height;
  const needsHeight =
    !rawHeight || INTRINSIC_SIZE_KEYWORDS.has(rawHeight as string);

  const rawWidth = style?.width;
  // C1: 모든 요소에서 intrinsic width keyword(fit-content/min-content/max-content) 처리
  // INLINE_BLOCK 태그의 width:auto 자동 주입은 기존 동작 유지
  const hasExplicitIntrinsicWidthKeyword =
    typeof rawWidth === "string" &&
    rawWidth !== "auto" &&
    INTRINSIC_SIZE_KEYWORDS.has(rawWidth);
  // Flex 자식인 TEXT_LEAF_TAGS(Label, Description 등)도 intrinsic width 필요:
  // Block layout에서는 자동 stretch되지만, Flex layout에서는 Taffy가 content size를
  // 알 수 없어 width=0으로 처리함 (Checkbox/Radio/Switch 내부 Label 세로 출력 버그)
  // Image: replaced element — auto/fit-content 시 자연 치수 사용 필요
  const needsWidth =
    hasExplicitIntrinsicWidthKeyword ||
    (INLINE_BLOCK_TAGS.has(type) &&
      (!rawWidth || INTRINSIC_SIZE_KEYWORDS.has(rawWidth as string))) ||
    (isFlexChild &&
      TEXT_LEAF_TAGS.has(type) &&
      (!rawWidth || INTRINSIC_SIZE_KEYWORDS.has(rawWidth as string))) ||
    (IMAGE_INTRINSIC_TAGS.has(type) &&
      typeof rawWidth === "string" &&
      INTRINSIC_SIZE_KEYWORDS.has(rawWidth));

  if (!needsHeight && !needsWidth) return element;

  const box = parseBoxModel(element, availableWidth, availableHeight);

  // min-content / max-content 너비 직접 계산
  let resolvedIntrinsicWidth: number | undefined;
  if (
    needsWidth &&
    (rawWidth === "min-content" || rawWidth === "max-content")
  ) {
    const props = element.props as Record<string, unknown> | undefined;
    const textContent = String(
      props?.children ?? props?.text ?? props?.label ?? props?.title ?? "",
    );
    if (textContent) {
      const styleRecord = style as Record<string, unknown> | undefined;
      // ADR-058 Phase 1: Text가 Spec 경로로 전환되면서 5-point patch 분기 제거.
      const fontSize =
        typeof styleRecord?.fontSize === "number"
          ? styleRecord.fontSize
          : (_computedStyle?.fontSize ?? 16);
      resolvedIntrinsicWidth =
        rawWidth === "min-content"
          ? calculateMinContentWidth(textContent, fontSize)
          : calculateMaxContentWidth(textContent, fontSize);
    }
  }

  // contentHeight <= 0이면 컨테이너 요소 (div, section 등) — 스킵
  // 단, ComboBox/Select 등 spec shapes 기반 입력 컴포넌트는 예외:
  // flex container 스타일(flexDirection: column)로 parseBoxModel이 contentHeight=0을 반환하지만,
  // calculateContentHeight에서 spec size 기반 높이를 산출하므로 height 주입이 필요함
  // 또한, childElements가 있는 컨테이너(CardHeader/CardContent 등)도 예외:
  // 자체 텍스트는 없지만 자식 요소의 높이를 합산해야 하므로 calculateContentHeight가 필요함
  // Select: Compositional Architecture — Card와 동일하게 자식 기반 높이 + padding 경로
  // INLINE_BLOCK_TAGS(button, badge 등)은 명시적 고정 width가 있을 때 needsWidth=false가 되어
  // 이 early return에 걸리지만, 텍스트 줄바꿈 시 높이 재계산이 필요하므로 반드시 예외 처리해야 함.
  if (
    box.contentHeight <= 0 &&
    !needsWidth &&
    !SPEC_SHAPES_INPUT_TAGS.has(type) &&
    !INLINE_BLOCK_TAGS.has(type) &&
    !IMAGE_INTRINSIC_TAGS.has(type) &&
    !(childElements && childElements.length > 0)
  ) {
    return element;
  }

  // 항상 border-box 값을 주입:
  // 웹 CSS의 * { box-sizing: border-box } 동작과 일치
  // content 크기 + padding + border = border-box 크기
  // Dropflow: border-box 네이티브 지원 (adapter에서 boxSizing: 'border-box' 고정)
  // Taffy 0.9: style.size를 border-box로 처리 → 변환 불필요

  const injectedStyle: Record<string, unknown> = { ...style };

  // Height 주입
  // childElements가 있으면 재계산 (CheckboxGroup 등 자식 기반 높이 필요)
  // Image: 자식은 없지만 자연 치수가 필요하므로 calculateContentHeight 호출
  const childResolvedHeight =
    childElements && childElements.length > 0
      ? calculateContentHeight(
          element,
          availableWidth,
          childElements,
          getChildElements,
          _computedStyle,
        )
      : IMAGE_INTRINSIC_TAGS.has(type) ||
          SPEC_SHAPES_INPUT_TAGS.has(type) ||
          INLINE_BLOCK_TAGS.has(type) ||
          TEXT_LEAF_TAGS.has(type)
        ? calculateContentHeight(
            element,
            // INLINE_BLOCK 태그에 명시적 고정 너비(px)가 있으면 자신의 border-box 너비로
            // 텍스트 줄바꿈을 계산해야 함. 부모의 availableWidth를 사용하면 버튼 크기를
            // 초과한 너비로 측정되어 줄바꿈이 발생하지 않고 높이가 늘어나지 않는 버그 발생.
            INLINE_BLOCK_TAGS.has(type) &&
              (parseNumericValue(rawWidth) ?? 0) > 0
              ? (parseNumericValue(rawWidth) as number)
              : availableWidth,
            undefined,
            getChildElements,
            _computedStyle,
          )
        : box.contentHeight;
  if (needsHeight && childResolvedHeight > 0) {
    let injectHeight = childResolvedHeight;
    // ComboBox/Select: calculateContentHeight가 전체 시각적 높이(label+input/trigger)를 반환
    // spec shapes가 내부 padding 없이 렌더링하므로 추가 padding/border 불필요
    const isSpecShapesInput = SPEC_SHAPES_INPUT_TAGS.has(type);
    if (!isSpecShapesInput) {
      // BUTTON_LIKE_BOX_TAGS(button 등): inline padding이 설정된 경우
      // applyCommonTaffyStyle은 parsePadding(style)로 inline 값을 Taffy에 전달하지만,
      // box.padding은 parseBoxModel 내부 sizeConfig 로직으로 spec 값을 반환할 수 있다.
      // 이 불일치로 인해 injectHeight(spec 기반)와 Taffy padding(inline)이 달라져
      // content area가 좁아지고 텍스트가 잘리는 버그 발생.
      // 따라서 inline padding이 설정된 경우 parsePadding(style)을 직접 사용하여
      // applyCommonTaffyStyle이 Taffy에 전달하는 값과 동일한 패딩으로 injectHeight 계산.
      if (BUTTON_LIKE_BOX_TAGS.has(type)) {
        const hasInlinePad =
          style?.padding !== undefined ||
          style?.paddingTop !== undefined ||
          style?.paddingRight !== undefined ||
          style?.paddingBottom !== undefined ||
          style?.paddingLeft !== undefined;
        const effectivePad = hasInlinePad
          ? parsePadding(style, availableWidth)
          : box.padding;
        injectHeight += effectivePad.top + effectivePad.bottom;
      } else {
        injectHeight += box.padding.top + box.padding.bottom;
      }
      injectHeight += box.border.top + box.border.bottom;
    }
    // DC-6: overflow cap — availableHeight가 있고 overflow가 클리핑되면 초과분 제한
    if (
      isOverflowClipped &&
      availableHeight > 0 &&
      injectHeight > availableHeight
    ) {
      injectHeight = availableHeight;
    }
    injectedStyle.height = injectHeight;
  }

  // Width 주입 (inline-block 태그의 fit-content / min-content / max-content 에뮬레이션)
  // childElements가 있으면 재계산 (ToggleButtonGroup 등 자식이 Element로 저장된 경우)
  // childElements가 없어도 INLINE_BLOCK_TAGS(Tag, Badge 등)는 텍스트 기반 너비 계산 필요:
  // box.contentWidth는 availableWidth 기반이므로 fit-content 시 부모 전체 너비를 차지하는 버그 발생
  const childResolvedWidth =
    childElements && childElements.length > 0
      ? calculateContentWidth(
          element,
          childElements,
          getChildElements,
          _computedStyle,
        )
      : INLINE_BLOCK_TAGS.has(type) || hasExplicitIntrinsicWidthKeyword
        ? calculateContentWidth(
            element,
            undefined,
            getChildElements,
            _computedStyle,
          )
        : box.contentWidth;
  const baseContentWidth = resolvedIntrinsicWidth ?? childResolvedWidth;
  if (needsWidth && baseContentWidth > 0) {
    let injectWidth = baseContentWidth;
    injectWidth += box.padding.left + box.padding.right;
    injectWidth += box.border.left + box.border.right;
    // DC-6: overflow cap — availableWidth가 있고 overflow가 클리핑되면 초과분 제한
    if (
      isOverflowClipped &&
      availableWidth > 0 &&
      injectWidth > availableWidth
    ) {
      injectWidth = availableWidth;
    }
    // Math.ceil: Taffy(f32)와 JS(f64) 간 부동소수점 정밀도 차이로
    // flex-wrap 컨테이너에서 자식 합계가 부모 폭을 미세하게 초과하여
    // 불필요한 wrap이 발생하는 것을 방지
    const ceiledWidth = Math.ceil(injectWidth);
    injectedStyle.width = ceiledWidth;
    // CSS min-width:auto 에뮬레이션: flex item의 기본 min-width는 콘텐츠 크기
    // width를 주입하면 Taffy가 flex-shrink로 축소할 수 있으므로 minWidth도 동시 설정
    // 사용자가 명시적 minWidth를 설정한 경우는 보존
    if (isFlexChild && !style?.minWidth) {
      injectedStyle.minWidth = ceiledWidth;
    }
  }

  // 변경이 없으면 원본 반환
  if (
    injectedStyle.height === undefined &&
    injectedStyle.width === style?.width
  ) {
    return element;
  }

  return {
    ...element,
    props: {
      ...element.props,
      style: injectedStyle,
    },
  } as Element;
}

/**
 * vertical-align 값 파싱
 *
 * 지원 값: baseline (기본), top, bottom, middle
 * text-top, text-bottom, super, sub 등은 폰트 메트릭이 필요하여 baseline으로 폴백
 */
export function parseVerticalAlign(
  style: Record<string, unknown> | undefined,
): VerticalAlign {
  if (!style) return "baseline";

  const value = style.verticalAlign as string | undefined;
  if (!value) return "baseline";

  switch (value) {
    case "top":
      return "top";
    case "bottom":
      return "bottom";
    case "middle":
      return "middle";
    case "baseline":
    case "text-top":
    case "text-bottom":
    case "super":
    case "sub":
    default:
      // text-top/text-bottom/super/sub은 폰트 메트릭이 필요하여 baseline으로 폴백
      return "baseline";
  }
}

/**
 * line-height 값 파싱
 *
 * @returns line-height 픽셀 값 또는 undefined (normal)
 *
 * 지원 값:
 * - number (예: 1.5) → fontSize * number
 * - px (예: 24px) → 24
 * - normal → undefined (브라우저 기본값, 보통 1.2 정도)
 */
export function parseLineHeight(
  style: Record<string, unknown> | undefined,
  fontSize?: number,
): number | undefined {
  if (!style) return undefined;

  const value = style.lineHeight;
  if (value === undefined || value === "normal") return undefined;

  // 숫자 (배율)
  if (typeof value === "number") {
    const baseFontSize = fontSize ?? 16; // 기본 폰트 크기
    return value * baseFontSize;
  }

  // 문자열
  if (typeof value === "string") {
    const trimmed = value.trim();

    // px 값 (명시적으로 'px'가 있는 경우만)
    if (trimmed.endsWith("px")) {
      return parseFloat(trimmed);
    }

    // 숫자만 (배율) - CSS에서 line-height 숫자는 배율
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      const baseFontSize = fontSize ?? 16;
      return num * baseFontSize;
    }
  }

  return undefined;
}

/**
 * inline-block 요소의 baseline 위치 계산
 *
 * CSS 명세 (Chrome 구현):
 * - 일반적인 경우: 마지막 줄 텍스트의 baseline
 * - overflow: hidden/auto/scroll → margin-box 하단
 * - 콘텐츠 없음 → margin-box 하단
 *
 * @param element - 대상 요소
 * @param height - 요소 높이 (margin 제외)
 * @returns baseline 위치 (요소 상단 기준 오프셋)
 *
 * @example
 * // 높이 100px, baseline이 하단에서 20px 위
 * calculateBaseline(element, 100) // → 80 (상단에서 80px 아래)
 */
// 🚀 텍스트가 수직 중앙 정렬되는 요소 (CSS baseline ≈ height/2)
// CSS에서 button/input/badge 등은 내부 텍스트가 수직 중앙 정렬되므로
// baseline이 요소의 수직 중앙 근처에 위치
const VERTICALLY_CENTERED_TAGS = new Set([
  "button",
  "submitbutton",
  "fancybutton",
  "togglebutton",
  "input",
  "select",
  "badge",
  "type",
  "chip", // inline-flex 컴포넌트
]);

/**
 * 스타일에서 폰트 속성을 개별값으로 파싱
 *
 * measureFontMetrics()에 전달할 개별 폰트 속성 값을 추출합니다.
 * 기존 buildFontSpec()을 대체하여 구조화된 값으로 반환합니다.
 * 이를 통해 캐시 키 생성과 메트릭 측정을 효율적으로 수행합니다.
 */
interface ParsedFontProps {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
}

function parseFontProps(
  style: Record<string, unknown> | undefined,
): ParsedFontProps {
  if (!style) {
    return { fontFamily: "sans-serif", fontSize: 16, fontWeight: 400 };
  }

  const sizeProp = style.fontSize;
  const familyProp = style.fontFamily;
  const weightProp = style.fontWeight;

  // fontSize 파싱
  let fontSize = 16;
  if (typeof sizeProp === "number") {
    fontSize = sizeProp;
  } else if (typeof sizeProp === "string" && sizeProp.trim()) {
    const parsed = parseFloat(sizeProp.trim());
    if (!isNaN(parsed)) fontSize = parsed;
  }

  // fontFamily 파싱
  let fontFamily = "sans-serif";
  if (typeof familyProp === "string" && familyProp.trim()) {
    fontFamily = familyProp.trim();
  }

  // fontWeight 파싱
  let fontWeight: string | number = 400;
  if (typeof weightProp === "number") {
    fontWeight = weightProp;
  } else if (typeof weightProp === "string" && weightProp.trim()) {
    fontWeight = weightProp.trim();
  }

  return { fontFamily, fontSize, fontWeight };
}

/**
 * 스타일에서 FontMetrics를 조회 (캐싱 포함)
 *
 * textMeasure.ts의 measureFontMetrics()에 위임하여
 * Canvas 2D TextMetrics 기반 정밀 ascent/descent를 반환합니다.
 *
 * 기존 measureAlphabeticAscent() + measureAlphabeticDescent()를 통합 교체:
 *
 * [Before] 매 호출마다 document.createElement('canvas') 생성:
 *   - measureAlphabeticAscent(fontSpec) → 새 Canvas 생성 → ascent | null
 *   - measureAlphabeticDescent(fontSpec) → 새 Canvas 생성 → descent | null
 *   - 2번 호출 시 Canvas 4개 생성 (ascent + descent 각각)
 *
 * [After] 싱글톤 context + Map 캐시로 O(1) 조회:
 *   - getFontMetricsFromStyle(style) → { ascent, descent, fontHeight }
 *   - 캐시 히트 시 Canvas context 접근 없음
 *   - SSR 환경에서도 fontSize 기반 근사값 자동 반환 (null 대신)
 */
function getFontMetricsFromStyle(
  style: Record<string, unknown> | undefined,
): FontMetrics {
  const { fontFamily, fontSize, fontWeight } = parseFontProps(style);
  return measureFontMetrics(fontFamily, fontSize, fontWeight);
}

/**
 * inline-block 요소의 baseline 위치 계산
 *
 * CSS 명세 (Chrome 구현):
 * - 일반적인 경우: 마지막 줄 텍스트의 baseline
 * - overflow: hidden/auto/scroll → margin-box 하단
 * - 콘텐츠 없음 → margin-box 하단
 *
 * Wave 3 정밀화: measureFontMetrics()의 캐싱된 ascent/descent를 활용하여
 * 폰트 메트릭 기반 정밀 계산을 수행합니다.
 * 기존 measureAlphabeticAscent()/measureAlphabeticDescent()의 매 호출
 * Canvas 생성 문제를 해결하고, SSR 환경에서도 근사값을 안정적으로 제공합니다.
 *
 * @param element - 대상 요소
 * @param height - 요소 높이 (margin 제외)
 * @returns baseline 위치 (요소 상단 기준 오프셋)
 *
 * @example
 * // 높이 100px, baseline이 하단에서 20px 위
 * calculateBaseline(element, 100) // → 80 (상단에서 80px 아래)
 */
export function calculateBaseline(element: Element, height: number): number {
  const style = element.props?.style as Record<string, unknown> | undefined;
  const type = (element.type ?? "").toLowerCase();

  // overflow가 visible이 아니면 하단이 baseline
  const overflow = style?.overflow as string | undefined;
  const overflowX = style?.overflowX as string | undefined;
  const overflowY = style?.overflowY as string | undefined;

  if (
    (overflow && overflow !== "visible") ||
    (overflowX && overflowX !== "visible") ||
    (overflowY && overflowY !== "visible")
  ) {
    return height; // 하단
  }

  // 콘텐츠가 없으면 하단이 baseline
  // 높이가 0이면 콘텐츠 없음으로 간주
  if (height === 0) {
    return 0;
  }

  // 폰트 메트릭 조회 (캐싱됨, SSR-safe — 근사값 자동 반환)
  const fm = getFontMetricsFromStyle(style);

  // 버튼/input 등 텍스트 수직 중앙 정렬 요소
  // CSS에서 이 요소들의 baseline은 수직 중앙의 텍스트 baseline
  if (VERTICALLY_CENTERED_TAGS.has(type)) {
    // baseline = (height - effectiveLineHeight) / 2 + ascent
    const lineHeight = parseLineHeight(style);
    const effectiveLineHeight = lineHeight ?? height;

    // 텍스트 블록은 요소 수직 중앙에 위치:
    //   텍스트 블록 상단 = (height - effectiveLineHeight) / 2
    const textBlockTop = (height - effectiveLineHeight) / 2;
    return textBlockTop + fm.ascent;
  }

  // 일반적인 경우: 폰트 메트릭 기반 baseline 계산
  const lineHeight = parseLineHeight(style);

  if (lineHeight !== undefined && lineHeight <= height) {
    // line-height가 있으면 half-leading 모델로 정밀 계산
    // CSS half-leading: (lineHeight - fontHeight) / 2
    // baseline from line box top = half-leading + ascent
    const halfLeading = (lineHeight - fm.fontHeight) / 2;

    if (height <= lineHeight * 1.5) {
      // 단일 줄로 간주
      return Math.max(halfLeading + fm.ascent, 0);
    } else {
      // 여러 줄: 마지막 줄 baseline
      return height - lineHeight + halfLeading + fm.ascent;
    }
  }

  // line-height 없음: 요소 높이를 단일 line box로 간주
  // ascent가 곧 baseline 위치
  return fm.ascent;
}

// ============================================
// white-space 기반 텍스트 측정
// ============================================

/**
 * white-space CSS 속성에 따른 텍스트 크기 측정
 *
 * - normal: 공백 축소 + 자동 줄바꿈 (기본 동작)
 * - nowrap: 공백 축소 + 줄바꿈 없이 한 줄
 * - pre: 공백 보존 + \n만 줄바꿈, 자동 줄바꿈 없음
 * - pre-wrap: 공백 보존 + \n + 자동 줄바꿈
 * - pre-line: 공백 축소 + \n + 자동 줄바꿈
 */
export function measureTextWithWhiteSpace(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  whiteSpace: string,
  maxWidth: number,
  wordBreak?: string,
  overflowWrap?: string,
  lineHeightOverride?: number,
): { width: number; height: number } {
  // CSS line-height: normal 근사값 (fontBoundingBox 기반)
  // lineHeightOverride가 있으면 spec/config 기반 lineHeight 우선 사용
  const fm = measureFontMetrics(fontFamily, fontSize, fontWeight);
  const lineHeight = lineHeightOverride ?? fm.lineHeight;

  // ADR-008: word-break/overflow-wrap 타입 캐스팅
  const wb = wordBreak as "normal" | "break-all" | "keep-all" | undefined;
  const ow = overflowWrap as "normal" | "break-word" | "anywhere" | undefined;

  switch (whiteSpace) {
    case "nowrap": {
      // 줄바꿈 없이 한 줄
      const width = measureTextWidth(text, fontSize, fontFamily, fontWeight);
      return { width, height: lineHeight };
    }
    case "pre": {
      // \n만 줄바꿈, 자동 줄바꿈 없음
      const lines = text.split("\n");
      let maxLineWidth = 0;
      for (const line of lines) {
        const w = measureTextWidth(line, fontSize, fontFamily, fontWeight);
        if (w > maxLineWidth) maxLineWidth = w;
      }
      return { width: maxLineWidth, height: lines.length * lineHeight };
    }
    case "pre-wrap":
    case "pre-line": {
      // \n + 자동 줄바꿈 (pre-line은 공백 축소)
      const processedText =
        whiteSpace === "pre-line" ? text.replace(/[ \t]+/g, " ") : text;
      return {
        width: maxWidth,
        height: measureWrappedTextHeight(
          processedText,
          fontSize,
          fontWeight,
          fontFamily,
          maxWidth,
          lineHeightOverride,
          wb,
          ow,
        ),
      };
    }
    default: {
      // normal: 기본 동작
      return {
        width: maxWidth,
        height: measureWrappedTextHeight(
          text,
          fontSize,
          fontWeight,
          fontFamily,
          maxWidth,
          lineHeightOverride,
          wb,
          ow,
        ),
      };
    }
  }
}

// ============================================
// min-content / max-content 텍스트 너비 측정
// ============================================

/**
 * min-content 너비 계산
 *
 * CSS min-content: 가장 긴 단어(줄바꿈 불가능한 최소 단위)의 너비.
 * 텍스트를 단어 단위로 분리하여 가장 긴 단어의 렌더링 너비를 반환한다.
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리
 * @param fontWeight - 폰트 두께
 * @returns 가장 긴 단어의 px 너비
 */
export function calculateMinContentWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
): number {
  if (!text) return 0;

  // 공백/줄바꿈/탭으로 단어 분리
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let maxWordWidth = 0;
  for (const word of words) {
    const width = measureTextWidth(word, fontSize, fontFamily, fontWeight);
    if (width > maxWordWidth) {
      maxWordWidth = width;
    }
  }

  return Math.ceil(maxWordWidth);
}

/**
 * max-content 너비 계산
 *
 * CSS max-content: 줄바꿈 없이 한 줄로 렌더링했을 때의 전체 너비.
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리
 * @param fontWeight - 폰트 두께
 * @returns 전체 텍스트의 한 줄 px 너비
 */
export function calculateMaxContentWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
): number {
  if (!text) return 0;

  return Math.ceil(measureTextWidth(text, fontSize, fontFamily, fontWeight));
}

// ─── Taffy 엔진 공용 유틸리티 ─────────────────────────────────────────

/**
 * RC-3: CSS prop → number | string 파서 (단위 정규화 적용)
 *
 * rem, em, vh, vw, calc() 등을 resolveCSSSizeValue()로 해석.
 * % 값은 Taffy 네이티브 % 처리를 위해 문자열 그대로 반환.
 *
 * TaffyFlexEngine, TaffyGridEngine 공용
 */
export function parseCSSPropWithContext(
  value: unknown,
  ctx: CSSValueContext = {},
): number | string | undefined {
  if (value === undefined || value === null || value === "" || value === "auto")
    return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // % 값은 Taffy가 네이티브로 처리
    if (value.endsWith("%")) return value;
    // intrinsic sizing 키워드는 Taffy에서 미지원 → undefined
    if (
      value === "fit-content" ||
      value === "min-content" ||
      value === "max-content"
    )
      return undefined;
    // resolveCSSSizeValue: rem, em, vh, vw, calc(), clamp(), min(), max() 해석
    const px = resolveCSSSizeValue(value, ctx);
    if (px !== undefined && px >= 0) return px;
    // fallback: parseFloat (순수 숫자 문자열)
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  return undefined;
}

/**
 * Taffy 공통 스타일 적용: Size + Min/Max + Padding + Border + Gap
 *
 * TaffyFlexEngine과 TaffyGridEngine 양쪽에서 동일한 Box model + Gap 변환을
 * 중복 없이 적용하기 위한 헬퍼.
 *
 * Position, Margin(auto), Inset은 엔진별 차이가 있으므로 포함하지 않음.
 */
export function applyCommonTaffyStyle(
  result: Record<string, unknown>,
  style: Record<string, unknown>,
  ctx: CSSValueContext,
): void {
  // Size — parseCSSPropWithContext가 number|string|undefined 반환
  // normalizeStyle.dimToString()이 JSON 직렬화 시 number → "Npx" 변환
  const widthVal = parseCSSPropWithContext(style.width, ctx);
  const heightVal = parseCSSPropWithContext(style.height, ctx);
  if (widthVal !== undefined) result.width = widthVal;
  if (heightVal !== undefined) result.height = heightVal;

  // Min/Max size
  const minW = parseCSSPropWithContext(style.minWidth, ctx);
  const minH = parseCSSPropWithContext(style.minHeight, ctx);
  const maxW = parseCSSPropWithContext(style.maxWidth, ctx);
  const maxH = parseCSSPropWithContext(style.maxHeight, ctx);
  if (minW !== undefined) result.minWidth = minW;
  if (minH !== undefined) result.minHeight = minH;
  if (maxW !== undefined) result.maxWidth = maxW;
  if (maxH !== undefined) result.maxHeight = maxH;

  // Padding — 숫자 직접 전달
  const padding = parsePadding(style);
  if (padding.top !== 0) result.paddingTop = padding.top;
  if (padding.right !== 0) result.paddingRight = padding.right;
  if (padding.bottom !== 0) result.paddingBottom = padding.bottom;
  if (padding.left !== 0) result.paddingLeft = padding.left;

  // Border — 숫자 직접 전달
  const border = parseBorder(style);
  if (border.top !== 0) result.borderTop = border.top;
  if (border.right !== 0) result.borderRight = border.right;
  if (border.bottom !== 0) result.borderBottom = border.bottom;
  if (border.left !== 0) result.borderLeft = border.left;

  // Taffy 0.9는 style.size를 border-box로 처리합니다.
  // composition의 * { box-sizing: border-box } 값을 그대로 전달하면
  // Taffy가 내부적으로 content = size - padding - border를 계산합니다.
  // layout.size도 border-box를 반환하므로 추가 변환 불필요.

  // Gap — parseCSSPropWithContext 결과 직접 전달 (number 또는 % 문자열)
  const gap = parseCSSPropWithContext(style.gap, ctx);
  const rowGap = parseCSSPropWithContext(style.rowGap, ctx);
  const columnGap = parseCSSPropWithContext(style.columnGap, ctx);
  if (gap !== undefined) {
    result.rowGap = gap;
    result.columnGap = gap;
  }
  if (rowGap !== undefined) result.rowGap = rowGap;
  if (columnGap !== undefined) result.columnGap = columnGap;

  // Overflow — Taffy가 scroll/hidden 컨테이너의 크기 계산에 사용
  if (style.overflow) {
    result.overflowX = style.overflow;
    result.overflowY = style.overflow;
  }
  if (style.overflowX) result.overflowX = style.overflowX;
  if (style.overflowY) result.overflowY = style.overflowY;

  // Aspect ratio — CSS 형식("16 / 9")을 숫자로 변환
  if (
    style.aspectRatio !== undefined &&
    style.aspectRatio !== "" &&
    style.aspectRatio !== "reset"
  ) {
    const ratio = parseAspectRatio(style.aspectRatio);
    if (ratio !== undefined && ratio > 0) {
      result.aspectRatio = ratio;
      const rawHeight = style.height;
      const rawWidth = style.width;

      if (
        shouldSetAutoHeightForAspectRatio(rawWidth, rawHeight, result.height)
      ) {
        result.height = "auto";
      }
    }
  }
}

/**
 * CSS flex item 속성을 Taffy 스타일에 적용.
 *
 * CSS 명세: flex/grid 부모의 모든 자식은 자신의 display와 무관하게
 * flex/grid item으로 참여한다. 자식의 display는 내부 formatting context만 결정.
 *
 * TaffyFlexEngine.elementToTaffyStyle()의 flex item 파싱 로직(L147-201)과
 * 동일한 규칙을 적용하여, block/grid 경로에서도 재사용 가능하게 한다.
 *
 * @param result - 스타일 결과 객체 (in-place 수정)
 * @param style  - 요소의 원본 CSS 스타일
 * @param ctx    - CSS 값 파싱 컨텍스트
 */
export function applyFlexItemProperties(
  result: Record<string, unknown>,
  style: Record<string, unknown>,
  ctx: CSSValueContext = {},
): void {
  // flex shorthand → flexGrow/flexShrink/flexBasis 분해
  // result에 이미 값이 있으면(taffyConfig 패스스루 등) shorthand로 덮어쓰지 않음
  if (style.flex !== undefined && style.flex !== null) {
    const flexVal = style.flex;
    if (typeof flexVal === "number") {
      // flex: 1 → flexGrow: 1, flexShrink: 1, flexBasis: 0%
      if (style.flexGrow === undefined && result.flexGrow === undefined)
        result.flexGrow = flexVal;
      if (style.flexShrink === undefined && result.flexShrink === undefined)
        result.flexShrink = 1;
      if (style.flexBasis === undefined && result.flexBasis === undefined)
        result.flexBasis = "0%";
    } else if (typeof flexVal === "string") {
      const parts = String(flexVal).trim().split(/\s+/);
      if (parts.length === 1) {
        const n = Number(parts[0]);
        if (!isNaN(n)) {
          if (style.flexGrow === undefined && result.flexGrow === undefined)
            result.flexGrow = n;
          if (style.flexShrink === undefined && result.flexShrink === undefined)
            result.flexShrink = 1;
          if (style.flexBasis === undefined && result.flexBasis === undefined)
            result.flexBasis = "0%";
        } else if (parts[0] === "auto") {
          if (style.flexGrow === undefined && result.flexGrow === undefined)
            result.flexGrow = 1;
          if (style.flexShrink === undefined && result.flexShrink === undefined)
            result.flexShrink = 1;
        } else if (parts[0] === "none") {
          if (style.flexGrow === undefined && result.flexGrow === undefined)
            result.flexGrow = 0;
          if (style.flexShrink === undefined && result.flexShrink === undefined)
            result.flexShrink = 0;
        }
      } else if (parts.length >= 2) {
        if (style.flexGrow === undefined && result.flexGrow === undefined)
          result.flexGrow = Number(parts[0]) || 0;
        if (style.flexShrink === undefined && result.flexShrink === undefined)
          result.flexShrink = Number(parts[1]) || 0;
        if (
          parts[2] &&
          style.flexBasis === undefined &&
          result.flexBasis === undefined
        ) {
          const basisVal = parseCSSPropWithContext(parts[2], ctx);
          if (basisVal !== undefined) result.flexBasis = basisVal;
        } else if (
          !parts[2] &&
          style.flexBasis === undefined &&
          result.flexBasis === undefined
        ) {
          result.flexBasis = "0%";
        }
      }
    }
  }

  // 개별 속성은 shorthand/taffyConfig 모두를 덮어씀 (CSS 우선순위)
  if (style.flexGrow !== undefined) result.flexGrow = Number(style.flexGrow);
  if (style.flexShrink !== undefined)
    result.flexShrink = Number(style.flexShrink);
  if (style.flexBasis !== undefined) {
    const basis = parseCSSPropWithContext(style.flexBasis, ctx);
    if (basis !== undefined) result.flexBasis = basis;
  }

  // order (flex/grid item 공통)
  if (style.order !== undefined) {
    const order = parseInt(String(style.order), 10);
    if (!isNaN(order) && order !== 0) result.order = order;
  }
}

/**
 * Taffy 엔진 공통 CSS 컨텍스트 구성
 *
 * 부모 요소의 computed style과 CSS 단위 해석용 컨텍스트를 생성.
 * TaffyFlexEngine.calculate()와 TaffyGridEngine.calculate()에서 동일.
 */
export function resolveParentContext(
  parent: Element,
  context?: LayoutContext,
): { parentComputed: ComputedStyle; cssCtx: CSSValueContext } {
  const parentRawStyle = parent.props?.style as
    | Record<string, unknown>
    | undefined;
  const parentComputed =
    context?.parentComputedStyle ??
    resolveStyle(parentRawStyle, getRootComputedStyle());

  const cssCtx: CSSValueContext = {
    viewportWidth:
      context?.viewportWidth ??
      (typeof window !== "undefined" ? window.innerWidth : 1920),
    viewportHeight:
      context?.viewportHeight ??
      (typeof window !== "undefined" ? window.innerHeight : 1080),
    parentSize: parentComputed.fontSize,
    // ADR-056: rootFontSize는 themeConfigStore.baseTypography.fontSize 기반
    rootFontSize: getRootComputedStyle().fontSize,
  };

  return { parentComputed, cssCtx };
}
