/**
 * Typography Tokens
 *
 * 타이포그래피 토큰 정의
 *
 * @packageDocumentation
 */

import type { TypographyTokens } from "../types/token.types";

/**
 * 폰트 크기 토큰
 */
export const typography: TypographyTokens = {
  "text-2xs": 10,
  "text-xs": 12,
  "text-sm": 14,
  "text-base": 16,
  "text-md": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
  "text-3xl": 30,
  "text-4xl": 36,
  "text-5xl": 48,
  // line-height: CSS calc(lineHeight / fontSize) 결과와 동일한 px 값
  // CSS: --text-2xs--line-height: calc(1 / 0.625) = 1.6 → 10 * 1.6 = 16
  "text-2xs--line-height": 16,
  // CSS: --text-xs--line-height: calc(1 / 0.75) ≈ 1.333 → 12 * 1.333 = 16
  "text-xs--line-height": 16,
  // CSS: --text-sm--line-height: calc(1.25 / 0.875) ≈ 1.4286 → 14 * 1.4286 = 20
  "text-sm--line-height": 20,
  // CSS: --text-base--line-height: calc(1.5 / 1) = 1.5 → 16 * 1.5 = 24
  "text-base--line-height": 24,
  // CSS: --text-lg--line-height: calc(1.75 / 1.125) ≈ 1.5556 → 18 * 1.5556 = 28
  "text-lg--line-height": 28,
  // CSS: --text-xl--line-height: calc(1.75 / 1.25) = 1.4 → 20 * 1.4 = 28
  "text-xl--line-height": 28,
  // CSS: --text-2xl--line-height: calc(2 / 1.5) ≈ 1.333 → 24 * 1.333 = 32
  "text-2xl--line-height": 32,
  // CSS: --text-3xl--line-height: calc(2.25 / 1.875) = 1.2 → 30 * 1.2 = 36
  "text-3xl--line-height": 36,
  // CSS: --text-4xl--line-height: calc(2.5 / 2.25) ≈ 1.111 → 36 * 1.111 = 40
  "text-4xl--line-height": 40,
  // CSS: --text-5xl--line-height: calc(3 / 3) = 1.0 → 48 * 1.0 = 48
  "text-5xl--line-height": 48,
};

/**
 * 폰트 패밀리
 */
export const fontFamily = {
  sans: "Pretendard, Inter, system-ui, -apple-system, sans-serif",
  mono: "JetBrains Mono, Consolas, monospace",
};

/**
 * 폰트 두께
 */
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/**
 * 줄 높이 (배수)
 */
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

/**
 * 타이포그래피 토큰 값 반환
 */
export function getTypographyToken(name: keyof TypographyTokens): number {
  return typography[name];
}

/**
 * fontSize에 대응하는 CSS line-height (px)를 반환.
 * fullTreeLayout.ts의 LABEL_SIZE_STYLE과 동일 소스.
 */
const FONT_SIZE_TO_LINE_HEIGHT: Record<number, number> = {
  10: typography["text-2xs--line-height"],
  12: typography["text-xs--line-height"],
  14: typography["text-sm--line-height"],
  16: typography["text-base--line-height"],
  18: typography["text-lg--line-height"],
  20: typography["text-xl--line-height"],
  24: typography["text-2xl--line-height"],
  30: typography["text-3xl--line-height"],
  36: typography["text-4xl--line-height"],
  48: typography["text-5xl--line-height"],
};

export function getLabelLineHeight(fontSize: number): number {
  return FONT_SIZE_TO_LINE_HEIGHT[fontSize] ?? Math.ceil(fontSize * 1.5);
}

/**
 * Text leaf line box 높이 = `1.5 × fontSize` (CSS line-height 1.5 · DOM 상속 · leaf Text 레이아웃
 * 공식 utils.ts 동일). collection item(ListBoxItem 등)의 label/description 은 **Text** leaf 로
 * authoring 되는데 Text 는 catalog per-size lineHeight 가 없어 이 1.5 모델을 따른다.
 *
 * **`getLabelLineHeight` 와 구분 (2026-07-21 사용자 보고)**: `getLabelLineHeight` 는 typography
 * 토큰 룩업(20→28 / 30→36 등, standalone Label = LABEL_SIZE_STYLE 용)이라 collection **Text**
 * label 에 쓰면 origin(실 Text 자식, 1.5)·CSS(line-height 1.5)와 어긋난다 — instance escape 만
 * 짧게(3xl 36 vs origin/CSS 45) 렌더돼 행 높이가 3경로 불일치. collection item Text line box 는
 * 반드시 이 헬퍼로 산출한다.
 */
export function getTextLineHeight(fontSize: number): number {
  return Math.ceil(fontSize * 1.5);
}

// ADR-058 Phase 4: `getTextPresetFontSize` 제거 — `buildTextNodeData` 폐지로 호출처 0건.
// Text/Heading/Paragraph/Kbd/Code는 각 spec의 `sizes` 정의를 직접 소비 (Spec-First SSOT).
