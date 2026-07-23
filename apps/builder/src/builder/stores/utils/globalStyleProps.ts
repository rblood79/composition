import type { ElementResponsiveConfig } from "@composition/shared";
import { isResponsiveEligibleStyleProp } from "@composition/shared";

/**
 * 전역(breakpoint 무관) 시각 스타일 속성 판정 — ADR-154 개정 1 (2026-07-23).
 *
 * responsive-eligible(Layout·Transform 섹션 키, `RESPONSIVE_ELIGIBLE_STYLE_PROPS`) 이
 * **아닌** 모든 style prop 은 "전역"이다 — 어느 breakpoint 에서 편집하든 base `props.style`
 * 에 저장되어 전 breakpoint 에 적용된다 (배경 fills·border·radius·typography·overflow 등).
 *
 * **Why (개정 반전)**: 원안은 border 15키만 전역 예외(blocklist)로 두고 나머지 전 style prop 을
 * responsive 로 취급했으나, 예외 목록이 계속 자라고(fills→border) 편집 예측이 어려웠다. 개정은
 * 이를 반전 — Layout·Transform 만 eligible(토글 opt-in override)로 좁히고 나머지는 전역 기본.
 * `isGlobalStyleProp(p)` ≡ `!isResponsiveEligibleStyleProp(p)` 로 정의해 dirty/reset 의 "전역 →
 * base 비교" 라우팅에서 재사용한다. eligibility SSOT 는 shared `RESPONSIVE_ELIGIBLE_STYLE_PROPS`.
 */
export function isGlobalStyleProp(property: string): boolean {
  return !isResponsiveEligibleStyleProp(property);
}

/**
 * responsive override map 에서 **non-eligible(전역) 속성** 키를 전부 제거한다.
 *
 * 개정 후 non-eligible 속성은 responsive override 에 담기면 안 된다(전역이므로). base 로
 * 편집을 라우팅할 때 stale override 가 특정 breakpoint 에서 base 를 shadow 하지 않도록 정리한다
 * (기존 프로젝트의 원안-시대 override 점진 소거 + base 우선 보장, R8). eligible 키(Layout·Transform)
 * 는 토글 opt-in 의도값이므로 보존.
 *
 * @returns 변경된 config, 또는 제거 대상이 없으면 `null` (불필요한 write 회피).
 */
export function clearNonEligibleResponsiveOverrides(
  existing: ElementResponsiveConfig | undefined,
): ElementResponsiveConfig | null {
  const existingStyles = existing?.styles as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!existingStyles) return null;

  let changed = false;
  const styles: Record<string, Record<string, unknown>> = {};
  for (const key of Object.keys(existingStyles)) {
    if (!isResponsiveEligibleStyleProp(key)) {
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
