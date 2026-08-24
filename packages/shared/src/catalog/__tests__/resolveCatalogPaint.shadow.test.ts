import { describe, expect, it } from "vitest";

import {
  buildCatalogShapes,
  type ComponentVisualRule,
  type SizeSpec,
} from "@composition/specs";
import type {
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/composition-document.types";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  resolveCatalogPaint,
  type CatalogInteractionState,
} from "../resolvers/resolveCatalogPaint";

const INTERACTION_STATES: readonly CatalogInteractionState[] = [
  "default",
  "hover",
  "pressed",
];

const PROP_CASES: ReadonlyArray<
  readonly [name: string, props: Readonly<Record<string, unknown>>]
> = [
  ["base", {}],
  ["outline", { fillStyle: "outline" }],
  ["subtle", { fillStyle: "subtle" }],
  ["quiet", { isQuiet: true }],
  ["selected", { isSelected: true }],
  ["emphasized-selected", { isSelected: true, isEmphasized: true }],
  ["static-black", { staticColor: "black" }],
  ["static-white", { staticColor: "white" }],
  ["selected-static", { isSelected: true, staticColor: "black" }],
  ["outline-static", { fillStyle: "outline", staticColor: "white" }],
  ["show-all", { _isShowAll: true }],
  [
    "inline-overrides",
    {
      staticColor: "black",
      isSelected: true,
      style: {
        backgroundColor: "#123456",
        color: "#abcdef",
        borderColor: "#fedcba",
        borderWidth: 2,
      },
    },
  ],
];

function toLegacyVisual(variant: ComponentRuleVariant): ComponentVisualRule {
  const colors = variant.colors ?? {};
  return {
    fill: variant.fill as unknown as ComponentVisualRule["fill"],
    text: colors.text as ComponentVisualRule["text"],
    textHover: colors.textHover as ComponentVisualRule["textHover"],
    textWeight: variant.textWeight,
    fontFamily: variant.fontFamily,
    border: colors.border as ComponentVisualRule["border"],
    borderHover: colors.borderHover as ComponentVisualRule["borderHover"],
    borderStyle: variant.borderStyle,
    fillBar: variant.fillBar as ComponentVisualRule["fillBar"],
    outlineText: colors.outlineText as ComponentVisualRule["outlineText"],
    outlineBorder: colors.outlineBorder as ComponentVisualRule["outlineBorder"],
    subtleText: colors.subtleText as ComponentVisualRule["subtleText"],
    selectedText: colors.selectedText as ComponentVisualRule["selectedText"],
    selectedBorder:
      colors.selectedBorder as ComponentVisualRule["selectedBorder"],
    emphasizedSelectedText:
      colors.emphasizedSelectedText as ComponentVisualRule["emphasizedSelectedText"],
    emphasizedSelectedBorder:
      colors.emphasizedSelectedBorder as ComponentVisualRule["emphasizedSelectedBorder"],
    leadingIcon: variant.leadingIcon as ComponentVisualRule["leadingIcon"],
    leadingAvatar:
      variant.leadingAvatar as ComponentVisualRule["leadingAvatar"],
    selectionCheckbox:
      variant.selectionCheckbox as ComponentVisualRule["selectionCheckbox"],
    trailingIcon: variant.trailingIcon as ComponentVisualRule["trailingIcon"],
    textAlign: variant.textAlign,
  };
}

function toShadowSize(size: ComponentRuleSize | undefined): SizeSpec {
  return {
    borderRadius: 0,
    fontSize: 14,
    paddingX: 0,
    ...size,
    height: 0,
  } as unknown as SizeSpec;
}

describe("resolveCatalogPaint — 기존 Skia shadow parity", () => {
  it("전체 catalog variant × authored paint axis × interaction state의 semantic diff가 0이다", () => {
    const diffs: string[] = [];
    let compared = 0;

    for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE)) {
      const ruleSize =
        rule.sizes[rule.defaultSize ?? ""] ?? Object.values(rule.sizes)[0];
      const shadowSize = toShadowSize(ruleSize);

      for (const [variantName, variant] of Object.entries(rule.variants)) {
        const legacyVisual = toLegacyVisual(variant);

        for (const [caseName, caseProps] of PROP_CASES) {
          const style = caseProps.style as
            Readonly<Record<string, unknown>> | undefined;

          for (const interactionState of INTERACTION_STATES) {
            const props = { ...caseProps, label: "shadow" };
            const legacyShapes = buildCatalogShapes(
              legacyVisual,
              props,
              shadowSize,
              interactionState,
            );
            const legacyBackground = legacyShapes.find(
              (
                shape,
              ): shape is Extract<
                (typeof legacyShapes)[number],
                { type: "roundRect" }
              > =>
                shape.type === "roundRect" &&
                shape.presentationRole === "background-fill",
            );
            const legacyBorder = legacyShapes.find(
              (shape) => shape.type === "border" && shape.target === "bg",
            );
            const legacyText = legacyShapes.find(
              (shape) => shape.type === "text",
            );
            const resolved = resolveCatalogPaint({
              variant,
              size: ruleSize,
              props,
              style,
              interactionState,
            });
            const rawCatalogAlpha = variant.fill.alpha ?? 1;
            const legacyStaticTrackWash =
              rawCatalogAlpha !== 0 &&
              legacyBackground?.presentationOpacityMultiplier ===
                rawCatalogAlpha * 0.25;

            const legacySemantic = {
              backgroundColor: legacyBackground?.fill,
              color: legacyText?.fill,
              borderColor:
                legacyBorder?.type === "border"
                  ? legacyBorder.color
                  : undefined,
              backgroundAlpha: legacyBackground?.presentationOpacityMultiplier,
              staticTrackWash: legacyStaticTrackWash,
              hasVisibleBoxPaint: legacyBackground != null,
              hasOpaqueCatalogBackground: legacyText?.baseline === "middle",
            };
            const resolvedSemantic = {
              backgroundColor: resolved.hasVisibleBoxPaint
                ? resolved.backgroundColor
                : undefined,
              color: resolved.color,
              borderColor: resolved.borderColor,
              backgroundAlpha: resolved.hasVisibleBoxPaint
                ? resolved.backgroundAlpha
                : undefined,
              staticTrackWash: resolved.staticTrackWash,
              hasVisibleBoxPaint: resolved.hasVisibleBoxPaint,
              hasOpaqueCatalogBackground: resolved.hasOpaqueCatalogBackground,
            };

            if (
              JSON.stringify(legacySemantic) !==
              JSON.stringify(resolvedSemantic)
            ) {
              diffs.push(
                `${type}.${variantName}/${caseName}/${interactionState}: ` +
                  `${JSON.stringify(legacySemantic)} !== ${JSON.stringify(resolvedSemantic)}`,
              );
            }
            compared += 1;
          }
        }
      }
    }

    expect(compared).toBe(8_244);
    expect(diffs.slice(0, 20)).toEqual([]);
  });
});
