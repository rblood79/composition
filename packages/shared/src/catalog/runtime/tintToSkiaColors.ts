/**
 * Tint 프리셋 → accent 축 입력 (ADR-302).
 *
 * tint 프리셋 (또는 사용자 hex) 은 (chroma, hue) 만 정한다 — accent 사다리는 Spectrum blue 사다리의 모양을
 * 그 (c, h) 로 옮긴 생성값 (`ladderGenerate.ts`, lazy chunk) 이고, 역할 값은 alias 표가 그 사다리에서 읽는다
 * (`resolveThemeSnapshot`). 기본 tint (blue) 는 Spectrum 사다리 그대로.
 *
 * @see ADR-021 Phase A · ADR-290 (역할 둘 — 탐색은 ADR-302 로 대체) · ADR-302
 */

// ============================================================================
// Tint 프리셋 정의 (preview-system.css 기준)
// ============================================================================

export type TintPreset =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "turquoise"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

interface TintValue {
  /** oklch hue (0~360) */
  h: number;
  /** oklch chroma (0~0.4) */
  c: number;
}

/** oklch (C H) — preview-system.css 의 `--<tint>` 와 같은 값 (accent 축의 생성 입력). */
export const TINT_PRESETS: Record<TintPreset, TintValue> = {
  red: { h: 27.0726, c: 0.181447 },
  orange: { h: 54, c: 0.150492 },
  yellow: { h: 73.8032, c: 0.128516 },
  green: { h: 155.372, c: 0.121276 },
  turquoise: { h: 205.114, c: 0.081146 },
  cyan: { h: 243.926, c: 0.142107 },
  blue: { h: 266.315, c: 0.22049 },
  indigo: { h: 284.23, c: 0.25049 },
  purple: { h: 302, c: 0.223324 },
  pink: { h: 347.813, c: 0.177717 },
};

/**
 * `accent-content` (바탕 위 글자 · 선 · 채움) 가 놓이는 바탕 — catalog rule 에서 유도한 집합 (ADR-290 §5).
 * 글자가 놓이는 바탕은 4.5, 선 · 채움만 놓이는 바탕은 3.0. 배경이 투명한 자리 (outline · Link) 는
 * 컨테이너 surface 전부. `accentContentBackdrops.static.test.ts` 가 rule 과 대조한다.
 */
export const ACCENT_CONTENT_TEXT_BACKDROPS = [
  "base",
  "layer-1",
  "layer-2",
  "elevated",
  "accent-subtle",
] as const;
export const ACCENT_CONTENT_GRAPHIC_BACKDROPS = ["neutral-subtle"] as const;
