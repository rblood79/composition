/**
 * Token to CSS Conversion Utility
 * 타입별 디자인 토큰을 CSS 변수로 변환
 */

import { TAILWIND_PALETTE } from "@composition/specs";
import { hslToString, rgbToString } from "../color/colorUtils";
import type { DesignToken } from "../../types/theme";
import {
  isColorValueHSL,
  isColorValueRGB,
  isTypographyValue,
  isShadowValue,
  isBorderValue,
} from "../../types/theme";

/**
 * 단일 토큰을 CSS 변수로 변환
 * 복잡한 객체 타입(Typography, Shadow, Border)은 여러 CSS 변수로 분해
 */
export function tokenToCSS(token: DesignToken): Record<string, string> {
  const cssVar = token.css_variable || `--${token.name.replace(/\./g, "-")}`;
  const vars: Record<string, string> = {};

  switch (token.type) {
    case "color": {
      // HSL, RGB, HEX 모두 처리
      if (isColorValueHSL(token.value)) {
        vars[cssVar] = hslToString(token.value);
      } else if (isColorValueRGB(token.value)) {
        vars[cssVar] = rgbToString(token.value);
      } else if (typeof token.value === "string") {
        vars[cssVar] = token.value;
      } else {
        // 예상치 못한 값 → JSON 문자열
        vars[cssVar] = JSON.stringify(token.value);
      }
      break;
    }

    case "typography": {
      // 객체를 여러 CSS 변수로 분해
      // typography.heading.h1 { fontFamily, fontSize, fontWeight, lineHeight }
      // → --typography-heading-h1-font-family: "Inter"
      // → --typography-heading-h1-font-size: "2rem"
      if (isTypographyValue(token.value)) {
        const value = token.value;
        vars[`${cssVar}-font-family`] = value.fontFamily;
        vars[`${cssVar}-font-size`] = value.fontSize;
        vars[`${cssVar}-font-weight`] = String(value.fontWeight);
        vars[`${cssVar}-line-height`] = String(value.lineHeight);
        if (value.letterSpacing) {
          vars[`${cssVar}-letter-spacing`] = value.letterSpacing;
        }
      } else {
        // 단순 문자열 값
        vars[cssVar] = String(token.value);
      }
      break;
    }

    case "shadow": {
      // 객체 → CSS box-shadow 문자열
      // { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: {...} }
      // → "0px 4px 8px 0px rgba(0,0,0,0.1)"
      if (isShadowValue(token.value)) {
        const value = token.value;
        const offsetX = value.offsetX;
        const offsetY = value.offsetY;
        const blur = value.blur;
        const spread = value.spread;

        // Color 변환
        let colorStr = "rgba(0,0,0,0.1)"; // 기본값
        if (isColorValueHSL(value.color)) {
          colorStr = hslToString(value.color);
        } else if (isColorValueRGB(value.color)) {
          colorStr = rgbToString(value.color);
        } else if (typeof value.color === "string") {
          colorStr = value.color;
        }

        vars[cssVar] = `${offsetX} ${offsetY} ${blur} ${spread} ${colorStr}`;
      } else {
        // 이미 문자열 형태
        vars[cssVar] = String(token.value);
      }
      break;
    }

    case "border": {
      // { width: "1px", style: "solid", color: {...} }
      // → "1px solid <gray-200>"
      if (isBorderValue(token.value)) {
        const value = token.value;
        const width = value.width;
        const style = value.style;

        // Color 변환
        let colorStr: string = TAILWIND_PALETTE.gray[200]; // 기본값 — gray-200 팔레트 파생 (ADR-191 R8)
        if (isColorValueHSL(value.color)) {
          colorStr = hslToString(value.color);
        } else if (isColorValueRGB(value.color)) {
          colorStr = rgbToString(value.color);
        } else if (typeof value.color === "string") {
          colorStr = value.color;
        }

        vars[cssVar] = `${width} ${style} ${colorStr}`;
      } else {
        // 이미 문자열 형태
        vars[cssVar] = String(token.value);
      }
      break;
    }

    case "spacing":
    case "radius":
    case "motion":
    default: {
      // 문자열 그대로 사용
      if (typeof token.value === "string") {
        vars[cssVar] = token.value;
      } else if (typeof token.value === "number") {
        // 숫자는 px 단위 추가
        vars[cssVar] = `${token.value}px`;
      } else if (typeof token.value === "object" && token.value !== null) {
        // 복잡한 객체는 JSON 문자열 (fallback)
        vars[cssVar] = JSON.stringify(token.value);
      } else {
        vars[cssVar] = String(token.value);
      }
      break;
    }
  }

  return vars;
}

/**
 * 여러 토큰을 한 번에 CSS 변수로 변환
 */
export function tokensToCSS(tokens: DesignToken[]): Record<string, string> {
  const allVars: Record<string, string> = {};

  tokens.forEach((token) => {
    const tokenVars = tokenToCSS(token);
    Object.assign(allVars, tokenVars);
  });

  return allVars;
}

/**
 * CSS 변수를 :root {} 블록으로 포맷팅
 */
export function formatCSSVars(vars: Record<string, string>): string {
  const entries = Object.entries(vars);

  if (entries.length === 0) {
    return ":root {}";
  }

  const cssText = entries
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  return `:root {\n${cssText}\n}`;
}
