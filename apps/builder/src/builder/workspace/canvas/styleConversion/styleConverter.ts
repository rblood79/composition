/**
 * Style Converter
 *
 * CSS Style → 렌더 속성(transform / fill / stroke / text) 변환.
 * 🚀 P7: StylePanel ↔ Canvas 스타일 동기화 확장
 * 🚀 Phase 22: colord 기반 색상 파싱 통합
 *
 * 반환 타입은 `Render*` 이며 실제 소비처는 Skia 렌더 경로다.
 *
 * @since 2025-12-11 Phase 10 B1.2
 * @updated 2025-12-13 P7.2-P7.6 - 타이포그래피 속성 확장
 * @updated 2025-12-20 Phase 22 - colord 색상 파싱
 */

import { cssColorToRgbNumber } from "../../../../utils/color";
import { colord, extend } from "colord";
import lchPlugin from "colord/plugins/lch";
import labPlugin from "colord/plugins/lab";

import type {
  BackdropFilterEffect,
  DropShadowEffect,
  EffectStyle,
} from "../skia/types";
import { resolveCSSSizeValue } from "../layout/engines/cssValueParser";
import type { CSSValueContext } from "../layout/engines/cssValueParser";
// ADR-056: rem 단위 rootFontSize를 baseTypography로부터 가져오기
import { getRootComputedStyle } from "../layout/engines/cssResolver";
import {
  resolveCurrentColor,
  preprocessStyle,
} from "../layout/engines/cssResolver";

extend([lchPlugin, labPlugin]);

// ============================================
// Types
// ============================================

export interface CSSStyle {
  left?: number | string;
  top?: number | string;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  borderRadius?: number | string;
  borderWidth?: number | string;
  borderTopWidth?: number | string;
  borderRightWidth?: number | string;
  borderBottomWidth?: number | string;
  borderLeftWidth?: number | string;
  borderColor?: string;
  borderStyle?: string;
  opacity?: number | string;
  color?: string;
  fontSize?: number | string;
  fontWeight?: string | number;
  fontFamily?: string;
  fontStyle?: string; // P7.2: italic, oblique
  fontVariant?: string;
  fontStretch?: string;
  textAlign?: string;
  lineHeight?: number | string; // P7.4: 줄 간격
  letterSpacing?: number | string; // P7.3: 자간
  textDecoration?: string; // P7.7: underline, line-through
  textTransform?: string; // P7.6: uppercase, lowercase
  verticalAlign?: string; // P7.5: top, middle, bottom
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  boxShadow?: string;
  overflow?: string;
  filter?: string;
  backdropFilter?: string;
  mixBlendMode?: string;
  // Text overflow & wrapping
  textOverflow?: string; // C-1: ellipsis, clip
  wordSpacing?: number | string; // C-2: word spacing
  textIndent?: number | string; // C-3: first-line indent
  whiteSpace?: string;
  wordBreak?: string;
  overflowWrap?: string; // C-4: break-word, anywhere
  // Text decoration extended
  textDecorationStyle?: string; // C-5: solid, dashed, dotted, wavy, double
  textDecorationColor?: string; // C-6: decoration color
  // Layout properties
  display?: string;
  flexDirection?: string;
  flexWrap?: string;
  flexGrow?: number | string;
  flexShrink?: number | string;
  flexBasis?: string;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  alignSelf?: string;
  justifySelf?: string;
  gap?: number | string;
  // Visibility
  visibility?: "visible" | "hidden" | "collapse";
  // CSS Transform
  transform?: string;
  transformOrigin?: string;
  // Stacking
  zIndex?: number | string;
  // Interaction
  cursor?: string;
  pointerEvents?: string;
  // Background image positioning (Phase 4)
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  // CSS clip-path
  clipPath?: string;
}

export interface RenderTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface RenderFillStyle {
  color: number;
  alpha: number;
}

export interface RenderStrokeStyle {
  width: number;
  color: number;
  alpha: number;
}

export interface RenderTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic" | "oblique"; // P7.2
  fill: number;
  align: "left" | "center" | "right";
  letterSpacing: number; // P7.3
  leading: number; // P7.4: lineHeight → leading
  wordWrap: boolean;
  wordWrapWidth: number;
}

// ============================================
// Color Conversion
// ============================================

// -----------------------------------------------
// CSS Color Level 4: oklch / lab / lch / color()
// -----------------------------------------------

