/**
 * ADR-297 전환 단계의 두 소비자 정합 (표 전수 · 합성 fixture 아님). 표는 트리만 적고 (Phase 2), Canvas 는 트리를
 * 평가하고 생성 CSS 는 같은 트리를 옛 블록 순서 입력 (`legacyVariantPaint` — breakdown §3 `legacyOrder`) 으로 읽는다:
 * (1) 그 옛 입력에 옛 Canvas 사슬을 돌린 상태 칠 == evaluator 의 상태 칠 — 닿는 입력 전부 (`rulePaintReach`: 받는
 *     fillStyle 값 · 선택될 수 있는 rule 의 selected) × quiet 2 × emphasized 2 × interaction 3 (staticColor 는 상태
 *     칠 뒤의 공통 단계라 `resolveCatalogPaint.shadow.test.ts` 가 잰다). 변환 자체의 동치 (HEAD 표 대비) 는 Phase 2
 *     codemod 때 G0 기준선 (`adr297-baseline.ts` — paint 닿는 입력 10,044 행) 으로 쟀다.
 * (2) 왕복: 트리 → 옛 입력 → 트리가 원래 트리와 같다 (옛 입력이 트리의 정보를 잃지 않는다).
 */
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../generated/componentRulesTable";
import { catalogFillStyleKey } from "../../resolvers/resolveCatalogPaint";
import type { ComponentRule } from "../../../types/catalog-style.types";
import { rulePaintReach } from "../paintReach";
import {
  evaluatePaint,
  legacyVariantPaint,
  variantPaintTree,
  type LegacyVariantPaint,
} from "../rulePaintTree";

const RULES = Object.entries(
  COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
);
const INTERACTIONS = ["default", "hover", "pressed"] as const;

/**
 * The legacy Canvas chain (`resolveCatalogPaint` before ADR-297 Phase 2 — `fill.<style>.<state>` ·
 * `colors` suffix keys), run on the generator's legacy-order input of the tree.
 */
function legacyStatePaint(
  variant: LegacyVariantPaint,
  props: {
    fillStyle?: string;
    isQuiet: boolean;
    isSelected: boolean;
    isEmphasized: boolean;
  },
  interactionState: (typeof INTERACTIONS)[number],
  fillStyleValues: ComponentRule["fillStyleValues"],
) {
  const fill = variant.fill;
  const colors = variant.colors;
  const fillKey = catalogFillStyleKey(props.fillStyle, fillStyleValues);
  const isOutline = fillKey === "outline";
  const isSubtle = fillKey === "subtle";
  const fillStates =
    props.isQuiet && fill?.quiet != null
      ? fill.quiet
      : isOutline
        ? fill?.outline
        : isSubtle
          ? fill?.subtle
          : fill?.default;
  const { isSelected, isEmphasized } = props;
  const background = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : interactionState === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : interactionState === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;
  const color = isSelected
    ? isEmphasized
      ? (colors?.emphasizedSelectedText ?? colors?.selectedText)
      : colors?.selectedText
    : isOutline
      ? (colors?.outlineText ?? colors?.text)
      : isSubtle
        ? (colors?.subtleText ?? colors?.text)
        : interactionState === "hover" && colors?.textHover
          ? colors.textHover
          : colors?.text;
  const border = isSelected
    ? isEmphasized
      ? (colors?.emphasizedSelectedBorder ?? colors?.selectedBorder)
      : colors?.selectedBorder
    : isOutline
      ? (colors?.outlineBorder ?? colors?.border)
      : interactionState === "hover" && colors?.borderHover
        ? colors.borderHover
        : colors?.border;
  return { background, color, border };
}

describe("ADR-297 condition tree ≡ legacy paint chain (whole table)", () => {
  it("evaluator state paint == legacy chain on the generator's input, every rule × variant × condition", () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const [type, rule] of RULES) {
      const reach = rulePaintReach(type, rule);
      const fillStyles = [undefined, ...(reach.fillStyles ?? [])];
      const selections = reach.selectable ? [false, true] : [false];
      for (const [name, variant] of Object.entries(rule.variants ?? {})) {
        const paint = variant.paint;
        const legacy = legacyVariantPaint(paint, rule.fillStyleValues);
        for (const fillStyle of fillStyles)
          for (const isQuiet of [false, true])
            for (const isEmphasized of [false, true])
              for (const isSelected of selections)
                for (const interactionState of INTERACTIONS) {
                  const props = {
                    fillStyle,
                    isQuiet,
                    isEmphasized,
                    isSelected,
                  };
                  const before = legacyStatePaint(
                    legacy,
                    props,
                    interactionState,
                    rule.fillStyleValues,
                  );
                  const conditions = {
                    isHovered: interactionState === "hover",
                    isPressed: interactionState === "pressed",
                    isQuiet,
                    isEmphasized,
                    isSelected,
                    ...(fillStyle ? { fillStyle } : {}),
                  };
                  const after = {
                    background: evaluatePaint(
                      paint.backgroundColor,
                      conditions,
                    ),
                    color: evaluatePaint(paint.color, conditions),
                    border: evaluatePaint(paint.borderColor, conditions),
                  };
                  compared += 1;
                  if (JSON.stringify(before) !== JSON.stringify(after))
                    mismatches.push(
                      `${type}.${name} ${JSON.stringify(props)} ${interactionState}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
                    );
                }
      }
    }
    expect(compared).toBeGreaterThan(3_000);
    expect(mismatches.slice(0, 20)).toEqual([]);
  });

  it("tree → legacy input → tree round-trips every variant", () => {
    const mismatches: string[] = [];
    for (const [type, rule] of RULES)
      for (const [name, variant] of Object.entries(rule.variants ?? {})) {
        const back = variantPaintTree(
          legacyVariantPaint(variant.paint, rule.fillStyleValues),
          rule.fillStyleValues,
          rulePaintReach(type, rule),
        );
        // (Phase 3: the `staticColor` branch has no legacy slot — the generator's legacy input never
        //  carried the static scheme, the manual sheets did)
        if (
          JSON.stringify(sortDeep(withoutStatic(back))) !==
          JSON.stringify(sortDeep(withoutStatic(variant.paint)))
        )
          mismatches.push(
            `${type}.${name}: ${JSON.stringify(variant.paint)} → ${JSON.stringify(back)}`,
          );
      }
    expect(mismatches).toEqual([]);
  });
});

/** The paint without its `staticColor` branches — a node left with `default` only is that leaf (both forms mean the same). */
function withoutStatic(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>))
    if (key !== "staticColor") out[key] = withoutStatic(child);
  const keys = Object.keys(out);
  return keys.length === 1 && keys[0] === "default" ? out.default : out;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]),
    );
  return value;
}
