import { resolveToken } from "@composition/rendering";
import { themedTokenRef } from "../../../components/property/PropertyUnitInput.runtime";

/**
 * CSS 길이 → px 숫자 (슬라이더 표시용). `var(--radius-md)` 같은 토큰은 활성 테마의 해석값
 * (`resolveToken`, ADR-295 Decision 5 — PropertyUnitInput 의 preset 표시 · commit 과 같은 방식), 토큰이
 * 아닌 변수는 문서 루트의 computed value — rem 은 루트 font-size 로 환산. 못 풀면 null.
 */
export function resolveCssLengthPx(value: string | undefined): number | null {
  if (!value) return null;
  let trimmed = value.trim();
  const varMatch = trimmed.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varMatch) {
    // ADR-295 Decision 5: 토큰은 활성 테마의 해석값 (빌더 root 의 computed 는 chrome 값).
    const tokenRef = themedTokenRef(varMatch[0]);
    const token = tokenRef ? resolveToken(tokenRef) : undefined;
    if (typeof token === "number" && Number.isFinite(token)) return token;
    if (typeof document === "undefined") return null;
    trimmed = getComputedStyle(document.documentElement)
      .getPropertyValue(varMatch[1])
      .trim();
    if (!trimmed) return null;
  }
  const first = trimmed.split(/\s+/)[0];
  const match = first.match(/^(-?\d*\.?\d+)(px|rem)?$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  if ((match[2] ?? "px").toLowerCase() === "rem") {
    const rootFontSize =
      typeof document !== "undefined"
        ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        : NaN;
    return numeric * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
  }
  return numeric;
}
