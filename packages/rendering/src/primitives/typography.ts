/**
 * Typography Tokens
 *
 * 타이포그래피 토큰 정의
 *
 * @packageDocumentation
 */

import type { TypographyTokens } from "../types/token.types";

/**
 * ADR-295 — 글자 크기 · 행간은 S2 1.8.1 style macro 의 식이다 (`@react-spectrum/s2/style/spectrum-theme.ts`):
 * 글자 = `round(base × 1.125^단계, 1px)`, 행간 = `round(fs × (1.15 + (1 − (min(32, fs) − 10) / 22) × 0.15), 2px)`.
 * 상수는 G0 추출기 (`apps/builder/scripts/adr295-s2-token-extract.mjs`) 가 설치본에서 읽은 값이고
 * `d3S2Alignment` 게이트가 대조한다. 숫자를 손으로 적지 않는다 — 단계 표 + 식이 정본.
 */
export const S2_FONT_SIZE_BASE = 14;
export const S2_FONT_RATIO = 1.125;

export function s2FontSize(step: number, base: number = S2_FONT_SIZE_BASE): number {
  return Math.round(base * S2_FONT_RATIO ** step);
}

/** CSS `round(…, 2px)` (nearest — 반은 +∞ 쪽) 과 같은 2px 반올림. */
export function s2LineHeight(fontSize: number): number {
  const ratio = 1.15 + (1 - (Math.min(32, fontSize) - 10) / 22) * 0.15;
  return Math.round((fontSize * ratio) / 2) * 2;
}

/**
 * 토큰 이름 → S2 단계. 본문 사다리 (`text-*` — S2 ui/body 단계) 와 제목 묶음 (`text-heading-*` — S2
 * heading 단계, 사용자 결정 3 「본문 + 제목 두 묶음」) 두 갈래. 이름은 유지하고 값만 S2 로 (ADR-295 Decision 5).
 */
export const TYPOGRAPHY_STEPS = {
  "text-2xs": -2,
  "text-xs": -1,
  "text-sm": 0,
  "text-base": 1,
  "text-md": 1,
  "text-lg": 2,
  "text-xl": 3,
  "text-2xl": 4,
  "text-3xl": 5,
  "text-4xl": 6,
  "text-5xl": 8,
  "text-heading-xs": 2,
  "text-heading-sm": 3,
  "text-heading-md": 4,
  "text-heading-lg": 6,
  "text-heading-xl": 8,
  "text-heading-2xl": 10,
  "text-heading-3xl": 12,
} as const;

/** 글자 · 행간 맵 — `base` 를 바꾸면 같은 단계 표로 다른 벌 (touch 17 — ADR-295 Phase 2). */
export function s2TypographyTokens(base: number = S2_FONT_SIZE_BASE): TypographyTokens {
  const out: Record<string, number> = {};
  for (const [key, step] of Object.entries(TYPOGRAPHY_STEPS)) {
    const fontSize = s2FontSize(step, base);
    out[key] = fontSize;
    if (key !== "text-md")
      out[`${key}--line-height`] = s2LineHeight(fontSize);
  }
  return out as unknown as TypographyTokens;
}

/**
 * 폰트 크기 · 행간 토큰 (desktop, base 14).
 */
export const typography: TypographyTokens = s2TypographyTokens();

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
 * fontSize 의 줄 상자 (px) — S2 행간 식 (ADR-295 Phase 3, 사용자 결정 2). 본문 토큰의 행간과 같은 식이라 이름
 * 없는 글자 크기 (rule 리터럴 · 명시 테마 값) 도 같은 값이다.
 * (옛 builder `fullTreeLayout.ts` 의 LABEL_SIZE_STYLE 과 같은 소스였다 — 2026-10-05 삭제.)
 */
export function getLabelLineHeight(fontSize: number): number {
  return s2LineHeight(fontSize);
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

/**
 * Collection item **description** slot 의 line box 높이 = `4/3 × fontSize` (≈1.333, xs 비율).
 *
 * ListBox `[slot="description"]` CSS 는 `line-height: var(--lb-desc-line-height, var(--text-xs))`
 * 로 desc 를 **1.333× 고정 비율**로 렌더한다 (label 의 react-aria-Text 기본 1.5× 와 대조).
 * 라이브 실측 (2026-07-22, preview iframe DOM 주입): fs 12→16 / 14→18.67 / 20→26.67 / 24→32 —
 * 모두 `fontSize × 4/3`. `getTextLineHeight`(1.5×) 도 `getLabelLineHeight`(typography 토큰,
 * sm 14→20) 도 이 비율과 어긋나므로 (14 에서 18.67 vs 21 vs 20), description 전용 헬퍼로 분리한다.
 * label 은 slot CSS override 가 없어 1.5× (`getTextLineHeight`) 유지.
 */
export function getDescriptionLineHeight(fontSize: number): number {
  return Math.ceil((fontSize * 4) / 3);
}

// ADR-058 Phase 4: `getTextPresetFontSize` 제거 — `buildTextNodeData` 폐지로 호출처 0건.
// Text/Heading/Paragraph/Kbd/Code는 각 spec의 `sizes` 정의를 직접 소비 (Spec-First SSOT).
