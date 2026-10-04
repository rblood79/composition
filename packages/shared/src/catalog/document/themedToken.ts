import { resolveToken, type TokenRef } from "@composition/rendering";
import type { Scalar, TokenType } from "./types";

/**
 * A theme token read as a library token value: a color as its string, a length/number as px
 * (a number or an `Npx` string). `undefined` when the token does not resolve to that type.
 */
export function readThemeTokenValue(
  ref: `{${string}}`,
  tokenType: TokenType,
  mode: "light" | "dark",
): Scalar | undefined {
  const resolved = resolveToken(ref as TokenRef, mode);
  if (tokenType === "color" || tokenType === "string")
    return typeof resolved === "string" ? resolved : undefined;
  const pixels =
    typeof resolved === "number"
      ? resolved
      : typeof resolved === "string" &&
          /^-?\d+(?:\.\d+)?px$/.test(resolved.trim())
        ? Number.parseFloat(resolved)
        : NaN;
  return Number.isFinite(pixels) ? pixels : undefined;
}

/**
 * ADR-248 Phase 4e-4d-4: a token's value in a rendering environment. A library token built from a
 * theme token (`ref`) reads it again in `mode` from the installed theme maps (the active theme's
 * preset and token values, `installThemeMaps`), so the color mode and the active theme reach every
 * definition value; without `mode` (or `ref`) it is the build-time value.
 */
export function catalogTokenValue(
  token: { tokenType: string; value: Scalar; ref?: `{${string}}` },
  mode?: "light" | "dark",
): Scalar {
  if (!mode || !token.ref) return token.value;
  return (
    readThemeTokenValue(token.ref, token.tokenType as TokenType, mode) ??
    token.value
  );
}
