import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "./catalogPaintFixture";
import type { SizeSpec } from "../../types";

/**
 * The text weight is the rule's size `fontWeight` — what the generated CSS writes (`CSSGenerator`
 * size block `font-weight`). **Why (2026-11-02, user report)**: a Badge (S2: sizes 600) drew 500 on
 * the Canvas — the shape read only the style and the variant's `textWeight`, then fell to 500 — while
 * the Preview was 600.
 */
const badgeSize = {
  fontSize: 12,
  fontWeight: 600,
  height: 24,
  paddingX: 9,
  borderRadius: 6,
} as unknown as SizeSpec;

const weightOf = (
  props: Record<string, unknown>,
  size: SizeSpec,
  textWeight?: number,
) =>
  (
    buildCatalogShapes(
      textWeight === undefined ? undefined : ({ textWeight } as never),
      props,
      size,
      "default",
      undefined,
      "Badge",
    ).find((shape) => shape.type === "text") as
      | { fontWeight?: number }
      | undefined
  )?.fontWeight;

describe("buildCatalogShapes — text weight = the rule's size weight, as the CSS", () => {
  it("size fontWeight 600 → 600 (not the 500 fallback)", () => {
    expect(weightOf({ children: "Badge" }, badgeSize)).toBe(600);
  });

  it("an authored style weight still wins", () => {
    expect(
      weightOf({ children: "Badge", style: { fontWeight: 300 } }, badgeSize),
    ).toBe(300);
  });

  it("without a size weight: the variant textWeight, then 500", () => {
    const plain = { ...badgeSize, fontWeight: undefined } as SizeSpec;
    expect(weightOf({ children: "Badge" }, plain, 400)).toBe(400);
    expect(weightOf({ children: "Badge" }, plain)).toBe(500);
  });
});
