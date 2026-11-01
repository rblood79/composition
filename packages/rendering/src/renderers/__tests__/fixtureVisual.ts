/**
 * Test-only fixture visual — the shape tests' old per-variant paint (`fill` · `text` · `border` …) next to the
 * production non-paint visual (`ComponentVisualRule`).
 *
 * ADR-297 Phase 3i: production variants carry their paint as one condition tree (`ComponentRuleVariant.paint`);
 * the Skia primitives read the resolved `paint`, never these fields. The geometry tests here keep their fixtures in
 * the pre-tree shape and `catalogPaintFixture.ts` turns them into a resolved paint — this module is that fixture's
 * input type and the spec → visual mapping it used to import from `resolveComponentVisual.ts` (moved, not changed).
 */
import type { ComponentSpec, TokenRef } from "../../types";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";

/** One fill style's state backgrounds (fixture). */
export interface FixtureFillStates {
  base: TokenRef;
  hover?: TokenRef;
  pressed?: TokenRef;
  selected?: TokenRef;
  selectedHover?: TokenRef;
  selectedPressed?: TokenRef;
  emphasizedSelected?: TokenRef;
}

/** fillStyle × state backgrounds (fixture). */
export interface FixtureFill {
  default: FixtureFillStates;
  outline?: Partial<FixtureFillStates>;
  subtle?: Partial<FixtureFillStates>;
  quiet?: Partial<FixtureFillStates>;
  alpha?: number;
}

/** The fixture's paint fields. */
export interface FixturePaint {
  fill?: FixtureFill;
  text?: TokenRef;
  textHover?: TokenRef;
  border?: TokenRef;
  borderHover?: TokenRef;
  outlineText?: TokenRef;
  outlineBorder?: TokenRef;
  subtleText?: TokenRef;
  selectedText?: TokenRef;
  selectedBorder?: TokenRef;
  emphasizedSelectedText?: TokenRef;
  emphasizedSelectedBorder?: TokenRef;
}

/** A fixture visual — the production non-paint visual plus the fixture paint. */
export type FixtureVisual = ComponentVisualRule & FixturePaint;

/** A fixture spec variant (the pre-tree variant shape). */
export interface FixtureVariant extends FixturePaint {
  fill: FixtureFill;
  text: TokenRef;
  textWeight?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
}

/** fixture variant → fixture visual. */
export function variantToVisual(variant: FixtureVariant): FixtureVisual {
  return {
    fill: variant.fill,
    text: variant.text,
    textHover: variant.textHover,
    textWeight: variant.textWeight,
    currentTextWeight: undefined,
    fontFamily: undefined,
    border: variant.border,
    borderHover: variant.borderHover,
    borderStyle: variant.borderStyle,
    fillBar: undefined,
    outlineText: variant.outlineText,
    outlineBorder: variant.outlineBorder,
    subtleText: variant.subtleText,
    selectedText: variant.selectedText,
    selectedBorder: variant.selectedBorder,
    emphasizedSelectedText: variant.emphasizedSelectedText,
    emphasizedSelectedBorder: variant.emphasizedSelectedBorder,
    leadingIcon: undefined,
    leadingAvatar: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

/** fixture spec + variant name (default: `spec.defaultVariant`) → fixture visual. */
export function resolveComponentVisual(
  spec: ComponentSpec<Record<string, unknown>>,
  variantName: string | undefined,
): FixtureVisual | undefined {
  const name = variantName ?? spec.defaultVariant;
  const variants = spec.variants as
    | Record<string, FixtureVariant>
    | undefined;
  const variant = name ? variants?.[name] : undefined;
  return variant ? variantToVisual(variant) : undefined;
}
