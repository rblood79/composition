import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "@composition/specs";
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

function resolveLegacySemantic(
  visual: ComponentVisualRule,
  props: Readonly<Record<string, unknown>>,
  size: ComponentRuleSize | undefined,
  interactionState: CatalogInteractionState,
) {
  const style = props.style as Readonly<Record<string, unknown>> | undefined;
  const fill = visual.fill;
  const fillStyle = (props.fillStyle as string | undefined) ?? "fill";
  const isOutline = fillStyle === "outline";
  const isSubtle = fillStyle === "subtle";
  const fillStates =
    props.isQuiet === true && fill?.quiet != null
      ? fill.quiet
      : isOutline
        ? fill?.outline
        : isSubtle
          ? fill?.subtle
          : fill?.default;
  const isSelected = props.isSelected === true;
  const isEmphasized = props.isEmphasized === true;
  const stateBackground = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : interactionState === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : interactionState === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;
  const staticHex =
    props.staticColor === "black"
      ? "#000000"
      : props.staticColor === "white"
        ? "#ffffff"
        : undefined;
  const catalogAlpha = fill?.alpha ?? 1;
  const staticOnOpaqueBackground =
    staticHex != null &&
    !isOutline &&
    !isSubtle &&
    stateBackground != null &&
    stateBackground !== "{color.transparent}" &&
    catalogAlpha !== 0;
  const staticTrackWash = staticOnOpaqueBackground && visual.fillBar != null;
  const staticTextColor =
    staticHex == null
      ? undefined
      : staticOnOpaqueBackground && !staticTrackWash
        ? staticHex === "#000000"
          ? "#ffffff"
          : "#000000"
        : staticHex;
  const isShowAll = props._isShowAll === true;
  const backgroundColor = isShowAll
    ? "{color.transparent}"
    : ((style?.backgroundColor as string | undefined) ??
      (staticOnOpaqueBackground ? staticHex : undefined) ??
      stateBackground ??
      (isOutline ? "{color.transparent}" : undefined));
  const color = isShowAll
    ? "{color.accent}"
    : ((style?.color as string | undefined) ??
      staticTextColor ??
      (isSelected
        ? isEmphasized
          ? (visual.emphasizedSelectedText ?? visual.selectedText)
          : visual.selectedText
        : isOutline
          ? (visual.outlineText ?? visual.text)
          : isSubtle
            ? (visual.subtleText ?? visual.text)
            : interactionState === "hover" && visual.textHover
              ? visual.textHover
              : visual.text));
  const variantBorderColor = isSelected
    ? isEmphasized
      ? (visual.emphasizedSelectedBorder ?? visual.selectedBorder)
      : visual.selectedBorder
    : isOutline
      ? (visual.outlineBorder ?? visual.border)
      : interactionState === "hover" && visual.borderHover
        ? visual.borderHover
        : visual.border;
  const staticBorderEligible =
    variantBorderColor != null &&
    (variantBorderColor !== "{color.transparent}" ||
      size?.borderWidth != null ||
      style?.borderWidth != null);
  const borderColor = isShowAll
    ? undefined
    : ((style?.borderColor as string | undefined) ??
      (staticHex != null && staticBorderEligible
        ? staticHex
        : variantBorderColor));
  const hasVisibleBoxPaint =
    style?.backgroundColor != null ||
    (backgroundColor != null && catalogAlpha !== 0) ||
    !!borderColor;
  const hasOpaqueCatalogBackground =
    (stateBackground != null &&
      stateBackground !== "{color.transparent}" &&
      catalogAlpha !== 0) ||
    !!borderColor;

  return {
    backgroundColor: hasVisibleBoxPaint ? backgroundColor : undefined,
    color,
    borderColor,
    backgroundAlpha: hasVisibleBoxPaint
      ? catalogAlpha * (staticTrackWash ? 0.25 : 1)
      : undefined,
    staticTrackWash,
    hasVisibleBoxPaint,
    hasOpaqueCatalogBackground,
  };
}

describe("resolveCatalogPaint — 기존 Skia shadow parity", () => {
  it("전체 catalog variant × authored paint axis × interaction state의 semantic diff가 0이다", () => {
    const diffs: string[] = [];
    let compared = 0;

    for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE)) {
      const ruleSize =
        rule.sizes[rule.defaultSize ?? ""] ?? Object.values(rule.sizes)[0];
      for (const [variantName, variant] of Object.entries(rule.variants)) {
        const legacyVisual = toLegacyVisual(variant);

        for (const [caseName, caseProps] of PROP_CASES) {
          const style = caseProps.style as
            Readonly<Record<string, unknown>> | undefined;

          for (const interactionState of INTERACTION_STATES) {
            const props = { ...caseProps, label: "shadow" };
            const resolved = resolveCatalogPaint({
              variant,
              size: ruleSize,
              props,
              style,
              interactionState,
            });
            const legacySemantic = resolveLegacySemantic(
              legacyVisual,
              props,
              ruleSize,
              interactionState,
            );
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
