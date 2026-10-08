import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildVirtualSpecs, variantSourceFor } from "../scripts/generate-css";
import { generateCSS } from "../src/renderers/CSSGenerator";
import { COMPONENT_RULES_TABLE } from "../../shared/src/catalog/generated/componentRulesTable";

// (2026-10-07 ADR-255: TooltipTrigger +1.)
it("catalog 단독 생성 CSS가 배포 CSS 100개와 byte-identical이다", () => {
  let count = 0;
  for (const input of buildVirtualSpecs()) {
    const css = generateCSS(input, variantSourceFor(input.name));
    if (css === null) continue;
    count++;
    expect(css, input.name).toBe(
      readFileSync(
        new URL(
          `../../shared/src/components/styles/generated/${input.name}.css`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  expect(count).toBe(100); // ADR-256 Phase 5g: + Keyboard
});

it("native Frame/Group은 CSS 생성을 생략하고 Slot의 최소 높이 계약을 보존한다", () => {
  expect(COMPONENT_RULES_TABLE.frame.structure?.skipCSSGeneration).toBe(true);
  expect(COMPONENT_RULES_TABLE.Group.structure?.skipCSSGeneration).toBe(true);
  for (const [size, height] of [
    ["sm", 40],
    ["md", 60],
    ["lg", 80],
  ] as const) {
    expect(COMPONENT_RULES_TABLE.Slot.sizes[size].minHeight).toBe(height);
    expect(COMPONENT_RULES_TABLE.Slot.sizes[size].height).toBeUndefined();
  }
});