function gammaEncode(linear: number): number {
  if (linear <= 0.0031308) return 12.92 * linear;
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbToHexStr(r: number, g: number, b: number, alpha?: number): string {
  const hex = `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g).toString(16).padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`;
  if (alpha !== undefined && alpha < 1) {
    return (
      hex +
      clampByte(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    );
  }
  return hex;
}

function oklchToHex(L: number, C: number, H: number, alpha?: number): string {
  const hRad = H * (Math.PI / 180);
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linR = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return rgbToHexStr(
    gammaEncode(linR) * 255,
    gammaEncode(linG) * 255,
    gammaEncode(linB) * 255,
    alpha,
  );
}

function labToHex(L: number, a: number, b: number, alpha?: number): string {
  const input = alpha !== undefined ? { l: L, a, b, alpha } : { l: L, a, b };
  const c = colord(input);
  if (!c.isValid()) return "#000000";
  const rgb = c.toRgb();
  return rgbToHexStr(rgb.r, rgb.g, rgb.b, alpha);
}

function lchToHex(L: number, C: number, H: number, alpha?: number): string {
  const input =
    alpha !== undefined ? { l: L, c: C, h: H, alpha } : { l: L, c: C, h: H };
  const c = colord(input);
  if (!c.isValid()) return "#000000";
  const rgb = c.toRgb();
  return rgbToHexStr(rgb.r, rgb.g, rgb.b, alpha);
}

function colorFuncToHex(
  colorspace: string,
  r: number,
  g: number,
  b: number,
  alpha?: number,
): string {
  const cs = colorspace.toLowerCase();

  if (cs === "srgb") {
    return rgbToHexStr(r * 255, g * 255, b * 255, alpha);
  }

  if (cs === "display-p3") {
    // display-p3 → linear-sRGB (Bradford-adapted D65 → D65, IEC 61966-2-1)
    const linR = 0.4865709 * r + 0.2656677 * g + 0.1982173 * b;
    const linG = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b;
    const linB = 0.0 * r + 0.0451134 * g + 1.0439444 * b;
    return rgbToHexStr(
      gammaEncode(linR) * 255,
      gammaEncode(linG) * 255,
      gammaEncode(linB) * 255,
      alpha,
    );
  }

  // 미지원 색공간: sRGB 폴백
  return rgbToHexStr(r * 255, g * 255, b * 255, alpha);
}

/**
 * CSS Color Level 4 함수 인자 문자열에서 숫자 배열과 alpha를 파싱한다.
 *
 * "0.7 0.15 180 / 0.5" → { values: [0.7, 0.15, 180], alpha: 0.5 }
 * "50% 0.15 180"        → { values: [0.5, 0.15, 180], alpha: undefined }
 *
 * percentIndices: 해당 인덱스의 값이 %일 경우 적용할 변환 함수 (기본: /100)
 */
function parseColorFuncArgs(
  inner: string,
  percentScales: number[],
): { values: number[]; alpha: number | undefined } {
  const slashIdx = inner.lastIndexOf("/");
  let valuesPart = inner;
  let alpha: number | undefined;

  if (slashIdx !== -1) {
    valuesPart = inner.slice(0, slashIdx).trim();
    const alphaPart = inner.slice(slashIdx + 1).trim();
    if (alphaPart.endsWith("%")) {
      alpha = parseFloat(alphaPart) / 100;
    } else {
      alpha = parseFloat(alphaPart);
    }
    if (isNaN(alpha)) alpha = undefined;
  }

  const tokens = valuesPart
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const values = tokens.map((token, i) => {
    if (token.endsWith("%")) {
      const scale = percentScales[i] ?? 1;
      return (parseFloat(token) / 100) * scale;
    }
    return parseFloat(token);
  });

  return { values, alpha };
}

function parseOklch(color: string): string | null {
  const inner = color.slice(6, -1).trim();
  // oklch: L(0-1 or 0-100%), C(0-0.4 or 0-100%), H(0-360)
  const { values, alpha } = parseColorFuncArgs(inner, [1, 0.4, 360]);
  if (values.length < 3 || values.some(isNaN)) return null;
  return oklchToHex(values[0], values[1], values[2], alpha);
}

function parseLab(color: string): string | null {
  const inner = color.slice(4, -1).trim();
  // lab: L(0-100), a(-125..125), b(-125..125)
  const { values, alpha } = parseColorFuncArgs(inner, [100, 125, 125]);
  if (values.length < 3 || values.some(isNaN)) return null;
  return labToHex(values[0], values[1], values[2], alpha);
}

function parseLch(color: string): string | null {
  const inner = color.slice(4, -1).trim();
  // lch: L(0-100), C(0-150), H(0-360)
  const { values, alpha } = parseColorFuncArgs(inner, [100, 150, 360]);
  if (values.length < 3 || values.some(isNaN)) return null;
  return lchToHex(values[0], values[1], values[2], alpha);
}

function parseColorFunc(color: string): string | null {
  const inner = color.slice(6, -1).trim();
  const spaceEnd = inner.search(/\s/);
  if (spaceEnd === -1) return null;
  const colorspace = inner.slice(0, spaceEnd);
  const rest = inner.slice(spaceEnd + 1).trim();
  const { values, alpha } = parseColorFuncArgs(rest, [1, 1, 1]);
  if (values.length < 3 || values.some(isNaN)) return null;
  return colorFuncToHex(colorspace, values[0], values[1], values[2], alpha);
}

const COLOR_MIX_MAX_DEPTH = 5;

/**
 * color-mix() 내부 인자 문자열에서 색상과 퍼센트를 분리한다.
 *
 * "red 70%"  → { color: "red", pct: 70 }
 * "#ff0000"  → { color: "#ff0000", pct: null }
 */
function parseColorMixArg(arg: string): { color: string; pct: number | null } {
  const trimmed = arg.trim();
  const pctMatch = trimmed.match(/(\s+(\d+(?:\.\d+)?)%)\s*$/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[2]);
    const color = trimmed.slice(0, trimmed.length - pctMatch[1].length).trim();
    return { color, pct };
  }
  return { color: trimmed, pct: null };
}

/**
 * color-mix() 함수 내부 문자열을 최상위 쉼표 기준으로 분리한다.
 * 중첩 괄호 내부의 쉼표는 무시한다.
 */
function splitColorMixArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (ch === "," && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts;
}

/**
 * CSS color-mix() 함수를 해석하여 hex 색상 문자열을 반환한다.
 *
 * 지원 색 공간: srgb (oklch, hsl 등은 srgb 폴백)
 * 미지정 퍼센트: 50%/50% 기본값 또는 (100% - 명시된 쪽) 자동 계산
 * 재귀 지원: 최대 COLOR_MIX_MAX_DEPTH depth까지 중첩 color-mix() 처리
 *
 * @param value - "color-mix(in srgb, red 70%, blue)" 형식의 전체 문자열
 * @param depth - 재귀 깊이 (내부 전용)
 * @returns hex 색상 문자열 또는 null (파싱 실패 시)
 */
export function resolveColorMix(value: string, depth = 0): string | null {
  if (depth >= COLOR_MIX_MAX_DEPTH) return null;

  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("color-mix(")) return null;

  const innerStart = trimmed.indexOf("(");
  const innerEnd = trimmed.lastIndexOf(")");
  if (innerStart === -1 || innerEnd === -1 || innerEnd <= innerStart)
    return null;

  const inner = trimmed.slice(innerStart + 1, innerEnd);
  const parts = splitColorMixArgs(inner);

  if (parts.length < 3) return null;

  const arg1 = parseColorMixArg(parts[1]);
  const arg2 = parseColorMixArg(parts[2]);

  let p1: number;
  let p2: number;

  if (arg1.pct !== null && arg2.pct !== null) {
    p1 = arg1.pct / 100;
    p2 = arg2.pct / 100;
  } else if (arg1.pct !== null) {
    p1 = arg1.pct / 100;
    p2 = 1 - p1;
  } else if (arg2.pct !== null) {
    p2 = arg2.pct / 100;
    p1 = 1 - p2;
  } else {
    p1 = 0.5;
    p2 = 0.5;
  }

  const resolveArg = (raw: string): string => {
    if (raw.toLowerCase().startsWith("color-mix(")) {
      return resolveColorMix(raw, depth + 1) ?? raw;
    }
    return raw;
  };

  const color1Str = resolveArg(arg1.color);
  const color2Str = resolveArg(arg2.color);

  const c1 = colord(color1Str);
  const c2 = colord(color2Str);

  if (!c1.isValid() || !c2.isValid()) return null;

  const r1 = c1.toRgb();
  const r2 = c2.toRgb();

  const mixed = colord({
    r: Math.round(r1.r * p1 + r2.r * p2),
    g: Math.round(r1.g * p1 + r2.g * p2),
    b: Math.round(r1.b * p1 + r2.b * p2),
    a: r1.a * p1 + r2.a * p2,
  });

  return mixed.toHex();
}

/**
 * CSS 색상을 렌더용 숫자 색상으로 변환
 *
 * 🚀 Phase 22: colord 기반으로 리팩토링
 * - 모든 CSS 색상 형식 지원 (hex, rgb, hsl, named colors 등)
 * 🚀 Phase 5: currentColor 키워드 지원
 * - currentColor가 전달되면 resolvedColor(현재 요소의 color 값)로 대체
 * color-mix() 함수는 resolveColorMix()로 먼저 해석한다.
 *
 * @example
 * cssColorToHex('#3b82f6') // 0x3b82f6
 * cssColorToHex('rgb(59, 130, 246)') // 0x3b82f6
 * cssColorToHex('blue') // 0x0000ff
 * cssColorToHex('hsl(217, 91%, 60%)') // 0x3b82f6
 * cssColorToHex('currentColor', 0x000000, '#3b82f6') // 0x3b82f6
 * cssColorToHex('color-mix(in srgb, red 70%, blue)') // ~0xb30000
 */
export function cssColorToHex(
  color: string | undefined,
  fallback = 0x000000,
  resolvedColor?: string,
): number {
  if (!color) return fallback;
  const effective = resolvedColor
    ? String(resolveCurrentColor(color, resolvedColor))
    : color;

  const lower = effective.toLowerCase();

  if (lower.startsWith("oklch(")) {
    const hex = parseOklch(effective);
    if (hex) return cssColorToRgbNumber(hex, fallback);
    return fallback;
  }
  if (lower.startsWith("lab(")) {
    const hex = parseLab(effective);
    if (hex) return cssColorToRgbNumber(hex, fallback);
    return fallback;
  }
  if (lower.startsWith("lch(")) {
    const hex = parseLch(effective);
    if (hex) return cssColorToRgbNumber(hex, fallback);
    return fallback;
  }
  if (lower.startsWith("color(")) {
    const hex = parseColorFunc(effective);
    if (hex) return cssColorToRgbNumber(hex, fallback);
    return fallback;
  }
  if (lower.startsWith("color-mix(")) {
    const resolved = resolveColorMix(effective);
    if (resolved) return cssColorToRgbNumber(resolved, fallback);
  }
  return cssColorToRgbNumber(effective, fallback);
}

/**
 * 렌더용 정수 색상 (0xRRGGBB) → Float32Array [r, g, b, a] (0-1 범위).
 * buildBoxNodeData, buildImageNodeData, buildSpecNodeData 등에서 공용.
 */
export function colorIntToFloat32(color: number, alpha: number): Float32Array {
  return Float32Array.of(
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
    alpha,
  );
}

/**
 * CSS 색상에서 알파 값 추출
 *
 * colord를 사용하여 rgba/hsla/oklch/#rrggbbaa 등 모든 CSS 색상 형식을 지원한다 (I-L17).
 * 🚀 Phase 5: currentColor 키워드 지원
 * color-mix() 함수는 resolveColorMix()로 먼저 해석한다.
 */
