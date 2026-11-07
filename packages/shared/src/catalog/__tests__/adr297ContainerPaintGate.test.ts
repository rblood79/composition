import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { catalogCompositionOwnsContainerBox } from "../resolvers/resolveCatalogRuleCanvasBox";
import type { ComponentRule } from "../../types/catalog-style.types";
import { catalogCompositionUsesVariantPaint } from "../rule/compositionPaint";

/**
 * ADR-297 Phase 3 닫힘 — 칠 트리 하나를 두 consumer 가 같이 읽는다. 생성 CSS (`CSSGenerator.ts` —
 * `compositionOwnsContainerBox`) 는 composition 이 상자를 가진 rule 의 variant 칠을 내지 않으므로 (자식이 칠한다),
 * 그 rule 의 트리에 보이는 바탕 · 테두리가 있으면 Canvas 만 그린다. 실제 노드 트리 대조
 * (`adr297RealPaintParity.browser.test.ts`) 에서 CheckboxGroup · RadioGroup · Accordion · Form · Pagination ·
 * Toolbar 의 바탕 · 테두리가 Canvas 에만 있었다.
 */
const TRANSPARENT = new Set(["{color.transparent}", "transparent"]);

function leaves(tree: unknown): unknown[] {
  if (tree === null || typeof tree !== "object") return [tree];
  return Object.values(tree as Record<string, unknown>).flatMap(leaves);
}

describe("composition 이 상자를 가진 rule 의 variant 칠 트리", () => {
  const owners = Object.entries(
    COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
  ).filter(([, rule]) => {
    const structure = rule.structure as
      | {
          composition?: Parameters<
            typeof catalogCompositionOwnsContainerBox
          >[0] & { rootPaint?: "variant" };
          containerStyles?: Record<string, unknown>;
        }
      | undefined;
    const container = structure?.containerStyles ?? {};
    // (a rule whose container declares its colors paints from them in both consumers — not this gate)
    return (
      catalogCompositionOwnsContainerBox(structure?.composition) &&
      !catalogCompositionUsesVariantPaint(structure?.composition, true) &&
      !(container.background || container.text || container.border)
    );
  });

  it("대상 rule 이 있다", () => {
    expect(owners.map(([type]) => type)).toEqual(
      expect.arrayContaining(["CheckboxGroup", "Toolbar", "Pagination"]),
    );
  });

  it("보이는 바탕 · 테두리가 없다 (생성 CSS 가 내지 않는 칠을 Canvas 가 그리지 않는다)", () => {
    const painted: string[] = [];
    for (const [type, rule] of owners)
      for (const [name, variant] of Object.entries(rule.variants ?? {})) {
        const paint = variant.paint as Record<string, unknown>;
        // (an alpha-0 variant draws no box — the CSS writes `transparent` for it too)
        if (variant.alpha !== 0)
          for (const leaf of leaves(paint.backgroundColor))
            if (leaf != null && !TRANSPARENT.has(String(leaf)))
              painted.push(`${type}.${name} backgroundColor ${String(leaf)}`);
        for (const leaf of leaves(paint.borderColor))
          if (leaf != null && !TRANSPARENT.has(String(leaf)))
            painted.push(`${type}.${name} borderColor ${String(leaf)}`);
      }
    expect(painted).toEqual([]);
  });
});
