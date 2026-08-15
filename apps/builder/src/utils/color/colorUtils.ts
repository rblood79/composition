/**
 * Color Utilities - colord 기반 색상 파싱/변환
 *
 * CSS Color Level 4 지원, 안정적인 색상 처리
 * - 다양한 색상 형식 파싱 (hex, rgb, hsl, named colors)
 * - 형식 간 변환
 * - 색상 조작 (밝기, 채도 등)
 *
 * @example
 * import { parseColor, formatColor, isValidColor } from '@/utils/color';
 *
 * const color = parseColor('#ff0000');
 * if (color) {
 *   console.log(color.hsl); // { h: 0, s: 100, l: 50, a: 1 }
 *   console.log(formatColor(color, 'rgb')); // 'rgb(255, 0, 0)'
 * }
 *
 * @since 2025-12-20 Phase 1 - Quick Wins
 */

import {
  colord,
  extend,
  type Colord,
  type RgbaColor,
  type HslaColor,
} from "colord";
import namesPlugin from "colord/plugins/names";
import hwbPlugin from "colord/plugins/hwb";
import labPlugin from "colord/plugins/lab";
import mixPlugin from "colord/plugins/mix";
import a11yPlugin from "colord/plugins/a11y";
import type { ColorValueHSL, ColorValueRGB } from "../../types/theme";

// CSS Color Level 4 지원 및 색상 조작/접근성을 위한 플러그인 확장
extend([namesPlugin, hwbPlugin, labPlugin, mixPlugin, a11yPlugin]);

// ============================================
// Types
// ============================================

export interface ParsedColor {
  /** 원본 입력값 */
  original: string;

  /** colord 인스턴스 */
  instance: Colord;

  /** HEX 형식 (#RRGGBB 또는 #RRGGBBAA) */
  hex: string;

  /** RGB 값 */
  rgb: RgbaColor;

  /** HSL 값 */
  hsl: HslaColor;

  /** 알파 값 (0-1) */
  alpha: number;

  /** 밝은 색상 여부 */
  isLight: boolean;

  /** 어두운 색상 여부 */
  isDark: boolean;

  /** 투명 색상 여부 */
  isTransparent: boolean;
}

export type ColorFormat = "hex" | "rgb" | "rgba" | "hsl" | "hsla";

// ============================================
// Core Functions
// ============================================

/**
 * 색상 문자열 파싱
 *
 * @param value - CSS 색상 값 (hex, rgb, hsl, named color 등)
 * @returns 파싱된 색상 정보 또는 null (유효하지 않은 경우)
 */
export function parseColor(
  value: string | null | undefined,
): ParsedColor | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const color = colord(trimmed);

    if (!color.isValid()) {
      return null;
    }

    const rgb = color.toRgb();
    const hsl = color.toHsl();

    return {
      original: trimmed,
      instance: color,
      hex: color.toHex(),
      rgb,
      hsl,
      alpha: color.alpha(),
      isLight: color.isLight(),
      isDark: color.isDark(),
      isTransparent: rgb.a === 0,
    };
  } catch {
    return null;
  }
}

/**
 * 색상 유효성 검사
 */
export function isValidColor(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    return colord(value.trim()).isValid();
  } catch {
    return false;
  }
}

/**
 * 색상을 특정 형식으로 변환
 */
export function formatColor(
  color: ParsedColor | string | null | undefined,
  format: ColorFormat,
): string {
  let parsed: ParsedColor | null;

  if (typeof color === "string") {
    parsed = parseColor(color);
  } else {
    parsed = color ?? null;
  }

  if (!parsed) {
    return "";
  }

  const { instance, rgb, hsl } = parsed;

  switch (format) {
    case "hex":
      return instance.alpha() < 1
        ? instance.toHex()
        : instance.toHex().slice(0, 7);

    case "rgb":
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    case "rgba":
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;

    case "hsl":
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;

    case "hsla":
      return `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%, ${hsl.a})`;

    default:
      return instance.toHex();
  }
}

// ============================================
// Color Manipulation
// ============================================

/**
 * 색상 밝기 조절
 *
 * @param color - 원본 색상
 * @param amount - 밝기 변화량 (-1 ~ 1, 양수: 밝게, 음수: 어둡게)
 */
export function adjustBrightness(
  color: string | ParsedColor,
  amount: number,
): string {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return "";

  if (amount > 0) {
    return parsed.instance.lighten(amount).toHex();
  } else {
    return parsed.instance.darken(Math.abs(amount)).toHex();
  }
}

