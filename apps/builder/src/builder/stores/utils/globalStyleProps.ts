import type { ElementResponsiveConfig } from "@composition/shared";

/**
 * 전역(breakpoint 무관) 시각 스타일 속성 — 배경(fills, `node.fills[]`)과 동일 취급.
 *
 * border 색/스타일/너비는 ADR-154 responsive breakpoint 시스템의 **예외**로, 어느 breakpoint
 * 에서 편집하든 base `props.style` 에 저장되어 모든 breakpoint 에 적용된다.
 *
 * **Why (2026-07-22 사용자 보고)**: border 를 per-breakpoint responsive override
 * (`responsive.styles`) 로 저장하면 (a) 비-desktop @media border CSS 가 정상 렌더되지 않고
 * (b) desktop 편집=전역 / mobile 편집=해당 tier 만 이라는 비대칭이 생긴다. 사용자는 배경색처럼
 * 통일을 원했다. border 를 전역으로 두면 base 규칙(=@media 없는 기본 CSS)이 모든 breakpoint 에
 * 적용되어 응답형 border 렌더 이슈를 우회한다.
 *
 * borderRadius(형태 축)는 제외 — 사용자 요청 범위는 color/style/width.
 */
export const GLOBAL_STYLE_PROPS: ReadonlySet<string> = new Set([
  "borderColor",
  "borderStyle",
  "borderWidth",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
]);

export function isGlobalStyleProp(property: string): boolean {
  return GLOBAL_STYLE_PROPS.has(property);
}

/**
 * responsive override map 에서 전역 속성(border) 키를 전부 제거한다.
 *
 * border 가 전역으로 전환되면 `responsive.styles` 에 border 키가 남아 base 값을 특정 breakpoint
 * 에서 shadow 하면 안 된다 (기존 프로젝트의 stale override 정리 + base 우선 보장).
 *
 * @returns 변경된 config, 또는 제거 대상이 없으면 `null` (불필요한 write 회피).
 */
export function clearGlobalStyleResponsiveOverrides(
  existing: ElementResponsiveConfig | undefined,
): ElementResponsiveConfig | null {
  const existingStyles = existing?.styles as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!existingStyles) return null;

  let changed = false;
  const styles: Record<string, Record<string, unknown>> = {};
  for (const key of Object.keys(existingStyles)) {
    if (GLOBAL_STYLE_PROPS.has(key)) {
      changed = true;
      continue;
    }
    styles[key] = { ...existingStyles[key] };
  }
  if (!changed) return null;

  const next: ElementResponsiveConfig = { ...existing };
  if (Object.keys(styles).length > 0) {
    next.styles = styles as unknown as ElementResponsiveConfig["styles"];
  } else {
    delete next.styles;
  }
  return next;
}