export function cssColorToAlpha(
  color: string | undefined,
  resolvedColor?: string,
): number {
  if (!color) return 1;
  const effective = resolvedColor
    ? String(resolveCurrentColor(color, resolvedColor))
    : color;
  if (effective.toLowerCase() === "transparent") return 0;

  const lower = effective.toLowerCase();

  if (
    lower.startsWith("oklch(") ||
    lower.startsWith("lab(") ||
    lower.startsWith("lch(") ||
    lower.startsWith("color(")
  ) {
    return extractLevel4Alpha(effective);
  }

  const target = lower.startsWith("color-mix(")
    ? (resolveColorMix(effective) ?? effective)
    : effective;

  const parsed = colord(target);
  if (parsed.isValid()) {
    return parsed.toRgb().a ?? 1;
  }

  return 1;
}

function extractLevel4Alpha(color: string): number {
  const parenStart = color.indexOf("(");
  const parenEnd = color.lastIndexOf(")");
  if (parenStart === -1 || parenEnd === -1) return 1;
  const inner = color.slice(parenStart + 1, parenEnd);
  const slashIdx = inner.lastIndexOf("/");
  if (slashIdx === -1) return 1;
  const alphaPart = inner.slice(slashIdx + 1).trim();
  if (alphaPart.endsWith("%")) {
    const v = parseFloat(alphaPart) / 100;
    return isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
  }
  const v = parseFloat(alphaPart);
  return isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
}

// ============================================
// Size Conversion
// ============================================

/**
 * CSS 크기 값을 숫자로 변환
 *
 * 내부적으로 resolveCSSSizeValue()에 위임하여 일관된 단위 해석을 제공한다.
 * calc(), em, rem 등 확장 단위를 지원한다.
 *
 * @example
 * parseCSSSize('100px') // 100
 * parseCSSSize('50%', 800) // 400
 * parseCSSSize(200) // 200
 * parseCSSSize('100vh', undefined, 0, { width: 1920, height: 1080 }) // 1080
 * parseCSSSize('50vw', undefined, 0, { width: 1920, height: 1080 }) // 960
 * parseCSSSize('calc(100% - 20px)', 800) // 780
 */
export function parseCSSSize(
  value: string | number | undefined,
  parentSize?: number,
  fallback = 0,
  viewport?: { width: number; height: number },
): number {
  if (value === undefined || value === null) return fallback;

  const ctx: CSSValueContext = {
    parentSize,
    containerSize: parentSize,
    viewportWidth: viewport?.width,
    viewportHeight: viewport?.height,
    // ADR-056: rem 단위는 themeConfigStore.baseTypography.fontSize 기반
    rootFontSize: getRootComputedStyle().fontSize,
  };

  return resolveCSSSizeValue(value, ctx, fallback) ?? fallback;
}

// ============================================
// Style Converters
// ============================================

/**
 * CSS 스타일을 RenderTransform으로 변환
 */
export function convertToTransform(
  style: CSSStyle | undefined,
): RenderTransform {
  if (!style) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  return {
    x: parseCSSSize(style.left, undefined, 0),
    y: parseCSSSize(style.top, undefined, 0),
    width: parseCSSSize(style.width, undefined, 100),
    height: parseCSSSize(style.height, undefined, 100),
  };
}

/**
 * CSS 스타일을 RenderFillStyle로 변환
 *
 * @param style - CSS 스타일 객체
 * @param resolvedColor - currentColor 해석을 위한 현재 요소의 color 값
 */
export function convertToFillStyle(
  style: CSSStyle | undefined,
  resolvedColor?: string,
): RenderFillStyle {
  const bg =
    style?.backgroundColor ??
    ((style as Record<string, unknown> | undefined)?.background as
      string | undefined);
  const color = cssColorToHex(bg, 0xffffff, resolvedColor);
  const alpha =
    style?.opacity !== undefined
      ? parseCSSSize(style.opacity, undefined, 1)
      : bg
        ? cssColorToAlpha(bg, resolvedColor)
        : 0;

  return { color, alpha };
}

/**
 * CSS 스타일을 RenderStrokeStyle로 변환
 *
 * @param style - CSS 스타일 객체
 * @param resolvedColor - currentColor 해석을 위한 현재 요소의 color 값
 */
export function convertToStrokeStyle(
  style: CSSStyle | undefined,
  resolvedColor?: string,
): RenderStrokeStyle | null {
  if (!style?.borderWidth && !style?.borderColor) {
    return null;
  }

  return {
    width: parseCSSSize(style.borderWidth, undefined, 1),
    color: cssColorToHex(style.borderColor, 0x000000, resolvedColor),
    alpha: cssColorToAlpha(style.borderColor, resolvedColor),
  };
}

/**
 * CSS 스타일을 RenderTextStyle로 변환
 * P7.2-P7.4: fontStyle, letterSpacing, lineHeight (leading) 추가
 */
export function convertToTextStyle(
  style: CSSStyle | undefined,
  containerWidth = 100,
): RenderTextStyle {
  const fontSize = parseCSSSize(style?.fontSize, undefined, 16);

  // P7.4: lineHeight → leading 변환
  // CSS lineHeight가 배수(1.5)이면 (배수 - 1) * fontSize
  // 픽셀 값이면 fontSize를 뺌
  // 미지정 시 Tailwind CSS v4 기본 :root { line-height: 1.5 } 적용
  let leading: number;
  if (style?.lineHeight) {
    const lh = parseCSSSize(style.lineHeight, undefined, 0);
    // 배수 값 판별: 숫자 타입이거나 단위 없는 숫자 문자열 (예: "1.4", "1.5")
    // CSS line-height: 숫자만 있으면 배수, px/em 등 단위가 있으면 절대값
    const isMultiplier =
      lh < 10 &&
      (typeof style.lineHeight === "number" ||
        (typeof style.lineHeight === "string" &&
          /^\d*\.?\d+$/.test(style.lineHeight.trim())));
    if (isMultiplier) {
      // 배수 값 (예: 1.4, 1.5)
      leading = (lh - 1) * fontSize;
    } else {
      // 픽셀 값
      leading = Math.max(0, lh - fontSize);
    }
  } else {
    // CSS 기본 line-height: 1.5 (Tailwind CSS v4 :root 상속)
    leading = (1.5 - 1) * fontSize;
  }

  return {
    fontFamily: style?.fontFamily || "Pretendard, sans-serif",
    fontSize,
    fontWeight: String(style?.fontWeight || "normal"),
    fontStyle:
      (style?.fontStyle as "normal" | "italic" | "oblique") || "normal", // P7.2
    fill: cssColorToHex(style?.color, 0x000000),
    align: (style?.textAlign as "left" | "center" | "right") || "left",
    letterSpacing: parseCSSSize(style?.letterSpacing, undefined, 0), // P7.3
    leading, // P7.4
    wordWrap: true,
    wordWrapWidth: containerWidth,
  };
}

// ============================================
// P7.5-P7.6: Text Transform Utilities
// ============================================

/**
 * P7.6: CSS textTransform 적용
 */
export function applyTextTransform(
  text: string,
  transform: string | undefined,
): string {
  if (!transform || transform === "none") return text;

  switch (transform.toLowerCase()) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

/**
 * P7.5: CSS verticalAlign을 기반으로 텍스트 Y 위치 계산
 */
export function calculateTextY(
  containerHeight: number,
  textHeight: number,
  verticalAlign: string | undefined,
  paddingTop = 0,
  paddingBottom = 0,
): number {
  const contentHeight = containerHeight - paddingTop - paddingBottom;

  switch (verticalAlign?.toLowerCase()) {
    case "top":
      return paddingTop;
    case "bottom":
      return containerHeight - textHeight - paddingBottom;
    case "middle":
    default:
      return paddingTop + (contentHeight - textHeight) / 2;
  }
}

// ============================================
// CSS clip-path 파싱
// ============================================

export type ClipPathShape =
  | {
      type: "inset";
      top: number;
      right: number;
      bottom: number;
      left: number;
      borderRadius: number;
    }
  | { type: "circle"; radius: number; cx: number; cy: number }
  | { type: "ellipse"; rx: number; ry: number; cx: number; cy: number }
  | { type: "polygon"; points: Array<{ x: number; y: number }> };

/**
 * CSS clip-path 값을 파싱하여 ClipPathShape로 변환
 *
 * 지원 도형:
 * - inset(top right bottom left round <radius>)
 * - circle(<radius> at <cx> <cy>)
 * - ellipse(<rx> <ry> at <cx> <cy>)
 * - polygon(<x1> <y1>, <x2> <y2>, ...)
 *
 * @param value - CSS clip-path 속성 값 (함수 문자열)
 * @param width - 요소 너비 (% 값 해석용)
 * @param height - 요소 높이 (% 값 해석용)
 */
export function parseClipPath(
  value: string,
  width: number,
  height: number,
): ClipPathShape | null {
  if (!value || value === "none") return null;

  const trimmed = value.trim();

  const insetMatch = trimmed.match(/^inset\(([^)]*)\)$/i);
  if (insetMatch) {
    return parseInset(insetMatch[1].trim(), width, height);
  }

  const circleMatch = trimmed.match(/^circle\(([^)]*)\)$/i);
  if (circleMatch) {
    return parseCircle(circleMatch[1].trim(), width, height);
  }

  const ellipseMatch = trimmed.match(/^ellipse\(([^)]*)\)$/i);
  if (ellipseMatch) {
    return parseEllipse(ellipseMatch[1].trim(), width, height);
  }

  const polygonMatch = trimmed.match(/^polygon\(([^)]*)\)$/i);
  if (polygonMatch) {
    return parsePolygon(polygonMatch[1].trim(), width, height);
  }

  return null;
}

