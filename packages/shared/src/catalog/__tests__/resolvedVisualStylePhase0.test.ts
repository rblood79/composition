import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { paintAt } from "../rule/rulePaintTree";

describe("ADR-912 후속 Phase 4 — Badge catalog paint", () => {
  it("D1 Badge fillStyle binding option마다 catalog paint channel이 존재한다", () => {
    const binding = getPrimitiveBinding("Badge");
    const options = binding?.props?.accepts?.fillStyle?.options ?? [];
    const variants = COMPONENT_RULES_TABLE.Badge?.variants ?? {};

    expect(options.map((option) => option.value)).toEqual([
      "bold",
      "subtle",
      "outline",
    ]);

    for (const [variantName, variant] of Object.entries(variants)) {
      for (const option of options) {
        // ADR-297: the fillStyle branch of the variant's paint tree (`bold` = the default branch).
        const branch =
          option.value === "bold" ? [] : ["fillStyle", option.value];
        expect(
          paintAt(variant.paint.backgroundColor, ...branch),
          `Badge.${variantName}.paint.backgroundColor.${branch.join(".")}`,
        ).toBeDefined();

        if (option.value === "subtle" || option.value === "outline") {
          expect(
            paintAt(variant.paint.color, ...branch),
            `Badge.${variantName}.paint.color.${branch.join(".")}`,
          ).toBeDefined();
        }
        if (option.value === "outline") {
          expect(
            paintAt(variant.paint.borderColor, ...branch),
            `Badge.${variantName}.paint.borderColor.${branch.join(".")}`,
          ).toBeDefined();
        }
      }
    }
  });
});
