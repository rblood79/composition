/**
 * 저장된 box-shadow 리터럴 ↔ 그림자 프리셋 역매핑 (ADR-166 후속, 2026-07-25).
 *
 * ## 왜 필요한가
 *
 * catalog 기본값은 `{shadow.md}` TokenRef 라 두 소비자가 각자 theme 으로 푼다. 반면
 * **스타일 패널이 기록하는 inline 값은 리터럴 CSS 문자열**이다 — 사용자가 Box Shadow
 * 프리셋을 고르면 그 순간의 값이 그대로 `props.style.boxShadow` 에 박힌다. 저장 형식이
 * 리터럴이면 theme 정보가 소실되므로, dark 캔버스에서 고른 그림자도 light 값으로 고정되고
 * light 에서 고른 뒤 dark 로 바꿔도 따라오지 않는다.
 *
 * 저장 형식을 `var(--shadow-md)` 로 바꾸는 안은 기각했다 — CSS var 치환은 계산값 시점이라
 * `inset var(--shadow-md)` 가 **3레이어 중 첫 레이어에만** inset 을 걸고, dirty/reset baseline
 * (`resolveAppearanceSpecPreset` 이 리터럴을 낸다)과도 어긋나며, 이미 저장된 프로젝트는
 * 구제되지 않는다. 대신 **저장은 리터럴 그대로 두고 읽는 쪽에서 프리셋으로 되돌린다**:
 * 기존 데이터가 마이그레이션 없이 함께 고쳐지고 inset 축도 손대지 않는다.
 *
 * ## 소비자별 출력이 다른 이유
 *
 * | 소비자 | 함수                        | 출력                  | 근거                                   |
 * | ------ | --------------------------- | --------------------- | -------------------------------------- |
 * | Skia   | `normalizeShadowForTheme`   | 해당 theme 리터럴     | 렌더 시점에 theme 을 이미 알고 있다    |
 * | DOM    | `shadowLiteralToCssVar`     | `var(--shadow-{key})` | theme 배선 없이 CSS 가 알아서 전환한다 |
 *
 * DOM 이 var 를 쓸 수 있는 것은 preview iframe(`preview.html`)과 publish 가 둘 다
 * `theme.css → preview-system.css` 를 로드하고 dark 블록이 `[data-theme="dark"]` 로 갈리기
 * 때문이다. 빌더 chrome 의 `App.css` 는 같은 이름을 **다른 값**(Tailwind 스케일)으로 재정의하지만
 * preview iframe 은 그 파일을 로드하지 않아 새지 않는다.
 *
 * ## 적용 범위 — elevation 3단계 · inset 미적용 값만
 *
 * `sm`/`md`/`lg` 의 inset 없는 형태만 정규화한다. 나머지는 원문 그대로 통과시킨다:
 *
 * - `none` / `inset` 프리셋과 **inset 토글이 켜진 값**: CSS 변수가 `--shadow-{sm,md,lg}` 3개뿐이라
 *   DOM 이 var 로 낼 수단이 없다. Skia 만 theme 을 따라가면 두 소비자가 서로 다른 그림자를
 *   그리므로(대칭 파손) 양쪽 다 건드리지 않는다 — 현행 동작 유지라 회귀도 없다.
 * - 사용자가 붙여넣은 임의 CSS: 프리셋이 아니므로 매칭되지 않는다.
 *
 * inset 축까지 theme 을 따르게 하려면 `--shadow-inset` 계열 CSS 변수 신설이 선행돼야 한다.
 * 재개 조건 = inset + 프리셋 조합의 dark 사용이 실제로 문제화될 때.
 *
 * @packageDocumentation
 */

import type { ShadowTokens } from "../types/token.types";
import { darkShadows, getShadowToken, lightShadows } from "./shadows";

export type ShadowPresetKey = keyof ShadowTokens;

/**
 * CSS 변수(`--shadow-*`)가 존재하는 키 — DOM var 경로의 적용 범위.
 * `preview-system.css` 가 발행하는 3개와 1:1. 여기 없는 키는 var 로 낼 수 없다.
 */