function resolveClipLength(raw: string, base: number): number {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    return (parseFloat(trimmed) / 100) * base;
  }
  return parseCSSSize(trimmed, base, 0);
}

function resolveClipPosition(
  raw: string,
  width: number,
  height: number,
): [number, number] {
  const keyword = raw.trim().toLowerCase();
  if (keyword === "center") return [width / 2, height / 2];
  if (keyword === "top") return [width / 2, 0];
  if (keyword === "bottom") return [width / 2, height];
  if (keyword === "left") return [0, height / 2];
  if (keyword === "right") return [width, height / 2];

  const parts = raw.trim().split(/\s+/);
  const cx = resolveClipAxisValue(parts[0] ?? "50%", width, "x", width, height);
  const cy = parts[1]
    ? resolveClipAxisValue(parts[1], height, "y", width, height)
    : height / 2;
  return [cx, cy];
}

function resolveClipAxisValue(
  raw: string,
  base: number,
  _axis: "x" | "y",
  width: number,
  height: number,
): number {
  const keyword = raw.trim().toLowerCase();
  if (keyword === "center") return base / 2;
  if (keyword === "left") return 0;
  if (keyword === "right") return width;
  if (keyword === "top") return 0;
  if (keyword === "bottom") return height;
  return resolveClipLength(raw, base);
}

function parseInset(
  args: string,
  width: number,
  height: number,
): ClipPathShape | null {
  // 분리: round 키워드 앞/뒤
  const roundIdx = args.toLowerCase().indexOf("round");
  const sidesPart = roundIdx >= 0 ? args.slice(0, roundIdx).trim() : args;
  const roundPart = roundIdx >= 0 ? args.slice(roundIdx + 5).trim() : "";

  const sides = sidesPart.split(/\s+/).filter(Boolean);
  if (sides.length === 0) return null;

  let top: number, right: number, bottom: number, left: number;
  if (sides.length === 1) {
    top =
      right =
      bottom =
      left =
        resolveClipLength(sides[0], Math.min(width, height));
  } else if (sides.length === 2) {
    top = bottom = resolveClipLength(sides[0], height);
    right = left = resolveClipLength(sides[1], width);
  } else if (sides.length === 3) {
    top = resolveClipLength(sides[0], height);
    right = left = resolveClipLength(sides[1], width);
    bottom = resolveClipLength(sides[2], height);
  } else {
    top = resolveClipLength(sides[0], height);
    right = resolveClipLength(sides[1], width);
    bottom = resolveClipLength(sides[2], height);
    left = resolveClipLength(sides[3], width);
  }

  const borderRadius = roundPart
    ? resolveClipLength(roundPart.split(/\s+/)[0], Math.min(width, height))
    : 0;

  return { type: "inset", top, right, bottom, left, borderRadius };
}

function parseCircle(
  args: string,
  width: number,
  height: number,
): ClipPathShape | null {
  const atIdx = args.toLowerCase().indexOf(" at ");
  const radiusPart = atIdx >= 0 ? args.slice(0, atIdx).trim() : args.trim();
  const centerPart = atIdx >= 0 ? args.slice(atIdx + 4).trim() : "center";

  const base = Math.sqrt((width * width + height * height) / 2);
  const radius =
    radiusPart === "closest-side" ||
    radiusPart === "farthest-side" ||
    !radiusPart
      ? Math.min(width, height) / 2
      : resolveClipLength(radiusPart, base);

  const [cx, cy] = resolveClipPosition(centerPart, width, height);

  return { type: "circle", radius, cx, cy };
}

function parseEllipse(
  args: string,
  width: number,
  height: number,
): ClipPathShape | null {
  const atIdx = args.toLowerCase().indexOf(" at ");
  const radiiPart = atIdx >= 0 ? args.slice(0, atIdx).trim() : args.trim();
  const centerPart = atIdx >= 0 ? args.slice(atIdx + 4).trim() : "center";

  const radii = radiiPart.split(/\s+/).filter(Boolean);
  const rx = radii[0] ? resolveClipLength(radii[0], width) : width / 2;
  const ry = radii[1] ? resolveClipLength(radii[1], height) : height / 2;

  const [cx, cy] = resolveClipPosition(centerPart, width, height);

  return { type: "ellipse", rx, ry, cx, cy };
}

function parsePolygon(
  args: string,
  width: number,
  height: number,
): ClipPathShape | null {
  // 'evenodd' 또는 'nonzero' fill rule 접두어 제거
  const cleaned = args.replace(/^(evenodd|nonzero)\s*,?\s*/i, "");
  const pointPairs = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const points = pointPairs.map((pair) => {
    const coords = pair.split(/\s+/).filter(Boolean);
    const x = coords[0] ? resolveClipLength(coords[0], width) : 0;
    const y = coords[1] ? resolveClipLength(coords[1], height) : 0;
    return { x, y };
  });

  if (points.length < 3) return null;
  return { type: "polygon", points };
}

/**
 * CSS borderRadius를 렌더용 반경 배열로 변환
 *
 * CSS border-radius 형식:
 * - 단일 값: "8px" → 8
 * - 2값: "8px 4px" → [8, 4, 8, 4] (tl=br, tr=bl)
 * - 3값: "8px 4px 2px" → [8, 4, 2, 4] (tr=bl)
 * - 4값: "8px 4px 2px 6px" → [8, 4, 2, 6] (tl, tr, br, bl)
 */
export function convertBorderRadius(
  borderRadius: string | number | undefined,
): number | [number, number, number, number] {
  if (!borderRadius) return 0;

  if (typeof borderRadius === "number") return borderRadius;

  // 공백 구분 다중 값 파싱
  const parts = borderRadius.trim().split(/\s+/);
  if (parts.length === 1) {
    return parseCSSSize(parts[0], undefined, 0);
  }

  const values = parts.map((p) => {
    const v = parseCSSSize(p, undefined, 0);
    // 음수 및 invalid 값 방어
    return Number.isFinite(v) && v >= 0 ? v : 0;
  });
  if (values.length === 2) {
    return [values[0], values[1], values[0], values[1]];
  }
  if (values.length === 3) {
    return [values[0], values[1], values[2], values[1]];
  }
  // 4값: tl, tr, br, bl
  return [values[0], values[1], values[2], values[3]];
}

// ============================================
// Full Style Conversion
// ============================================

export interface ConvertedStyle {
  transform: RenderTransform;
  fill: RenderFillStyle;
  stroke: RenderStrokeStyle | null;
  text: RenderTextStyle;
  borderRadius: number | [number, number, number, number];
}

/**
 * CSS 스타일을 모든 Render* 스타일로 변환
 *
 * Phase 5: currentColor + initial/unset/revert 지원
 * - style.color를 resolvedColor로 사용하여 색상 속성의 currentColor를 해석한다.
 * - initial/unset/revert 키워드는 preprocessStyle()에서 전처리된다.
 *
 * @param style - CSS 스타일 객체
 * @param computedColor - 상위 resolved color (cssResolver.resolveStyle()의 결과)
 *                        전달하지 않으면 style.color 값을 사용한다.
 */
