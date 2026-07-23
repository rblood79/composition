/**
 * Shadow Tokens
 *
 * 그림자 토큰 정의 (Material Design 3 elevation 기반)
 *
 * @packageDocumentation
 */

import type { ShadowTokens } from "../types/token.types";

/**
 * 그림자 토큰
 * CSS box-shadow 형식
 */
export const shadows: ShadowTokens = {
  /** 그림자 없음 */
  none: "none",

  /** 작은 그림자 (elevation 1) */
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",

  /** 중간 그림자 (elevation 2) */
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",

  /** 큰 그림자 (elevation 3) */
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",

  /** 매우 큰 그림자 (elevation 4) */
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",

  /** 내부 그림자 (inset) */
  inset: "inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)",

  /** 포커스 링 */
  "focus-ring": "0 0 0 2px var(--accent)",
};

/**
 * 그림자 토큰 값 반환
 */
export function getShadowToken(name: keyof ShadowTokens): string {
  return shadows[name];
}

/**
 * 그림자를 파싱하여 PIXI에서 사용할 수 있는 형태로 변환
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
