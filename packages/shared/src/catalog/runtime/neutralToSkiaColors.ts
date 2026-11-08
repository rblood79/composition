/**
 * Tone preset 이름 (ADR-302 사용자 결정 7 — 이름 5 유지).
 *
 * Tone 의 사다리 · 역할 색은 ADR-302 사다리 생성 (`ladderGenerate.ts` — 값은 Spectrum gray 사다리 모양을 각
 * 이름의 (c, h) 로 옮긴 것, `neutral` 은 Spectrum gray 그대로) 이 만든다. Tailwind 단계 (`--color-neutral-N`)
 * 는 테마가 덮지 않는다 — 팔레트 (ADR-191) 일 뿐이다.
 *
 * @see ADR-021 Phase B
 */

export type NeutralPreset = "slate" | "gray" | "zinc" | "neutral" | "stone";

/** Themes 패널 표시 순서 · 전수 검사 목록. */
export const NEUTRAL_PRESETS: readonly NeutralPreset[] = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
];