export function convertStyle(
  style: CSSStyle | undefined,
  computedColor?: string,
): ConvertedStyle {
  const transform = convertToTransform(style);

  // currentColor 해석을 위한 color 값 결정
  // computedColor가 전달된 경우: 상위 cascade에서 이미 계산된 값 사용
  // 그렇지 않은 경우: 현재 style의 color 값 사용 (fallback: #000000)
  const resolvedColor = computedColor ?? style?.color ?? "#000000";

  // 비상속 속성의 cascade 키워드(initial, unset, revert) 및 currentColor 전처리
  const processedStyle = style
    ? (preprocessStyle(
        style as Record<string, unknown>,
        resolvedColor,
      ) as CSSStyle)
    : style;

  return {
    transform,
    fill: convertToFillStyle(processedStyle, resolvedColor),
    stroke: convertToStrokeStyle(processedStyle, resolvedColor),
    text: convertToTextStyle(processedStyle, transform.width),
    borderRadius: convertBorderRadius(processedStyle?.borderRadius),
  };
}

// ============================================
// Skia Effects Builder
// ============================================

interface SkiaEffectsResult {
  effects?: EffectStyle[];
  blendMode?: string;
  /** CSS transform → CanvasKit 3x3 matrix (Float32Array(9)) */
  transform?: Float32Array;
}

/**
 * CSS 스타일에서 Skia 이펙트 목록과 blend mode를 추출한다.
 *
 * 지원 속성:
 * - opacity → OpacityEffect
 * - boxShadow → DropShadowEffect
 * - filter: blur() → LayerBlurEffect
 * - filter: brightness() → ColorMatrixEffect
 * - filter: contrast() → ColorMatrixEffect
 * - filter: saturate() → ColorMatrixEffect
 * - filter: hue-rotate() → ColorMatrixEffect
 * - backdropFilter: blur() → BackgroundBlurEffect
 * - mixBlendMode → blendMode string
 */
export function buildSkiaEffects(
  style: CSSStyle | undefined,
): SkiaEffectsResult {
  if (!style) return {};

  const effects: EffectStyle[] = [];

  // 1. opacity → OpacityEffect
  if (style.opacity !== undefined) {
    const value = parseCSSSize(style.opacity, undefined, 1);
    if (value < 1) {
      effects.push({ type: "opacity", value, source: "style" });
    }
  }

  // 2. boxShadow → DropShadowEffect (다중 shadow 지원)
  if (style.boxShadow && style.boxShadow !== "none") {
    const shadows = parseAllBoxShadows(style.boxShadow);
    for (const shadow of shadows) {
      effects.push(shadow);
    }
  }

  // 3. filter → LayerBlurEffect + ColorMatrixEffect
  if (style.filter) {
    const filterEffects = parseCSSFilter(style.filter);
    for (const fe of filterEffects) {
      effects.push(fe);
    }
  }

  // 4. backdropFilter: blur() + saturate() + brightness() 등 체이닝 지원
  if (style.backdropFilter) {
    const backdropEffect = parseCSSBackdropFilter(style.backdropFilter);
    if (backdropEffect) {
      effects.push(backdropEffect);
    }
  }

  // 5. CSS transform → CanvasKit 3x3 matrix
  let transformMatrix: Float32Array | undefined;
  if (style.transform && style.transform !== "none") {
    // width/height는 transform-origin의 % 해석에 필요 — SkiaEffectsResult에서는
    // 호출측에서 별도 width/height 전달이 필요하나, 현재 buildSkiaEffects()는
    // style만 받으므로 transform-origin의 % 및 키워드는 0 기반으로 처리한다.
    // 실제 origin 적용은 BoxSprite 등에서 width/height를 알고 있는 시점에서 수행.
    transformMatrix = parseTransform(style.transform) ?? undefined;
  }

  return {
    effects: effects.length > 0 ? effects : undefined,
    blendMode: style.mixBlendMode || undefined,
    transform: transformMatrix,
  };
}

/**
 * 다중 CSS boxShadow를 파싱하여 DropShadowEffect 배열로 변환
 *
 * 쉼표로 분리하되, 괄호 내부의 쉼표(rgb() 등)는 무시한다.
 */
function parseAllBoxShadows(raw: string): DropShadowEffect[] {
  const parts = raw.split(/,(?![^(]*\))/);
  return parts
    .map((s) => parseOneShadow(s.trim()))
    .filter((s): s is DropShadowEffect => s !== null);
}

/**
 * ADR-187 Phase 5: materialized box-shadow presentation target을 만들 때도
 * canonical Skia parser와 같은 CSS 해석을 사용한다. 호출자는 반환된 effect를
 * 기존 node.effects slot에 덮어쓸 수 있을 때만 paint lane을 선택한다.
 */
export function parseBoxShadowEffects(raw: string): DropShadowEffect[] {
  return parseAllBoxShadows(raw);
}

/**
 * 단일 CSS boxShadow 값을 파싱하여 DropShadowEffect로 변환
 *
 * 지원 포맷: [inset] offsetX offsetY [blurRadius [spreadRadius]] [color]
 */
function parseOneShadow(raw: string): DropShadowEffect | null {
  if (!raw || raw === "none") return null;

  const inner = /\binset\b/.test(raw);
  let cleaned = raw.replace(/\binset\b/, "").trim();

  // 색상 추출 (rgb/rgba/hsl/hsla/#hex)
  let colorStr = "rgba(0,0,0,1)";
  const colorPatterns = [
    /rgba?\([^)]+\)/,
    /hsla?\([^)]+\)/,
    /#[0-9a-fA-F]{3,8}/,
  ];
  for (const pattern of colorPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      colorStr = match[0];
      cleaned = cleaned.replace(match[0], "").trim();
      break;
    }
  }

  // 숫자값 추출 (px 단위 선택적)
  const nums = cleaned.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2) return null;

  const dx = nums[0];
  const dy = nums[1];
  const blurRadius = nums[2] ?? 0;
  const spread = nums[3] ?? 0;
  // CSS blur-radius → Skia sigma (W3C: σ = radius / 2.355)
  const sigma = blurRadius / 2.355;

  // 색상 → Float32Array
  const hex = cssColorToHex(colorStr, 0x000000);
  const alpha = cssColorToAlpha(colorStr);
  const color = Float32Array.of(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  );

  return {
    type: "drop-shadow",
    dx,
    dy,
    sigmaX: sigma,
    sigmaY: sigma,
    color,
    inner,
    spread,
  };
}

// ============================================
// CSS Transform → CanvasKit 3x3 Matrix
// ============================================

/**
 * 3x3 행렬 곱셈 (row-major, CanvasKit 규격)
 *
 * CanvasKit 3x3 layout:
 * [scaleX, skewX,  transX]   [0, 1, 2]
 * [skewY,  scaleY, transY] = [3, 4, 5]
 * [persp0, persp1, persp2]   [6, 7, 8]
 */
function multiply3x3(a: Float32Array, b: Float32Array): Float32Array {
  return Float32Array.of(
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  );
}

/** 단위 행렬 (3x3 identity) */
function identity3x3(): Float32Array {
  return Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1);
}

/** 이동 행렬 */
function translateMatrix(tx: number, ty: number): Float32Array {
  return Float32Array.of(1, 0, tx, 0, 1, ty, 0, 0, 1);
}

/** 회전 행렬 (라디안) */
function rotateMatrix(radians: number): Float32Array {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return Float32Array.of(c, -s, 0, s, c, 0, 0, 0, 1);
}

/** 스케일 행렬 */
function scaleMatrix(sx: number, sy: number): Float32Array {
  return Float32Array.of(sx, 0, 0, 0, sy, 0, 0, 0, 1);
}

/** skew 행렬 (라디안) */
function skewMatrix(ax: number, ay: number): Float32Array {
  return Float32Array.of(1, Math.tan(ax), 0, Math.tan(ay), 1, 0, 0, 0, 1);
}

/** 각도 문자열을 라디안으로 변환 */
function parseAngle(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("rad")) return parseFloat(trimmed);
  if (trimmed.endsWith("turn")) return parseFloat(trimmed) * Math.PI * 2;
  if (trimmed.endsWith("grad")) return parseFloat(trimmed) * (Math.PI / 200);
  // deg (기본)
  return parseFloat(trimmed) * (Math.PI / 180);
}

