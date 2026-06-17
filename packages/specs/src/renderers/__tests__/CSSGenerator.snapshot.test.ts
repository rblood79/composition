import { describe, it, expect } from "vitest";
import { generateCSS } from "../CSSGenerator";
import { variantToVisual } from "../utils/resolveComponentVisual";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { VariantSpec } from "../../types";
import * as specs from "../../components";

/**
 * ADR-059 Phase 4-infra byte diff 0 회귀 Gate.
 * 모든 ComponentSpec 의 generated CSS 를 snapshot 으로 고정.
 * 인프라 변경 후 snapshot diff 0 이어야 회귀 없음.
 *
 * ADR-912 단계5: production CSSGenerator 는 variant 색상을 _variantSource(rule table 파생)
 *   단독으로 읽는다(구 spec.variants→variantToVisual fallback 제거). snapshot 도 production
 *   동형으로 fixture spec.variants 에서 _variantSource 를 구성해 주입(variantToVisual 은
 *   test-only utility — production variantSourceFor 와 같은 ComponentVisualRule 산출).
 */
function variantSourceFromSpec(spec: {
  variants?: Record<string, VariantSpec>;
}): Record<string, ComponentVisualRule> | undefined {
  if (!spec.variants) return undefined;
  const map: Record<string, ComponentVisualRule> = {};
  for (const [name, v] of Object.entries(spec.variants)) {
    map[name] = variantToVisual(v);
  }
  return map;
}

describe("CSSGenerator snapshot baseline", () => {
  const allSpecs = (Object.values(specs) as unknown[]).filter(
    (
      v,
    ): v is {
      name: string;
      skipCSSGeneration?: boolean;
      variants?: Record<string, VariantSpec>;
    } =>
      typeof v === "object" &&
      v !== null &&
      "name" in v &&
      typeof (v as { name: unknown }).name === "string",
  );

  for (const spec of allSpecs) {
    if (spec.skipCSSGeneration) continue;
    it(`${spec.name}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const css = generateCSS(spec as any, false, variantSourceFromSpec(spec));
      expect(css).toMatchSnapshot();
    });
  }
});
