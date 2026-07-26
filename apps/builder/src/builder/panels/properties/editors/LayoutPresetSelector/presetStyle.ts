import type { CSSProperties } from "react";
import {
  PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS,
  isResponsiveEligibleStyleProp,
} from "@composition/shared";

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
 * 프리셋이 소유하는 **responsive override** 키 (ADR-168 R1).
 *
 * base 정리와 responsive 정리는 반드시 **같은 상수에서 파생**돼야 한다. 두 목록이 갈리는
 * 순간 교체가 한쪽만 정리하고 다른 쪽을 남겨 비멱등이 된다 — Holy Grail 위에 이전 프리셋의
 * tablet 트랙이 얹히는 식이다.
 *
 * base 컨테이너 키(`display`/`flexDirection`)까지 포함하는 이유: mobile override 의 본체가
 * `display: grid → flex` + `flexDirection: column` 이라 컨테이너 키야말로 프리셋이 BP 별로
 * 심는 값이다. 그 대가로 사용자가 같은 키를 BP 별로 손댄 값도 교체 시 정리되는데, 이는 base 쪽
 * `stripPresetContainerStyle` 이 이미 받아들인 것과 같은 절충이다.
 *
 * base 키 중 **eligible 이 아닌 것은 제외**한다 (`gridAutoFlow`/`gridAutoColumns`/
 * `gridAutoRows`). eligible 이 아니면 애초에 responsive 에 저장될 수 없으므로 — write 라우팅이
 * base 로 보내고 `clearNonEligibleResponsiveOverrides` 가 지운다 — 정리 대상이 될 수 없다.
 * 나중에 이 키들이 BP 별로 필요해지면 `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS` 에 추가되고
 * 여기로 자동 유입된다. 두 목록을 따로 손댈 일이 없다.
 */
export const PRESET_RESPONSIVE_OWNED_KEYS: ReadonlySet<string> =
  new Set<string>([
    ...PRESET_OWNED_CONTAINER_KEYS.filter(isResponsiveEligibleStyleProp),
    ...PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS,
  ]);

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