/**
 * CSS transform 문자열을 CanvasKit 3x3 matrix로 변환
 *
 * 지원 함수: translate, translateX, translateY, rotate, scale, scaleX, scaleY,
 *           skew, skewX, skewY, matrix
 *
 * 여러 함수를 순서대로 왼쪽에서 오른쪽으로 합성한다.
 */
export function parseTransform(value: string): Float32Array | null {
  if (!value || value === "none") return null;

  // 각 transform 함수를 추출: functionName(args)
  const funcRegex = /(\w+)\(([^)]*)\)/g;
  let result = identity3x3();
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(value)) !== null) {
    const fn = match[1];
    const args = match[2]
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    let mat: Float32Array | null = null;

    switch (fn) {
      case "translate": {
        const tx = parseCSSSize(args[0], undefined, 0);
        const ty = args[1] ? parseCSSSize(args[1], undefined, 0) : 0;
        mat = translateMatrix(tx, ty);
        break;
      }
      case "translateX": {
        mat = translateMatrix(parseCSSSize(args[0], undefined, 0), 0);
        break;
      }
      case "translateY": {
        mat = translateMatrix(0, parseCSSSize(args[0], undefined, 0));
        break;
      }
      case "rotate": {
        mat = rotateMatrix(parseAngle(args[0]));
        break;
      }
      case "scale": {
        const sx = parseFloat(args[0]);
        const sy = args[1] ? parseFloat(args[1]) : sx;
        if (!isNaN(sx) && !isNaN(sy)) mat = scaleMatrix(sx, sy);
        break;
      }
      case "scaleX": {
        const sx = parseFloat(args[0]);
        if (!isNaN(sx)) mat = scaleMatrix(sx, 1);
        break;
      }
      case "scaleY": {
        const sy = parseFloat(args[0]);
        if (!isNaN(sy)) mat = scaleMatrix(1, sy);
        break;
      }
      case "skew": {
        const ax = parseAngle(args[0]);
        const ay = args[1] ? parseAngle(args[1]) : 0;
        mat = skewMatrix(ax, ay);
        break;
      }
      case "skewX": {
        mat = skewMatrix(parseAngle(args[0]), 0);
        break;
      }
      case "skewY": {
        mat = skewMatrix(0, parseAngle(args[0]));
        break;
      }
      case "matrix": {
        // CSS matrix(a, b, c, d, e, f) → CanvasKit row-major 3x3
        // CSS 행렬:        CanvasKit 배열:
        // | a  c  e |      [a, c, e,
        // | b  d  f |  →    b, d, f,
        // | 0  0  1 |       0, 0, 1]
        if (args.length === 6) {
          const [a, b, c, d, e, f] = args.map(Number);
          if ([a, b, c, d, e, f].every((n) => isFinite(n))) {
            mat = Float32Array.of(a, c, e, b, d, f, 0, 0, 1);
          }
        }
        break;
      }
      default:
        break;
    }

    if (mat) {
      result = multiply3x3(result, mat);
      matched = true;
    }
  }

  return matched ? result : null;
}

/**
 * CSS transform-origin 값을 [ox, oy] 좌표로 변환
 *
 * 지원 키워드: left, center, right, top, bottom
 * 지원 단위: px, %, 숫자
 *
 * 기본값: center center → (width/2, height/2)
 */
export function parseTransformOrigin(
  value: string | undefined,
  width: number,
  height: number,
): [number, number] {
  if (!value) return [width / 2, height / 2];

  const parts = value.trim().split(/\s+/);
  const resolveX = (v: string): number => {
    switch (v) {
      case "left":
        return 0;
      case "center":
        return width / 2;
      case "right":
        return width;
      default:
        if (v.endsWith("%")) return (parseFloat(v) / 100) * width;
        return parseCSSSize(v, width, width / 2);
    }
  };
  const resolveY = (v: string): number => {
    switch (v) {
      case "top":
        return 0;
      case "center":
        return height / 2;
      case "bottom":
        return height;
      default:
        if (v.endsWith("%")) return (parseFloat(v) / 100) * height;
        return parseCSSSize(v, height, height / 2);
    }
  };

  const ox = resolveX(parts[0]);
  const oy = parts[1] ? resolveY(parts[1]) : height / 2;

  return [ox, oy];
}

/**
 * transform-origin을 적용한 최종 3x3 matrix 생성
 *
 * 원리: translate(ox, oy) × matrix × translate(-ox, -oy)
 * → origin으로 이동 후 변환 적용, 다시 원위치
 */
export function applyTransformOrigin(
  matrix: Float32Array,
  ox: number,
  oy: number,
): Float32Array {
  const pre = translateMatrix(ox, oy);
  const post = translateMatrix(-ox, -oy);
  return multiply3x3(multiply3x3(pre, matrix), post);
}

// ============================================
// CSS Filter → EffectStyle 변환
// ============================================

/**
 * CSS filter 함수 이름 → color matrix 생성 함수 매핑.
 * parseCSSFilter/parseCSSBackdropFilter 양쪽에서 공유.
 */
const COLOR_MATRIX_FILTER_MAP: Record<
  string,
  (arg: string) => Float32Array | null
> = {
  brightness: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? brightnessMatrix(val) : null;
  },
  contrast: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? contrastMatrix(val) : null;
  },
  saturate: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? saturateMatrix(val) : null;
  },
  "hue-rotate": (arg) => {
    const degrees = parseFilterAngleArg(arg);
    return degrees !== null ? hueRotateMatrix(degrees) : null;
  },
  grayscale: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? grayscaleMatrix(val) : null;
  },
  invert: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? invertMatrix(val) : null;
  },
  sepia: (arg) => {
    const val = parseFilterNumericArg(arg, 1);
    return val !== null ? sepiaMatrix(val) : null;
  },
};

/**
 * color matrix filter 함수들을 순차 합성하여 단일 행렬을 반환한다.
 * 합성 결과가 identity이면 null 반환 (GPU pass 불필요).
 */
function composeColorMatrixFromFn(
  fn: string,
  arg: string,
  current: Float32Array | null,
): Float32Array | null {
  const factory = COLOR_MATRIX_FILTER_MAP[fn];
  if (!factory) return current;
  const mat = factory(arg);
  if (!mat) return current;
  return current ? multiplyColorMatrix(mat, current) : mat;
}

/** 합성된 color matrix가 identity이면 null, 아니면 그대로 반환 */
function finalizeColorMatrix(
  composed: Float32Array | null,
): Float32Array | null {
  if (!composed) return null;
  const identity = identityColorMatrix();
  for (let i = 0; i < 20; i++) {
    if (Math.abs(composed[i] - identity[i]) > 1e-6) return composed;
  }
  return null;
}

/** 4x5 identity color matrix */
function identityColorMatrix(): Float32Array {
  // prettier-ignore
  return Float32Array.of(
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  );
}

/**
 * 두 4x5 색상 행렬을 합성한다 (a * b).
 *
 * 4x5 행렬은 4x4 선형 부분 + 4x1 오프셋 열로 구성된다.
 * result[i,j] = sum(a[i,k] * b[k,j]) (k=0..3)   — 선형 부분
 * result[i,4] = sum(a[i,k] * b[k,4]) + a[i,4]    — 오프셋 열
 */
function multiplyColorMatrix(a: Float32Array, b: Float32Array): Float32Array {
  const r = new Float32Array(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }
      // 오프셋 열(col=4)에 자기 오프셋 추가
      if (col === 4) {
        sum += a[row * 5 + 4];
      }
      r[row * 5 + col] = sum;
    }
  }
  return r;
}

/**
 * brightness(val) → 4x5 색상 행렬
 *
 * RGB 채널에 val을 곱한다. Alpha는 변경 없음.
 */
function brightnessMatrix(val: number): Float32Array {
  // prettier-ignore
  return Float32Array.of(
    val, 0,   0,   0, 0,
    0,   val, 0,   0, 0,
    0,   0,   val, 0, 0,
    0,   0,   0,   1, 0,
  );
}

/**
 * contrast(val) → 4x5 색상 행렬
 *
 * 대각선에 val, 오프셋에 0.5 * (1 - val) 을 적용한다.
 * (CanvasKit의 ColorFilter.MakeMatrix는 오프셋을 0-1 범위로 해석)
 */