/**
 * 색상 채도 조절
 *
 * @param color - 원본 색상
 * @param amount - 채도 변화량 (-1 ~ 1)
 */
export function adjustSaturation(
  color: string | ParsedColor,
  amount: number,
): string {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return "";

  if (amount > 0) {
    return parsed.instance.saturate(amount).toHex();
  } else {
    return parsed.instance.desaturate(Math.abs(amount)).toHex();
  }
}

/**
 * 알파 값 설정
 */
export function setAlpha(color: string | ParsedColor, alpha: number): string {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return "";

  return parsed.instance.alpha(Math.max(0, Math.min(1, alpha))).toHex();
}

/**
 * 보색 생성
 */
export function getComplementary(color: string | ParsedColor): string {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return "";

  return parsed.instance.rotate(180).toHex();
}

/**
 * 색상 혼합
 *
 * @param color1 - 첫 번째 색상
 * @param color2 - 두 번째 색상
 * @param ratio - 혼합 비율 (0: color1, 1: color2)
 */
export function mixColors(
  color1: string | ParsedColor,
  color2: string | ParsedColor,
  ratio: number = 0.5,
): string {
  const parsed1 = typeof color1 === "string" ? parseColor(color1) : color1;
  const parsed2 = typeof color2 === "string" ? parseColor(color2) : color2;

  if (!parsed1 || !parsed2) return "";

  return parsed1.instance.mix(parsed2.instance, ratio).toHex();
}

// ============================================
// Contrast & Accessibility
// ============================================

/**
 * 대비 색상 반환 (텍스트용)
 */
export function getContrastColor(
  backgroundColor: string | ParsedColor,
): string {
  const parsed =
    typeof backgroundColor === "string"
      ? parseColor(backgroundColor)
      : backgroundColor;

  if (!parsed) return "#000000";

  return parsed.isLight ? "#000000" : "#FFFFFF";
}

/**
 * 두 색상 간 대비율 계산 (WCAG)
 */
export function getContrastRatio(
  color1: string | ParsedColor,
  color2: string | ParsedColor,
): number {
  const parsed1 = typeof color1 === "string" ? parseColor(color1) : color1;
  const parsed2 = typeof color2 === "string" ? parseColor(color2) : color2;

  if (!parsed1 || !parsed2) return 1;

  return parsed1.instance.contrast(parsed2.instance);
}

/**
 * WCAG AA 기준 충족 여부 (일반 텍스트: 4.5:1, 큰 텍스트: 3:1)
 */
export function meetsWCAG_AA(
  foreground: string | ParsedColor,
  background: string | ParsedColor,
  isLargeText: boolean = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= (isLargeText ? 3 : 4.5);
}

// ============================================
// Color Extraction
// ============================================

/**
 * RGB 개별 값 추출
 */
export function extractRGB(
  color: string | ParsedColor,
): { r: number; g: number; b: number } | null {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return null;

  const { r, g, b } = parsed.rgb;
  return { r, g, b };
}

/**
 * HSL 개별 값 추출
 */
export function extractHSL(
  color: string | ParsedColor,
): { h: number; s: number; l: number } | null {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  if (!parsed) return null;

  const { h, s, l } = parsed.hsl;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

// ============================================
// Canvas 색상 변환 (숫자 형식)
// ============================================

/**
 * CSS 색상을 `0xRRGGBB` 숫자로 변환한다 (알파 제외 — 알파는 `cssColorToAlpha`).
 *
 * 캔버스 렌더 경로가 색을 숫자로 다루기 때문에 필요한 기본 변환기다.
 * oklch / lab / `currentColor` 해석까지 필요하면 이 위에 얹힌
 * `styleConversion/styleConverter.ts::cssColorToHex` 를 쓸 것.
 *
 * 🚀 Phase 22: colord 기반으로 통합
 * - 기존 직접 파싱 대비 더 많은 색상 형식 지원
 * - hex, rgb, rgba, hsl, hsla, named colors 모두 지원
 *
 * 구 이름은 `cssColorToPixiHex` 였다 — 출력은 렌더러와 무관한 RGB 숫자이고
 * 실제 소비처도 Skia 경로다 (2026-08-15 정정).
 *
 * @param color - CSS 색상 값
 * @param fallback - 파싱 실패 시 반환할 기본값 (0xRRGGBB)
 * @returns 0xRRGGBB 숫자
 */
export function cssColorToRgbNumber(
  color: string | null | undefined,
  fallback: number,
): number {
  if (!color) return fallback;

  const parsed = parseColor(color);
  if (!parsed) return fallback;

  const { r, g, b } = parsed.rgb;
  return (r << 16) | (g << 8) | b;
}

// ============================================
// Legacy Compatibility Functions
// ============================================
// utils/theme/colorUtils.ts와 호환되는 함수들
// ColorValueHSL, ColorValueRGB 타입 기반

/**
 * HSL → RGB 변환 (레거시 호환)
 */
export function hslToRgb(hsl: ColorValueHSL): ColorValueRGB {
  const color = colord({ h: hsl.h, s: hsl.s, l: hsl.l, a: hsl.a });
  const rgb = color.toRgb();
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.a };
}

