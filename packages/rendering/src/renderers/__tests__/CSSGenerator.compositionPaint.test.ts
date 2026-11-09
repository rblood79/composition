import { expect, it } from "vitest";
import { generateCSS } from "../CSSGenerator";
import {
  buildVirtualSpecs,
  variantPaintCssFor,
} from "../../../scripts/generate-css";
import { ruleRootBox } from "../../../../shared/src/catalog/document/ruleDefinition";
import { SELECT_BOX_RULE } from "../../../../shared/src/catalog/rule/selectionComposites";
import { actionBarPaint } from "../../../../shared/src/catalog/runtime/actionBarForeground";

it("composite layout explicitly retains variant paint without copying its condition tree", () => {
  const spec = buildVirtualSpecs().find((entry) => entry.name === "SelectBox")!;
  const paint = variantPaintCssFor("SelectBox");
  const css = generateCSS(spec, paint)!;
  expect(css).toContain("background: var(--bg-inset)");
  expect(css).toContain("border: var(--border-width-thick) solid transparent");
  expect(css).toMatch(/data-selected[^}]*border-color: var\(--fg\)/);
  expect(css).toContain("height: 170px");
  const legacy = generateCSS(
    { ...spec, composition: { ...spec.composition, rootPaint: undefined } },
    paint,
  )!;
  expect(legacy).not.toMatch(/data-selected[^}]*border-color: var\(--fg\)/);
});

it("ActionBar static button color follows resolved light and dark paint, including rgb values", () => {
  expect(actionBarPaint("#ffffff", "#171717").staticColor).toBe("white");
  expect(actionBarPaint("#111111", "rgb(245, 245, 245)").staticColor).toBe(
    "black",
  );
});

it("typed Canvas root border uses the same opt-in paint ownership, preserving legacy defaults", () => {
  const rule = {
    ...SELECT_BOX_RULE,
    variants: {
      default: { paint: { borderColor: { default: "{color.neutral}" } } },
    },
    sizes: { M: { ...SELECT_BOX_RULE.sizes.M, borderWidth: undefined } },
  };
  expect(ruleRootBox("CompositionPaintProbe", rule).borderAt("M")).toBe(1);
  const legacy = {
    ...rule,
    structure: {
      ...rule.structure,
      composition: { ...rule.structure?.composition, rootPaint: undefined },
    },
  };
  expect(
    ruleRootBox("CompositionPaintProbe", legacy).borderAt("M"),
  ).toBeUndefined();
});