function contrastMatrix(val: number): Float32Array {
  const offset = 0.5 * (1 - val);
  // prettier-ignore
  return Float32Array.of(
    val, 0,   0,   0, offset,
    0,   val, 0,   0, offset,
    0,   0,   val, 0, offset,
    0,   0,   0,   1, 0,
  );
}

/**
 * saturate(val) → 4x5 색상 행렬
 *
 * SVG/CSS 사양(feColorMatrix type="saturate")을 따른다.
 * https://www.w3.org/TR/filter-effects-1/#feColorMatrixElement
 */
function saturateMatrix(val: number): Float32Array {
  const s = val;
  // ITU-R BT.709 luminance coefficients
  const rL = 0.2126;
  const gL = 0.7152;
  const bL = 0.0722;

  // prettier-ignore
  return Float32Array.of(
    rL * (1 - s) + s,   gL * (1 - s),       bL * (1 - s),       0, 0,
    rL * (1 - s),       gL * (1 - s) + s,   bL * (1 - s),       0, 0,
    rL * (1 - s),       gL * (1 - s),       bL * (1 - s) + s,   0, 0,
    0,                  0,                  0,                  1, 0,
  );
}

/**
 * hue-rotate(deg) → 4x5 색상 행렬
 *
 * SVG/CSS 사양(feColorMatrix type="hueRotate")을 따른다.
 * https://www.w3.org/TR/filter-effects-1/#feColorMatrixElement
 */
function hueRotateMatrix(degrees: number): Float32Array {
  const rad = degrees * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // ITU-R BT.709 luminance coefficients
  const rL = 0.2126;
  const gL = 0.7152;
  const bL = 0.0722;

  // 사양에 따른 3x3 RGB 회전 행렬
  const m00 = rL + cos * (1 - rL) + sin * -rL;
  const m01 = gL + cos * -gL + sin * -gL;
  const m02 = bL + cos * -bL + sin * (1 - bL);
  const m10 = rL + cos * -rL + sin * 0.143;
  const m11 = gL + cos * (1 - gL) + sin * 0.14;
  const m12 = bL + cos * -bL + sin * -0.283;
  const m20 = rL + cos * -rL + sin * -(1 - rL);
  const m21 = gL + cos * -gL + sin * gL;
  const m22 = bL + cos * (1 - bL) + sin * bL;

  // prettier-ignore
  return Float32Array.of(
    m00, m01, m02, 0, 0,
    m10, m11, m12, 0, 0,
    m20, m21, m22, 0, 0,
    0,   0,   0,   1, 0,
  );
}

/**
 * grayscale(amount) → 4x5 색상 행렬
 *
 * SVG Filter Effects Level 1 사양의 grayscale 행렬을 따른다.
 * amount=0: 원본, amount=1: 완전 회색조.
 * https://www.w3.org/TR/filter-effects-1/#grayscaleEquivalent
 */
function grayscaleMatrix(amount: number): Float32Array {
  // amount=0 → 원본(항등), amount=1 → 완전 회색조
  // s: 원본 유지 비율. s=1이면 saturate(1)과 동일 (원본), s=0이면 모든 채널이 휘도값으로 수렴
  const s = Math.max(0, Math.min(1, 1 - amount));
  // ITU-R BT.709 luminance coefficients
  const rL = 0.2126;
  const gL = 0.7152;
  const bL = 0.0722;

  // SVG spec: grayscale(amount) = saturate(1 - amount)
  // prettier-ignore
  return Float32Array.of(
    rL + (1 - rL) * s,  gL - gL * s,         bL - bL * s,         0, 0,
    rL - rL * s,         gL + (1 - gL) * s,  bL - bL * s,         0, 0,
    rL - rL * s,         gL - gL * s,         bL + (1 - bL) * s,  0, 0,
    0,                   0,                   0,                   1, 0,
  );
}

/**
 * invert(amount) → 4x5 색상 행렬
 *
 * 각 RGB 채널을 (1 - 2*amount)로 스케일하고 amount 오프셋을 더한다.
 * amount=0: 원본, amount=1: 완전 반전.
 */
function invertMatrix(amount: number): Float32Array {
  const a = Math.max(0, Math.min(1, amount));
  // amount=0 → scale=1, offset=0 (원본)
  // amount=1 → scale=-1, offset=1 (완전 반전: R' = -R + 1)
  const scale = 1 - 2 * a;
  const offset = a;

  // prettier-ignore
  return Float32Array.of(
    scale, 0,     0,     0, offset,
    0,     scale, 0,     0, offset,
    0,     0,     scale, 0, offset,
    0,     0,     0,     1, 0,
  );
}

/**
 * sepia(amount) → 4x5 색상 행렬
 *
 * SVG Filter Effects Level 1 사양의 sepia 행렬을 따른다.
 * amount=0: 원본, amount=1: 완전 세피아.
 * https://www.w3.org/TR/filter-effects-1/#sepiaEquivalent
 */
function sepiaMatrix(amount: number): Float32Array {
  // s: 원본 유지 비율. s=1이면 항등(원본), s=0이면 완전 세피아
  const s = Math.max(0, Math.min(1, 1 - amount));

  // prettier-ignore
  return Float32Array.of(
    0.393 + 0.607 * s,  0.769 - 0.769 * s,  0.189 - 0.189 * s,  0, 0,
    0.349 - 0.349 * s,  0.686 + 0.314 * s,  0.168 - 0.168 * s,  0, 0,
    0.272 - 0.272 * s,  0.534 - 0.534 * s,  0.131 + 0.869 * s,  0, 0,
    0,                  0,                  0,                   1, 0,
  );
}

/**
 * CSS filter: drop-shadow() 인자를 파싱하여 DropShadowEffect로 변환한다.
 *
 * 포맷: "offsetX offsetY [blurRadius [spread]] [color]"
 * - spread는 CSS filter drop-shadow에서 무시된다 (box-shadow와 다름).
 * - color는 colord로 파싱하여 Float32Array로 변환한다.
 *
 * @param arg - drop-shadow() 괄호 안쪽 문자열
 * @returns DropShadowEffect 또는 null
 */
function parseDropShadowFilterArgs(arg: string): DropShadowEffect | null {
  if (!arg) return null;

  let cleaned = arg.trim();

  // 색상 추출 (rgb/rgba/hsl/hsla/#hex) — box-shadow 파서와 동일한 패턴
  let colorStr = "rgba(0,0,0,1)";
  const colorPatterns = [
    /rgba?\([^)]+\)/,
    /hsla?\([^)]+\)/,
    /#[0-9a-fA-F]{3,8}/,
  ];
  for (const pattern of colorPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      colorStr = match[0];
      cleaned = cleaned.replace(match[0], "").trim();
      break;
    }
  }

  // 숫자값 추출: offsetX offsetY [blurRadius [spread]]
  const nums = cleaned.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2) return null;

  const dx = nums[0];
  const dy = nums[1];
  const blurRadius = nums[2] ?? 0;
  // CSS blur-radius → Skia sigma (W3C: σ = radius / 2.355)
  const sigma = blurRadius / 2.355;
  // nums[3]은 spread — filter drop-shadow에서는 무시

  // 색상 → Float32Array (box-shadow 파서와 동일한 변환)
  const hex = cssColorToHex(colorStr, 0x000000);
  const alpha = cssColorToAlpha(colorStr);
  const color = Float32Array.of(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  );

  return {
    type: "drop-shadow",
    dx,
    dy,
    sigmaX: sigma,
    sigmaY: sigma,
    color,
    inner: false, // CSS filter drop-shadow는 항상 외부 그림자
  };
}

/**
 * CSS filter 문자열에서 모든 필터 함수를 파싱하여 EffectStyle 배열로 변환한다.
 *
 * 지원 함수:
 * - blur(Xpx) → LayerBlurEffect
 * - brightness(X) → ColorMatrixEffect
 * - contrast(X) → ColorMatrixEffect
 * - saturate(X) → ColorMatrixEffect
 * - hue-rotate(Xdeg) → ColorMatrixEffect
 * - grayscale(X) → ColorMatrixEffect
 * - invert(X) → ColorMatrixEffect
 * - sepia(X) → ColorMatrixEffect
 * - drop-shadow(offsetX offsetY blur color) → DropShadowEffect
 *
 * 여러 color matrix 함수가 있으면 하나의 합성 행렬로 병합하여
 * 단일 ColorMatrixEffect로 출력한다 (GPU pass 최소화).
 */
