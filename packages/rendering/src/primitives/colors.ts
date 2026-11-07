/**
 * Color Tokens
 *
 * S2 역할 기반 색상 토큰 (ADR-022 이름 · ADR-302 값).
 * tokenToCSSVar()의 매핑 테이블과 함께 사용됨.
 *
 * @packageDocumentation
 */

import type { ColorTokens } from "../types/token.types";
import {
  SPECTRUM_DARK_COLORS,
  SPECTRUM_LIGHT_COLORS,
} from "./generated/spectrumThemeColors";

/**
 * 기본 preset (Tone gray · tint blue) 의 역할 색 — ADR-302: alias 표 (`colorAliases.ts`) × Spectrum 사다리
 * (design-data) 의 생성 산출물 그대로. 값을 여기서 고치지 않는다 — 단은 alias 표, 값은 사다리 (G1
 * `adr302SpectrumOracle.static.test.ts` 가 oracle 과 대조). 테마가 설치되면 resolver 가 같은 키를 덮는다.
 */
export const lightColors: ColorTokens = { ...SPECTRUM_LIGHT_COLORS };

/** Dark 모드 — 같은 alias 표의 dark 단. */
export const darkColors: ColorTokens = { ...SPECTRUM_DARK_COLORS };

/**
 * 현재 테마에 따른 색상 반환
 */
export function getColorToken(
  name: keyof ColorTokens,
  theme: "light" | "dark" = "light",
): string {
  return theme === "dark" ? darkColors[name] : lightColors[name];
}

/**
 * 테마별 색상 객체 반환
 */
export function getColorTokens(theme: "light" | "dark" = "light"): ColorTokens {
  return theme === "dark" ? darkColors : lightColors;
}
