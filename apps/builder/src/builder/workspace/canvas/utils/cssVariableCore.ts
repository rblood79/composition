/**
 * CSS Variable Core (ADR-035 Phase 6)
 *
 * CSS 변수 읽기, 캐시, 색상 변환 기초 유틸리티.
 * cssVariableReader.ts에서 추출된 핵심 모듈.
 */

import { cssColorToRgbNumber } from "../../../../utils/color";
import { oklchToHex } from "../../../../utils/theme/oklchToHex";

// ============================================
// CSS Variable Reading + Cache
// ============================================

/**
 * M-4: CSS 변수 메모리 캐시
 *
 * getComputedStyle()은 매 호출마다 레이아웃 스타일 재계산을 트리거할 수 있다.
 * 동일 프레임/렌더 사이클 내에서 같은 변수를 반복 조회하는 비용을 제거한다.
 * 테마 전환 시 invalidateCSSVariableCache()로 무효화한다.
 */
const cssVarCache = new Map<string, string>();

/**
 * M-4: CSS 변수 캐시 무효화
 *
 * 테마 전환, 페이지 전환, 또는 Preview iframe 교체 시 호출한다.
 */
export function invalidateCSSVariableCache(): void {
  cssVarCache.clear();
}

/**
 * CSS 변수 값을 읽어옴 (M-4: 캐시 적용)
 */
export function getCSSVariable(name: string): string {
  const cached = cssVarCache.get(name);
  if (cached !== undefined) return cached;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  cssVarCache.set(name, value);
  return value;
}

/**
 * W3-7: DOM에서 CSS 변수를 조회하는 fallback 함수 (M-4: 캐시 적용)
 */
export function resolveVariableFromDOM(varName: string): string {
  if (typeof document === "undefined") return "";
  return getCSSVariable(varName);
}

// ============================================
// Color Conversion
// ============================================

/**
 * CSS 색상 문자열을 hex 숫자로 변환
 */
export function cssColorToHex(color: string, fallback: number): number {
  if (!color) return fallback;

  if (color.startsWith("color-mix")) {
    return resolveColorMix(color, fallback);
  }

  // ADR-191: DOM 에서 읽는 토큰(--border / --fg-muted / --bg …)이 tailwindcss/theme.css 파생 oklch 로 온다.
  // colord 는 oklch 를 모르므로 (App.css 시절부터 상시 fallback 이던 기존 결함) 여기서 직접 sRGB 로 내린다.
  const oklch = parseOklchColor(color);
  if (oklch) {
    return cssColorToRgbNumber(oklchToHex(...oklch), fallback);
  }

  return cssColorToRgbNumber(color, fallback);
}

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+|none)(?:\s*\/\s*[^)]+)?\s*\)$/i;

/**
 * `oklch(L C H [/ alpha])` → [l(0~1), c, h]. CSS Color 4 의 `none` 성분은 0.
 * 알파는 채널 변환에 무관하므로 버린다 (`cssColorToAlpha` 별도 경로).
 */
function parseOklchColor(color: string): [number, number, number] | null {
  const m = OKLCH_PATTERN.exec(color.trim());
  if (!m) return null;
  const l = m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
  const c = m[4] === "%" ? (Number(m[3]) / 100) * 0.4 : Number(m[3]);
  const h = m[5].toLowerCase() === "none" ? 0 : Number(m[5]);
  if ([l, c, h].some(Number.isNaN)) return null;
  return [l, c, h];
}

/**
 * color-mix() 값을 실제 색상으로 변환
 */
function resolveColorMix(colorMix: string, fallback: number): number {
  try {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = colorMix;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    const computedColor = getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);

    return cssColorToHex(computedColor, fallback);
  } catch {
    return fallback;
  }
}

/**
 * 색상을 어둡게 (black과 mix)
 * @param color hex 색상
 * @param percent 원본 색상 비율 (92 = 92% 원본 + 8% black)
 */
export function mixWithBlack(color: number, percent: number): number {
  const ratio = percent / 100;
  const r = Math.round(((color >> 16) & 0xff) * ratio);
  const g = Math.round(((color >> 8) & 0xff) * ratio);
  const b = Math.round((color & 0xff) * ratio);
  return (r << 16) | (g << 8) | b;
}

/**
 * 색상을 밝게 (white와 mix)
 * @param color hex 색상
 * @param percent primary 색상 비율 (8 = 8% primary + 92% white)
 */
export function mixWithWhite(color: number, percent: number): number {
  const ratio = percent / 100;
  const whiteRatio = 1 - ratio;
  const r = Math.round(((color >> 16) & 0xff) * ratio + 255 * whiteRatio);
  const g = Math.round(((color >> 8) & 0xff) * ratio + 255 * whiteRatio);
  const b = Math.round((color & 0xff) * ratio + 255 * whiteRatio);
  return (r << 16) | (g << 8) | b;
}

/**
 * CSS 변수에서 px 값 파싱
 * rem → px 변환 (1rem = 16px 기준)
 */
export function parseCSSValue(value: string, fallback: number): number {
  if (!value) return fallback;

  const trimmed = value.trim();

  if (trimmed.endsWith("px")) {
    return parseFloat(trimmed) || fallback;
  }

  if (trimmed.endsWith("rem")) {
    const remValue = parseFloat(trimmed);
    return remValue ? remValue * 16 : fallback;
  }

  const num = parseFloat(trimmed);
  return isNaN(num) ? fallback : num;
}
