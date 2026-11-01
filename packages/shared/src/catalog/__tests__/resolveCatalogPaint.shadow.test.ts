import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "@composition/rendering";
import type {
  CatalogFillStyleValues,
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/catalog-style.types";
import { legacyVariantPaint } from "../rule/rulePaintTree";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { rulePaintReach } from "../rule/paintReach";
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

/**
 * ADR-297: the variant's condition tree as the generator's legacy-order input (`legacyVariantPaint`
 * — what the generated CSS reads until Phase 3), run through the old Skia semantics below.
 */
function toLegacyVisual(
  variant: ComponentRuleVariant,
  fillStyleValues: CatalogFillStyleValues | undefined,
): ComponentVisualRule {
  const legacy = legacyVariantPaint(variant.paint, fillStyleValues);
  const colors = legacy.colors ?? {};
  const fill =
    variant.alpha === undefined
      ? legacy.fill
      : { ...legacy.fill, alpha: variant.alpha };
  return {
    fill: fill as unknown as ComponentVisualRule["fill"],
    text: colors.text as ComponentVisualRule["text"],
    textHover: colors.textHover as ComponentVisualRule["textHover"],
    textWeight: variant.textWeight,
    currentTextWeight: variant.currentTextWeight,
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
    trailingIcon: variant.trailingIcon as ComponentVisualRule["trailingIcon"],
    textAlign: variant.textAlign,
  };
}

function resolveLegacySemantic(
  visual: ComponentVisualRule,
  props: Readonly<Record<string, unknown>>,
  size: ComponentRuleSize | undefined,
  interactionState: CatalogInteractionState,
  // (the rule's static paint opacity — S2 transparent-overlay, 2026-10-10; not a legacy visual field)
  staticAlpha = 1,
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
    ? "{color.accent-content}"
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
  const catalogBorderColor = isShowAll
    ? undefined
    : staticHex != null && staticBorderEligible
      ? staticHex
      : variantBorderColor;
  const borderColor = isShowAll
    ? undefined
    : ((style?.borderColor as string | undefined) ?? catalogBorderColor);
  const hasVisibleBoxPaint =
    style?.backgroundColor != null ||
    (backgroundColor != null && catalogAlpha !== 0) ||
    !!borderColor;
  // 2026-09-20: 사용자 inline border 는 box archetype 신호가 아니다 (catalog 테두리만).
  const hasOpaqueCatalogBackground =
    (stateBackground != null &&
      stateBackground !== "{color.transparent}" &&
      catalogAlpha !== 0) ||
    !!catalogBorderColor;

  return {
    backgroundColor: hasVisibleBoxPaint ? backgroundColor : undefined,
    color,
    borderColor,
    backgroundAlpha: hasVisibleBoxPaint
      ? catalogAlpha * (staticOnOpaqueBackground ? staticAlpha : 1)
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
      const reach = rulePaintReach(type, rule);
      for (const [variantName, variant] of Object.entries(rule.variants)) {
        const legacyVisual = toLegacyVisual(variant, rule.fillStyleValues);

        for (const [caseName, caseProps] of PROP_CASES) {
          // ADR-297: inputs the rule's component can reach — a selection only where it can be selected,
          //   a fillStyle value only where its binding takes it (`rulePaintReach`). The condition tree
          //   keeps the legacy paint there; a Button never selected has no selected branch.
          if (
            (caseProps.isSelected === true && !reach.selectable) ||
            (typeof caseProps.fillStyle === "string" &&
              !reach.fillStyles?.includes(caseProps.fillStyle)) ||
            // (Phase 3: the static scheme is the tree's `staticColor` branch — where staticColor reaches)
            (typeof caseProps.staticColor === "string" && !reach.staticColor) ||
            // (Phase 3d: selection folded into Tag · ColorSwatch default trees — the legacy chain painted
            //  it through the swapped `selected` variant; swap ↔ tree 24/24 checked 2026-11-01)
            (caseProps.isSelected === true &&
              (type === "Tag" || type === "ColorSwatch"))
          )
            continue;
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
              variant.staticAlpha,
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

    // ADR-194 (2026-09-08): Chart 2 variant 추가로 8,244 → 8,316 (+72 = 2 variant ×
    //   authored paint axis × interaction state). diffs 0 은 그대로 — 새 variant 도 발산 없음.
    // ADR-201 (2026-09-17): FileUpload 1 variant 추가로 8,316 → 8,352 (+36). diffs 0 유지.
    // 2026-10-06: ProgressBarTrack accent · neutral variant 추가로 8,352 → 8,424 (+72). diffs 0 유지.
    // ADR-253 (2026-10-06): SelectTrigger `plain` variant (배치 전용 wrapper) 추가로 8,424 → 8,460 (+36). diffs 0 유지.
    // ADR-253 Phase 6 (2026-10-07): SelectTrigger `accent` · `negative` variant 제거 (template 사용 0) 로 8,460 → 8,388.
    // (ADR-256 Phase 5g: + Keyboard — 36 cases.)
    // 2026-10-09: SelectTrigger type 삭제 (ADR-256 Phase 6b 뒤 사용 0 — 사용자 승인) 로 8,424 → 8,352 (−72 = 2 variant).
    // ADR-256 Phase 7a: + ProgressBarFill (default · accent · neutral) 8,352 → 8,460 (+108). diffs 0 유지.
    // ADR-256 Phase 7b: + MeterFill (4 variants) 8,460 → 8,604 (+144). diffs 0 유지.
    // ADR-256 Phase 7c: + SliderFill (1 variant) 8,604 → 8,640 (+36). diffs 0 유지.
    // ADR-256 Phase 8e: − DisclosureHeader · DisclosureContent (1 variant each) 8,640 → 8,568 (−72).
    // (ADR-256 후속 4: Menu 의 trigger variant 6 → 목록 1 — −180.)
    // 2026-10-09: + Illustration (IllustratedMessage 의 그림, 1 variant) 8,388 → 8,424 (+36). diffs 0 유지.
    // 2026-10-09: − SelectIcon · TableRow · TableCell · TailSwatch (1 variant each — 원본이 쓰지 않던
    //   type 삭제) 8,424 → 8,280 (−144). diffs 0 유지.
    // 2026-10-10: + SliderFill · SliderThumb `emphasized`, Tag `selectedEmphasized` (S2 isEmphasized)
    //   8,280 → 8,388 (+108). diffs 0 유지.
    // 2026-10-10 강조 축 전환 2: − Radio neutral · negative, CheckboxGroup · RadioGroup accent,
    //   Form outlined (S2 에 없는 변형 — 공개 축은 isEmphasized) 8,388 → 8,208 (−180). diffs 0 유지.
    // 2026-10-10 값 정렬: + CardView secondary · tertiary · quiet, − Tooltip positive (S2 ·
    //   design-data 집합) 8,208 → 8,280 (+72). diffs 0 유지.
    // ADR-258 Phase 2: − ColorArea default · accent, ColorSlider · ColorWheel default (the controls
    //   paint no box — their gradient parts do) 8,280 → 8,136 (−144). diffs 0 유지.
    // 2026-10-12 S2 정렬 F 묶음: − S2 · RAC · v3 어디에도 없는 variant 34 (ProgressBar · Fill ·
    //   Track 2 each, Table 2, Separator 6, Section 5, ColorPicker 2, 13 types × accent/quiet 1)
    //   8,136 → 6,912 (−1,224 = 34 × 36). diffs 0 유지.
    // ADR-277 (2026-10-21): − 옛 둘째 표 type 의 default · quiet (표는 Table 하나) 6,912 → 6,840
    //   (−72 = 2 × 36). diffs 0 유지.
    // ADR-297 Phase 1 (2026-11-01): 닿는 입력만 — selected 는 선택될 수 있는 rule, fillStyle 은 binding 이 받는 값
    //   (`rulePaintReach`). 6,840 → 3,387 (빠진 3,453 행 = 어떤 컴포넌트도 만들지 못하는 입력 — Button 의 selected ·
    //   subtle 등). diffs 0 유지.
    // ADR-297 Phase 3 (2026-11-01): static 은 트리의 `staticColor` 가지 (codemod `adr297-static-to-tree.ts`) —
    //   static 입력은 staticColor 가 닿는 rule 만 (`rulePaintReach` — binding 이 받거나 ProgressBar · Meter 파생).
    //   3,387 → 2,238 (빠진 1,149 행 = staticColor 를 받지 못하는 rule 의 static 입력). diffs 0 유지 — 이 사본의
    //   옛 static 판정이 codemod 의 oracle.
    // (ADR-297 Phase 3d: 2,238 → 2,181 — the three selection variants folded into their default trees, whose
    //  selected inputs this legacy comparison skips)
    expect(compared).toBe(2_181);
    expect(diffs.slice(0, 20)).toEqual([]);
  });
});
