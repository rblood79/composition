/**
 * 프리셋 반응형 정의 ↔ 저장 형식 변환 (ADR-168 Phase 2).
 *
 * 두 형태가 있다:
 *   - **작성 형태** `ResponsiveStyleSet` — `{ tablet: { width: 200 }, mobile: {…} }`
 *     프리셋 정의를 읽을 때 "이 breakpoint 에서 이렇게 된다" 가 한눈에 보인다.
 *   - **저장 형태** `ElementResponsiveConfig` — `{ styles: { width: { tablet: 200 } } }`
 *     ADR-154 가 정한 canonical 1차 필드 구조. resolve/CSS 경로가 이 형태를 읽는다.
 *
 * 여기서 전치한다. 순수 함수이며 store 를 모른다 — 호출부(`usePresetApply`)가 write 를 맡는다.
 */

import type { ElementResponsiveConfig } from "@composition/shared";

import { PRESET_RESPONSIVE_OWNED_KEYS } from "./presetStyle";
import type { ResponsiveStyleSet } from "./types";

/** desktop 은 base 가 담당하므로 override 대상은 둘뿐 (`responsiveCss` 와 동일 목록) */
const OVERRIDE_BREAKPOINTS = ["tablet", "mobile"] as const;

type StyleMap = Record<string, Record<string, unknown>>;

/** `ElementResponsiveConfig.styles` 를 generic map 으로 본다 (키가 열려 있음) */
function readStyles(
  config: ElementResponsiveConfig | undefined,
): StyleMap | undefined {
  return config?.styles as StyleMap | undefined;
}

function toConfig(
  styles: StyleMap,
  visibility: ElementResponsiveConfig["visibility"],
): ElementResponsiveConfig | undefined {
  const hasStyles = Object.keys(styles).length > 0;
  const hasVisibility = visibility && Object.keys(visibility).length > 0;
  if (!hasStyles && !hasVisibility) return undefined;

  const next: ElementResponsiveConfig = {};
  if (hasStyles) {
    next.styles = styles as unknown as ElementResponsiveConfig["styles"];
  }
  if (hasVisibility) next.visibility = visibility;
  return next;
}

/**
 * 작성 형태 → 저장 형태 전치.
 *
 * 빈 결과는 `undefined` 다 — canonical 이 빈 config 를 생략과 동일하게 취급하므로
 * (`canonicalMutations` 가 빈 styles/visibility 를 아예 싣지 않는다) 형태를 맞춘다.
 */
export function toResponsiveConfig(
  set: ResponsiveStyleSet | undefined,
): ElementResponsiveConfig | undefined {
  if (!set) return undefined;

  const styles: StyleMap = {};
  for (const breakpoint of OVERRIDE_BREAKPOINTS) {
    const declaration = set[breakpoint];
    if (!declaration) continue;

    for (const [key, value] of Object.entries(declaration)) {
      // undefined 는 "선언하지 않음" 과 같다 — 실으면 resolve 가 빈 override 를 본다
      if (value === undefined) continue;
      (styles[key] ??= {})[breakpoint] = value;
    }
  }

  return toConfig(styles, undefined);
}

/**
 * 프리셋 교체 시 responsive override 를 갱신한다 (R1 — 멱등).
 *
 * 이전 프리셋이 심은 키를 걷어낸 뒤 새 프리셋 값을 얹는다. 정리 대상은
 * {@link PRESET_RESPONSIVE_OWNED_KEYS} 로, base 정리와 **같은 상수에서 파생**된다.
 * `visibility` 는 프리셋 소관이 아니라 그대로 통과시킨다.
 *
 * @param existing 현재 element 의 `responsive`
 * @param presetConfig 새 프리셋의 저장 형태 override (없으면 정리만)
 */
export function mergePresetResponsive(
  existing: ElementResponsiveConfig | undefined,
  presetConfig: ElementResponsiveConfig | undefined,
): ElementResponsiveConfig | undefined {
  const existingStyles = readStyles(existing);
  const styles: StyleMap = {};

  for (const [key, value] of Object.entries(existingStyles ?? {})) {
    if (PRESET_RESPONSIVE_OWNED_KEYS.has(key)) continue;
    styles[key] = { ...value };
  }

  for (const [key, value] of Object.entries(readStyles(presetConfig) ?? {})) {
    styles[key] = { ...value };
  }

  return toConfig(styles, existing?.visibility);
}

export default toResponsiveConfig;
