import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

describe("ADR-912 후속 Phase 0 — expected RED", () => {
  it.fails(
    "D1 Badge fillStyle binding option마다 catalog paint channel이 존재한다",
    () => {
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
          const fillKey = option.value === "bold" ? "default" : option.value;
          expect(
            variant.fill[fillKey as keyof typeof variant.fill],
            `Badge.${variantName}.fill.${fillKey}`,
          ).toBeDefined();

          if (fillKey === "subtle") {
            expect(
              variant.colors?.subtleText,
              `Badge.${variantName}.colors.subtleText`,
            ).toBeDefined();
          }
          if (fillKey === "outline") {
            expect(
              variant.colors?.outlineText,
              `Badge.${variantName}.colors.outlineText`,
            ).toBeDefined();
            expect(
              variant.colors?.outlineBorder,
              `Badge.${variantName}.colors.outlineBorder`,
            ).toBeDefined();
          }
        }
      }
    },
  );
});
