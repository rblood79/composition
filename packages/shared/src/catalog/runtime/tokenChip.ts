/**
 * S2 체크리스트 §4.1 TokenField Phase 3 (사용자 결정 2026-11-23 「Tag 칠을 줄 안에」) — a TokenInput's
 * tokens are design-data `tag-field`'s Tags: an inline chip (Token rule — the Tag paint tree, `{radius.sm}`,
 * S2 `text-to-visual` inline padding) that keeps the line height. The DOM draws the RAC Token with the
 * generated sheet; the Canvas reads the same rule here — the layout measure gives each token run its
 * inline start · end (`catalogTokenRanges` + `catalogTokenInset`, paragraph placeholders), the paint its
 * chip (`catalogTokenChip`) behind the run.
 */
import { resolveToken, type TokenRef } from "@composition/rendering";
import { catalogTokenSegments } from "../document/tokenFieldValue";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";

type TokenSize = keyof typeof COMPONENT_RULES_TABLE.Token.sizes;

/** The `[start, end)` ranges of a TokenInput text's tokens (the segments RAC renders as `Token`). */
export function catalogTokenRanges(
  text: string,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let at = 0;
  for (const segment of catalogTokenSegments(text)) {
    if (segment.type === "token")
      out.push({ start: at, end: at + segment.text.length });
    at += segment.text.length;
  }
  return out;
}

function sizeOf(size: unknown) {
  const sizes = COMPONENT_RULES_TABLE.Token.sizes;
  return (
    sizes[(typeof size === "string" ? size : "") as TokenSize] ??
    sizes[COMPONENT_RULES_TABLE.Token.defaultSize as TokenSize]
  );
}

const px = (value: unknown): number =>
  typeof value === "number"
    ? value
    : Number.parseFloat(String(resolveToken(value as TokenRef, "light"))) || 0;

/** A token's inline start · end beyond its glyphs (CSS inline padding + border, each side), px. */
export function catalogTokenInset(size: unknown): number {
  const step = sizeOf(size);
  return px(step.paddingX) + px(step.borderWidth);
}

/** The token text's weight at `size` (the rule's — the TokenInput's run mark). */
export function catalogTokenFontWeight(size: unknown): number {
  return Number(sizeOf(size).fontWeight);
}

export interface CatalogTokenChip {
  /** Inline padding + border, each side (px). */
  readonly inset: number;
  readonly borderWidth: number;
  readonly radius: number;
  readonly fontWeight: number;
  /** Resolved colors (the active color mode). */
  readonly background?: string;
  readonly borderColor?: string;
  readonly color?: string;
}

/** The chip a token draws at `size` in `state` — the Token rule's size step and paint tree. */
export function catalogTokenChip(
  size: unknown,
  state: { readonly isDisabled?: boolean; readonly isSelected?: boolean },
  theme: "light" | "dark",
): CatalogTokenChip {
  const step = sizeOf(size);
  const rule = COMPONENT_RULES_TABLE.Token;
  const paint = rule.variants.default.paint;
  const conditions = {
    isDisabled: state.isDisabled === true,
    isSelected: state.isSelected === true,
  };
  const color = (tree: unknown): string | undefined => {
    const ref = evaluateConditionTree(
      tree as Parameters<typeof evaluateConditionTree<string>>[0],
      conditions,
    );
    return typeof ref === "string"
      ? String(resolveToken(ref as TokenRef, theme))
      : undefined;
  };
  return {
    inset: catalogTokenInset(size),
    borderWidth: px(step.borderWidth),
    radius: px(step.borderRadius),
    fontWeight: Number(step.fontWeight),
    background: color(paint.backgroundColor),
    borderColor: color(paint.borderColor),
    color: color(paint.color),
  };
}
