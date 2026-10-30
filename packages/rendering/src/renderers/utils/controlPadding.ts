/**
 * ADR-295 Phase 3 — an S2 control box's centring paddingY.
 *
 * A size block whose minimum is the S2 control height (`minHeight: "{size.height.<S>}"`) with a token font
 * size and line height centres its line in that height, as S2 does: paddingY = (height − line − border ×
 * 2) / 2, read in the installed maps (desktop for the Canvas; the touch set for the G2 harness's touch
 * arm). The generated CSS writes the same formula over the device variables (`controlPaddingBlock`), and
 * the rule keeps the desktop result as its number paddingY (checked against this at generation).
 */
import type { TokenRef } from "../../types/token.types";
import { resolveBorderWidthPx, resolveToken } from "./tokenResolver";

export function s2ControlPaddingY(size: {
  minHeight?: unknown;
  fontSize?: unknown;
  lineHeight?: unknown;
  borderWidth?: unknown;
  paddingY?: unknown;
}): number | undefined {
  if (
    typeof size.minHeight !== "string" ||
    !/^\{size\.height\.[A-Z]+\}$/.test(size.minHeight) ||
    typeof size.paddingY !== "number" ||
    typeof size.fontSize !== "string" ||
    typeof size.lineHeight !== "string"
  )
    return undefined;
  const height = resolveToken(size.minHeight as TokenRef);
  const line = resolveToken(size.lineHeight as TokenRef);
  if (typeof height !== "number" || typeof line !== "number") return undefined;
  return (height - line - resolveBorderWidthPx(size.borderWidth) * 2) / 2;
}
