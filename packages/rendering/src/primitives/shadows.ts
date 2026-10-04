/**
 * Shadow Tokens
 *
 * 그림자 토큰 정의 — **Adobe Spectrum 2 역할 토큰 기반** (ADR-166 Phase 1, 2026-07-25).
 *
 * ## 값의 출처
 *
 * 이름은 크기 축(`sm`/`md`/`lg`)을 유지하되 값은 Spectrum 2 의 역할 토큰에서 가져온다.
 * 스타일 패널이 크기 축으로 노출하고 소비처 40+곳이 이 이름을 쓰기 때문에 명명은 바꾸지
 * 않는다 — 값 정합이 목적이지 Spectrum 명명 이식이 목적이 아니다.
 *
 * | 단계 | Spectrum 2 출처        |
 * | ---- | ---------------------- |
 * | `sm` | `drop-shadow-emphasized` |
 * | `md` | `drop-shadow-elevated`   |
 * | `lg` | `drop-shadow-dragged`    |
 *
 * 각 단계는 Spectrum 의 3레이어 레시피(ambient + transition + key)를 그대로 승계한다.
 *
 * ## dark 정책 — 전 레이어 alpha ×3
 *
 * Spectrum 은 dark 에서 검정을 유지하며 불투명도만 정확히 3배로 올린다 (ambient .08→.24 /
 * transition .04→.12 / key .08→.24 · .12→.36 · .16→.48). 이 프로젝트의 구 dark 값은 배수가
 * 단계마다 3~5배로 불균일했다 — 근거 없는 편차라 ADR-166 에서 3배로 정규화했다.
 *
 * Material 3 은 반대로 dark 에서 그림자를 강화하지 않는다(`shadow` 색이 light/dark 모두
 * `neutral.tone(0)`). surface tint 로 고도를 표현하기 때문인데, 이 프로젝트는 surface tint 를
 * 쓰지 않으므로 채용 대상이 아니다.
 *
 * ## 제거된 키 (ADR-166)
 *
 * - `xl` — Spectrum 이 4번째 elevation 을 발행하지 않는다. D3 `--shadow-xl` 소비처가 0건이라
 *   임의 확장 대신 축소를 택했다 (유일 사용처 `DataTablePresetSelector.css` 는 빌더 chrome 이라
 *   `App.css` 의 별도 정의를 읽는다).
 * - `focus-ring` — 값에 `var(--accent)` 를 담고 있어 Skia 파서가 해석하지 못했고, 실사용도
 *   0건이었다. focus ring 은 ADR-061 의 `{focus.ring.*}` + `FOCUS_RING_TOKENS` 가 소유한다.
 *
 * **불변식**: 본 map 의 값에는 `var(` / `color-mix(` 가 들어가면 안 된다. Skia 그림자 파서가
 * 해석하지 못해 불투명 검정으로 낙하한다 (ADR-166 결함 1). 정적 가드가 이를 집행한다.
 *
 * @packageDocumentation
 */

import type { ShadowTokens } from "../types/token.types";

/**
 * 그림자 토큰 — light theme
 */
export const lightShadows: ShadowTokens = {
  /** 그림자 없음 */
  none: "none",

  /** 작은 그림자 — Spectrum 2 `drop-shadow-emphasized` */
  sm: "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.08)",

  /** 중간 그림자 — Spectrum 2 `drop-shadow-elevated` */
  md: "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04), 0 0 2px rgba(0, 0, 0, 0.12)",

  /** 큰 그림자 — Spectrum 2 `drop-shadow-dragged` */
  lg: "0 12px 16px rgba(0, 0, 0, 0.08), 0 6px 8px rgba(0, 0, 0, 0.04), 0 0 6px rgba(0, 0, 0, 0.16)",

  /**
   * 내부 그림자 (inset) — elevation 이 아니라 오목 효과라 Spectrum 재정의 대상이 아니다.
   * 값은 종전 유지, dark 만 같은 ×3 규칙 적용.
   */
  inset: "inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)",
};

/**
 * 그림자 토큰 — dark theme
 *
 * light 대비 전 레이어 alpha ×3 (Spectrum 규칙). offset·blur 는 동일.
 */
export const darkShadows: ShadowTokens = {
  none: "none",

  sm: "0 2px 8px rgba(0, 0, 0, 0.24), 0 1px 4px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.24)",

  md: "0 4px 12px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.12), 0 0 2px rgba(0, 0, 0, 0.36)",

  lg: "0 12px 16px rgba(0, 0, 0, 0.24), 0 6px 8px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.48)",

  inset: "inset 0 2px 8px 0 rgba(0, 0, 0, 0.48)",
};

/*
 * `shadows` (light 별칭) 는 제거됐다 (2026-07-25).
 *
 * ADR-166 Phase 1 이 토큰을 theme 별로 가른 뒤 하위 호환용으로 남겨뒀는데, 이름이 theme 을
 * 감춰서 **light 를 쓰고 있다는 사실이 호출부에서 안 보인다** — 실제로 스타일 패널이 이 별칭으로
 * 그림자를 기록해 사용자 선택이 light 에 고착되던 결함의 통로였다(ADR-166 후속에서 해소).
 *
 * light 값이 필요하면 `lightShadows` 를 명시적으로 쓰고, theme 을 따라야 하면
 * `getShadowToken(name, theme)` 또는 `resolveToken("{shadow.x}", theme)` 를 쓴다.
 * 저장된 리터럴을 현재 theme 으로 되돌리는 것은 `shadowNormalize.ts` 가 담당한다.
 */

/**
 * 그림자 토큰 값 반환
 */
export function getShadowToken(
  name: keyof ShadowTokens,
  theme: "light" | "dark" = "light",
): string {
  return theme === "dark" ? darkShadows[name] : lightShadows[name];
}

/**
 * 그림자를 파싱하여 렌더러에서 사용할 수 있는 형태로 변환
 */
export interface ParsedShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
  inset: boolean;
}

/**
 * CSS box-shadow 문자열을 파싱
 */
export function parseShadow(shadow: string): ParsedShadow[] {
  if (shadow === "none") return [];

  const shadows: ParsedShadow[] = [];
  const parts = shadow.split(/,(?![^(]*\))/); // 괄호 안의 쉼표는 무시

  for (const part of parts) {
    const trimmed = part.trim();
    const inset = trimmed.startsWith("inset");
    const values = trimmed.replace("inset", "").trim();

    // rgba 또는 hex 색상 추출
    const colorMatch = values.match(/rgba?\([^)]+\)|#[a-fA-F0-9]{3,8}/);
    const color = colorMatch ? colorMatch[0] : "rgba(0, 0, 0, 0.1)";

    // 숫자 값 추출 (px 단위)
    const numbers = values
      .replace(color, "")
      .match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? [0, 0, 0, 0];

    const [offsetX = 0, offsetY = 0, blur = 0, spread = 0] = numbers;

    // alpha 추출
    const alphaMatch = color.match(/[\d.]+\)$/);
    const alpha = alphaMatch ? parseFloat(alphaMatch[0]) : 1;

    shadows.push({
      offsetX,
      offsetY,
      blur,
      spread,
      color,
      alpha,
      inset,
    });
  }

  return shadows;
}
