import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { resolveCatalogRuleCanvasBox } from "../resolvers/resolveCatalogRuleCanvasBox";

describe("button root layout shared by CSS and Canvas", () => {
  it.each(["Button", "ToggleButton"])(
    "%s preserves CSS intrinsic sizing",
    (type) => {
      const css = COMPONENT_RULES_TABLE[type].structure!.containerStyles!;
      const canvas = resolveCatalogRuleCanvasBox(type, "M");
      for (const key of ["display", "width", "alignItems", "justifyContent"])
        expect(canvas[key], key).toBe(css[key]);
      expect(canvas.width).toBe("fit-content");
    },
  );
});