/**
 * RGB → HSL 변환 (레거시 호환)
 */
export function rgbToHsl(rgb: ColorValueRGB): ColorValueHSL {
  const color = colord({ r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.a });
  const hsl = color.toHsl();
  return {
    h: Math.round(hsl.h),
    s: Math.round(hsl.s),
    l: Math.round(hsl.l),
    a: hsl.a,
  };
}

/**
 * HEX → RGB 변환 (레거시 호환)
 */
export function hexToRgb(hex: string): ColorValueRGB | null {
  const parsed = parseColor(hex);
  if (!parsed) return null;
  const { r, g, b, a } = parsed.rgb;
  return { r, g, b, a };
}

/**
 * RGB → HEX 변환 (레거시 호환)
 */
export function rgbToHex(rgb: ColorValueRGB): string {
  const color = colord({ r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.a });
  return color.toHex().slice(0, 7); // #RRGGBB
}

/**
 * HSL → HEX 변환 (레거시 호환)
 */
export function hslToHex(hsl: ColorValueHSL): string {
  const color = colord({ h: hsl.h, s: hsl.s, l: hsl.l, a: hsl.a });
  return color.toHex().slice(0, 7); // #RRGGBB
}

/**
 * HEX → HSL 변환 (레거시 호환)
 */
export function hexToHsl(hex: string): ColorValueHSL | null {
  const parsed = parseColor(hex);
  if (!parsed) return null;
  const { h, s, l, a } = parsed.hsl;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l), a };
}

/**
 * HSL → CSS 문자열 (레거시 호환)
 */
export function hslToString(hsl: ColorValueHSL): string {
  return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})`;
}

/**
 * RGB → CSS 문자열 (레거시 호환)
 */
export function rgbToString(rgb: ColorValueRGB): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;
}

/**
 * 다크모드 색상 자동 생성 (레거시 호환)
 * - Lightness 반전 (100 - L)
 * - 채도 15% 감소
 */
export function generateDarkVariant(hsl: ColorValueHSL): ColorValueHSL {
  return {
    h: hsl.h,
    s: Math.max(0, hsl.s - 15),
    l: 100 - hsl.l,
    a: hsl.a,
  };
}

/**
 * 색상 문자열 파싱 (레거시 호환)
 */
export function parseColorString(colorString: string): ColorValueHSL | null {
  const parsed = parseColor(colorString);
  if (!parsed) return null;
  const { h, s, l, a } = parsed.hsl;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l), a };
}

/**
 * 색상 밝기 조정 (레거시 호환)
 */
export function adjustLightness(
  hsl: ColorValueHSL,
  amount: number,
): ColorValueHSL {
  return {
    ...hsl,
    l: Math.max(0, Math.min(100, hsl.l + amount)),
  };
}

/**
 * 색상 채도 조정 (레거시 호환) - HSL 타입용
 */
export function adjustSaturationHsl(
  hsl: ColorValueHSL,
  amount: number,
): ColorValueHSL {
  return {
    ...hsl,
    s: Math.max(0, Math.min(100, hsl.s + amount)),
  };
}

/**
 * 분할 보색 생성 (레거시 호환)
 */
export function getSplitComplementaryColors(
  hsl: ColorValueHSL,
): [ColorValueHSL, ColorValueHSL, ColorValueHSL] {
  const complementary = (hsl.h + 180) % 360;
  return [
    hsl,
    { ...hsl, h: (complementary - 30 + 360) % 360 },
    { ...hsl, h: (complementary + 30) % 360 },
  ];
}

// ============================================
// Convenience Exports
// ============================================

export { colord, type Colord, type RgbaColor, type HslaColor };