function parseCSSFilter(filter: string): EffectStyle[] {
  const results: EffectStyle[] = [];
  const funcRegex = /([\w-]+)\(([^)]*)\)/g;
  let composedMatrix: Float32Array | null = null;
  let funcMatch: RegExpExecArray | null;

  while ((funcMatch = funcRegex.exec(filter)) !== null) {
    const fn = funcMatch[1];
    const arg = funcMatch[2].trim();

    if (fn === "blur") {
      const sigma = parseFloat(arg);
      if (!isNaN(sigma) && sigma > 0) {
        results.push({ type: "layer-blur", sigma });
      }
    } else if (fn === "drop-shadow") {
      const shadow = parseDropShadowFilterArgs(arg);
      if (shadow) results.push(shadow);
    } else {
      composedMatrix = composeColorMatrixFromFn(fn, arg, composedMatrix);
    }
  }

  const finalMatrix = finalizeColorMatrix(composedMatrix);
  if (finalMatrix) {
    results.push({ type: "color-matrix", matrix: finalMatrix });
  }

  return results;
}

/**
 * CSS backdrop-filter 문자열을 파싱하여 BackdropFilterEffect로 변환한다.
 *
 * 지원 함수:
 * - blur(Xpx) → sigma (0이면 블러 없음)
 * - brightness(X), contrast(X), saturate(X), hue-rotate(Xdeg),
 *   grayscale(X), invert(X), sepia(X) → colorMatrix (합성)
 *
 * 아무 함수도 없으면 null 반환.
 */
function parseCSSBackdropFilter(filter: string): BackdropFilterEffect | null {
  const funcRegex = /([\w-]+)\(([^)]*)\)/g;
  let funcMatch: RegExpExecArray | null;
  let sigma = 0;
  let composedMatrix: Float32Array | null = null;

  while ((funcMatch = funcRegex.exec(filter)) !== null) {
    const fn = funcMatch[1];
    const arg = funcMatch[2].trim();

    if (fn === "blur") {
      const px = parseFloat(arg);
      if (!isNaN(px) && px > 0) sigma = px;
    } else {
      composedMatrix = composeColorMatrixFromFn(fn, arg, composedMatrix);
    }
  }

  if (sigma === 0 && composedMatrix === null) return null;

  return {
    type: "backdrop-filter",
    sigma,
    colorMatrix: finalizeColorMatrix(composedMatrix) ?? undefined,
  };
}

/**
 * CSS filter 함수의 숫자/퍼센트 인자를 파싱한다.
 *
 * - "1.5" → 1.5
 * - "150%" → 1.5
 * - 파싱 실패 시 null 반환
 */
function parseFilterNumericArg(
  arg: string,
  _defaultValue: number,
): number | null {
  if (!arg) return null;
  const trimmed = arg.trim();
  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num / 100;
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * CSS filter 함수의 각도 인자를 도(degree) 단위로 파싱한다.
 *
 * - "90deg" → 90
 * - "1.57rad" → ~90
 * - "0.25turn" → 90
 * - "100grad" → 90
 * - "90" → 90 (deg 기본값)
 */
function parseFilterAngleArg(arg: string): number | null {
  if (!arg) return null;
  const trimmed = arg.trim();

  if (trimmed.endsWith("rad")) {
    const rad = parseFloat(trimmed);
    return isNaN(rad) ? null : rad * (180 / Math.PI);
  }
  if (trimmed.endsWith("turn")) {
    const turn = parseFloat(trimmed);
    return isNaN(turn) ? null : turn * 360;
  }
  if (trimmed.endsWith("grad")) {
    const grad = parseFloat(trimmed);
    return isNaN(grad) ? null : grad * (180 / 200);
  }
  // deg (기본값)
  const deg = parseFloat(trimmed);
  return isNaN(deg) ? null : deg;
}

// ============================================
// G4: text-shadow 파싱
// ============================================

import type { TextShadow } from "../skia/types";

/**
 * CSS text-shadow 문자열 → TextShadow[] 변환.
 *
 * 형식: "<offsetX> <offsetY> [blur-radius] [color], ..."
 * CSS 스펙 상 첫 번째 shadow가 맨 위에 그려지므로,
 * 반환 배열의 순서는 CSS 선언 순서와 동일하다.
 * 렌더러(nodeRendererText.ts)에서 역순 순회(shadow-first 2-pass)로 처리.
 *
 * blur-radius → sigma 변환: sigma = blurRadius / 2.355
 * (CSS blur-radius는 표준편차의 약 2배 = FWHM 기준)
 */
export function parseTextShadow(value: string): TextShadow[] {
  if (!value || value === "none") return [];

  // 쉼표로 분리 (단, 색상 함수 내 쉼표는 괄호 깊이로 구분)
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());

  return parts.map((part) => {
    // 토큰 분리: 괄호 그룹은 단일 토큰으로 처리
    const tokens: string[] = [];
    let tokenStart = 0;
    let d = 0;
    for (let i = 0; i <= part.length; i++) {
      const ch = part[i];
      if (ch === "(") d++;
      else if (ch === ")") d--;

      const isEnd = i === part.length;
      const isDelim = (ch === " " || ch === "\t") && d === 0;

      if (isEnd || isDelim) {
        const tok = part.slice(tokenStart, i).trim();
        if (tok) tokens.push(tok);
        tokenStart = i + 1;
      }
    }

    // 숫자(px) 토큰과 색상 토큰을 분리
    const numericParts: number[] = [];
    let colorToken = "";
    for (const tok of tokens) {
      const num = parseFloat(tok);
      // px/em 등 단위 포함 또는 순수 숫자
      if (!isNaN(num) && /^-?[\d.]+(px|em|rem)?$/.test(tok)) {
        numericParts.push(num);
      } else {
        // 이미 색상 토큰이 있으면 공백으로 이어붙임 (oklch 등 multi-token 색상 대비)
        colorToken += (colorToken ? " " : "") + tok;
      }
    }

    const offsetX = numericParts[0] ?? 0;
    const offsetY = numericParts[1] ?? 0;
    const blurRadius = numericParts[2] ?? 0;
    const sigma = blurRadius > 0 ? blurRadius / 2.355 : 0;

    // 색상: cssColorToHex → colorIntToFloat32, alpha는 cssColorToAlpha에서 별도 추출
    let color: Float32Array;
    if (colorToken) {
      const hex = cssColorToHex(colorToken, 0x000000);
      const alpha = cssColorToAlpha(colorToken);
      color = colorIntToFloat32(hex, alpha);
    } else {
      // CSS 스펙: color 생략 시 currentColor (렌더러에서 원본 텍스트 색상 상속)
      // 파싱 단계에서는 불투명 검정으로 fallback
      color = Float32Array.of(0, 0, 0, 1);
    }

    return { offsetX, offsetY, sigma, color };
  });
}

/**
 * CSS text-decoration-line 문자열 → CanvasKit DecorationStyle 비트마스크
 *
 * CanvasKit 비트마스크: underline=1, overline=2, lineThrough=4
 * CSS 문자열은 공백 구분 (예: "underline overline", "line-through underline")
 *
 * 반환값 0 = 데코레이션 없음 (none 포함)
 */
export function parseTextDecoration(decoration: string | undefined): number {
  if (!decoration || decoration === "none") return 0;
  const lower = decoration.toLowerCase();
  return (
    (lower.includes("underline") ? 1 : 0) |
    (lower.includes("overline") ? 2 : 0) |
    (lower.includes("line-through") ? 4 : 0)
  );
}

/**
 * CSS text-decoration-color 문자열 → Float32Array(RGBA 0~1)
 *
 * colord 기반 파싱. 잘못된 문자열은 undefined 반환.
 */
export function parseDecorationColor(
  colorStr: string | undefined,
): Float32Array | undefined {
  if (!colorStr) return undefined;
  const parsed = colord(colorStr);
  if (!parsed.isValid()) return undefined;
  const rgba = parsed.toRgb();
  return Float32Array.of(rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
}

export default convertStyle;
