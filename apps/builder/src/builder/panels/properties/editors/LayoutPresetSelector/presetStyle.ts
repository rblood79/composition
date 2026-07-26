import type { CSSProperties } from "react";

const FRAME_BOUNDARY_MIN_HEIGHT_VALUES = new Set([
  "100vh",
  "100dvh",
  "100svh",
  "100lvh",
]);

/**
 * 프리셋이 소유하는 컨테이너 레이아웃 키.
 *
 * 프리셋을 교체하면 이전 프리셋이 심은 키가 남아 새 프리셋과 섞인다 (실측: 수직 2단 →
 * Holy Grail 적용 시 `flexDirection: "column"` 이 grid 컨테이너에 잔존). 새 프리셋의
 * `containerStyle` 에 없는 키는 지운 뒤 병합해야 교체가 멱등해진다. 사용자가 직접 준
 * 스타일(padding/background 등)은 이 목록 밖이라 보존된다.
 */
const PRESET_OWNED_CONTAINER_KEYS = [
  "display",
  "flexDirection",
  "gridTemplateAreas",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "gridAutoColumns",
  "gridAutoRows",
] as const satisfies readonly (keyof CSSProperties)[];

/**
 * 기존 컨테이너 스타일에서 프리셋 소유 키를 걷어낸다.
 *
 * @param style 현재 body 의 `props.style`
 * @returns 프리셋 소유 키가 제거된 사본 (사용자 스타일은 유지)
 */
export function stripPresetContainerStyle(
  style: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!style) return {};
  const next = { ...style };
  for (const key of PRESET_OWNED_CONTAINER_KEYS) {
    delete next[key];
  }
  return next;
}

export function normalizeFramePresetContainerStyle(
  style: CSSProperties | undefined,
): CSSProperties {
  if (!style) return {};

  const next: CSSProperties = { ...style };
  const minHeight =
    typeof next.minHeight === "string"
      ? next.minHeight.trim().toLowerCase()
      : undefined;

  if (minHeight && FRAME_BOUNDARY_MIN_HEIGHT_VALUES.has(minHeight)) {
    // Frame authoring surface is already bounded by the Page. Persisting viewport
    // min-height makes a new frame look edited and can exceed the page height.
    delete next.minHeight;
  }

  return next;
}