const CSS_VAR_PRESET_KEYS: ReadonlySet<string> = new Set(["sm", "md", "lg"]);

/**
 * 레이어 단위 변환 — 쉼표 split 시 `rgba(...)` 내부 쉼표는 건너뛴다.
 * `parseShadow` / 패널의 분해 regex 와 동일 규칙.
 */
export function mapShadowLayers(
  cssValue: string,
  fn: (bareLayer: string) => string,
): string {
  return cssValue
    .split(/,(?![^(]*\))/)
    .map((part) => fn(part.trim().replace(/^inset\s+/, "")))
    .join(", ");
}

/** 모든 레이어에서 `inset` 키워드 제거. */
export function stripShadowInset(cssValue: string): string {
  return mapShadowLayers(cssValue, (bare) => bare);
}

/** 모든 레이어에 `inset` 키워드 부착. */
export function applyShadowInset(cssValue: string): string {
  return mapShadowLayers(cssValue, (bare) => `inset ${bare}`);
}

/**
 * 리터럴 → 프리셋 키 역매핑. light 를 먼저 넣어 두 theme 값이 같은 키(`none`)에서 light 가 남는다.
 * 값 자체가 키이므로 theme 과 무관하게 같은 프리셋으로 수렴한다.
 */
let _reverseMap: Map<string, ShadowPresetKey> | null = null;

function reverseMap(): Map<string, ShadowPresetKey> {
  if (!_reverseMap) {
    _reverseMap = new Map();
    for (const source of [lightShadows, darkShadows]) {
      for (const [key, value] of Object.entries(source)) {
        if (!_reverseMap.has(value))
          _reverseMap.set(value, key as ShadowPresetKey);
      }
    }
  }
  return _reverseMap;
}

/**
 * 저장된 CSS 값이 알려진 그림자 프리셋인지 판정한다.
 *
 * `insetApplied` 는 **inset 토글로 덧씌워진 형태**를 뜻한다 (`inset` 프리셋 키 자체와 구분).
 * 정확 일치를 먼저 보므로 `inset` 프리셋은 `insetApplied: false` 로 잡힌다.
 */
export function matchShadowPreset(
  cssValue: string,
): { key: ShadowPresetKey; insetApplied: boolean } | null {
  if (typeof cssValue !== "string" || cssValue === "") return null;

  const map = reverseMap();
  const exact = map.get(cssValue);
  if (exact) return { key: exact, insetApplied: false };

  const stripped = stripShadowInset(cssValue);
  if (stripped === cssValue) return null;
  const viaStrip = map.get(stripped);
  return viaStrip ? { key: viaStrip, insetApplied: true } : null;
}

/** 정규화 대상인가 — elevation 3단계(sm/md/lg) 이고 inset 토글이 꺼진 값. */
function normalizableKey(cssValue: string): ShadowPresetKey | null {
  const match = matchShadowPreset(cssValue);
  if (!match || match.insetApplied) return null;
  return CSS_VAR_PRESET_KEYS.has(match.key) ? match.key : null;
}

/**
 * Skia 경로 — 저장된 프리셋 리터럴을 현재 theme 의 리터럴로 되돌린다.
 * 프리셋이 아니거나 적용 범위 밖이면 원문 그대로 (사용자가 붙여넣은 임의 CSS 보존).
 */
export function normalizeShadowForTheme(
  cssValue: string,
  theme: "light" | "dark",
): string {
  const key = normalizableKey(cssValue);
  return key ? getShadowToken(key, theme) : cssValue;
}

/**
 * DOM 경로 — 저장된 프리셋 리터럴을 CSS 변수 참조로 바꾼다. theme 인자가 필요 없다.
 * 프리셋이 아니거나 적용 범위 밖이면 원문 그대로.
 */
export function shadowLiteralToCssVar(cssValue: string): string {
  const key = normalizableKey(cssValue);
  return key ? `var(--shadow-${key})` : cssValue;
}
