/**
 * Color Math Utilities
 *
 * 렌더러와 무관한 색상 계산 로직을 순수 TypeScript 함수로 제공.
 *
 * @since 2026-02-17 Phase 0
 */

// ============================================
// Color Channel Extraction
// ============================================

/**
 * 0xRRGGBB hex 값에서 R, G, B 채널 추출
 */
export function extractRGB(color: number): { r: number; g: number; b: number } {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

/**
 * R, G, B 채널을 0xRRGGBB hex 값으로 합성
 */
export function composeRGB(r: number, g: number, b: number): number {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return (cr << 16) | (cg << 8) | cb;
}

// ============================================
// Color Adjustment Functions
// ============================================

/**
 * 색상 밝기 조절 (factor 곱)
 *
 * factor < 1: 어둡게, factor > 1: 밝게
 *
 * @param color - 0xRRGGBB hex 색상
 * @param factor - 밝기 배율 (0~2, 기본: 1.0 = 변화 없음)
 * @returns 조정된 0xRRGGBB hex 색상
 *
 * @example
 * adjustColor(0x3b82f6, 0.9)  // 약간 어둡게
 * adjustColor(0x3b82f6, 1.1)  // 약간 밝게
 */
export function adjustColor(color: number, factor: number): number {
  const { r, g, b } = extractRGB(color);
  return composeRGB(r * factor, g * factor, b * factor);
}

/**
 * 검정색과 혼합 (mixWithBlack)
 *
 * pressed 상태 등에서 사용: color를 amount만큼 검정에 가깝게.
 *
 * @param color - 0xRRGGBB hex 색상
 * @param amount - 혼합 비율 (0 = 원색, 1 = 완전 검정)
 * @returns 혼합된 0xRRGGBB hex 색상
 */
export function mixWithBlack(color: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const { r, g, b } = extractRGB(color);
  return composeRGB(r * (1 - t), g * (1 - t), b * (1 - t));
}

/**
 * 흰색과 혼합 (mixWithWhite)
 *
 * hover 상태 등에서 사용: color를 amount만큼 흰색에 가깝게.
 *
 * @param color - 0xRRGGBB hex 색상
 * @param amount - 혼합 비율 (0 = 원색, 1 = 완전 흰색)
 * @returns 혼합된 0xRRGGBB hex 색상
 */
export function mixWithWhite(color: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const { r, g, b } = extractRGB(color);
  return composeRGB(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/**
 * 두 색상 선형 보간 (lerp)
 *
 * @param colorA - 시작 색상 (t=0)
 * @param colorB - 끝 색상 (t=1)
 * @param t - 보간 비율 (0~1)
 * @returns 보간된 0xRRGGBB hex 색상
 */
export function lerpColor(colorA: number, colorB: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const a = extractRGB(colorA);
  const b = extractRGB(colorB);
  return composeRGB(
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped,
  );
}

/**
 * Hover/Pressed 색상 계산 (inline backgroundColor 기반)
 *
 * inline background color에서 hover/pressed 색상을 자동 계산하는 패턴.
 *
 * @param baseColor - 기본 배경색 (0xRRGGBB)
 * @param hoverDelta - hover 시 밝기 증가량 (기본: 0x151515)
 * @param pressDelta - pressed 시 밝기 감소량 (기본: 0x151515)
 * @returns { hover, pressed } 색상
 */
export function deriveHoverPressedColors(
  baseColor: number,
  hoverDelta: number = 0x151515,
  pressDelta: number = 0x151515,
): { hover: number; pressed: number } {
  return {
    hover: Math.min(baseColor + hoverDelta, 0xffffff),
    pressed: Math.max(baseColor - pressDelta, 0x000000),
  };
}
