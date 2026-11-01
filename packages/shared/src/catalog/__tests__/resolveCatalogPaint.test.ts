import { describe, expect, it } from "vitest";

import type {
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/catalog-style.types";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { resolveCatalogPaint } from "../resolvers/resolveCatalogPaint";
import { evaluatePaint } from "../rule/rulePaintTree";

const SIZE: ComponentRuleSize = { borderWidth: 1 };

// ADR-297: a variant's state paint is its condition tree (`paint` — later keys win).
const BUTTON_VARIANT: ComponentRuleVariant = {
  alpha: 0.8,
  paint: {
    backgroundColor: {
      default: "base-bg",
      isHovered: "hover-bg",
      isPressed: "pressed-bg",
      fillStyle: {
        outline: { default: "outline-bg", isHovered: "outline-hover-bg" },
        subtle: { default: "subtle-bg", isPressed: "subtle-pressed-bg" },
      },
      isQuiet: { default: "quiet-bg", isHovered: "quiet-hover-bg" },
      isSelected: {
        default: "selected-bg",
        isEmphasized: "emphasized-selected-bg",
      },
      // (ADR-297 Phase 3: the static scheme is a tree branch — the codemod writes it from the old rule)
      staticColor: { black: "#000000", white: "#ffffff" },
    },
    color: {
      default: "base-text",
      isHovered: "hover-text",
      fillStyle: { outline: "outline-text", subtle: "subtle-text" },
      isSelected: {
        default: "selected-text",
        isEmphasized: "emphasized-selected-text",
      },
      staticColor: { black: "#ffffff", white: "#000000" },
    },
    borderColor: {
      default: "base-border",
      isHovered: "hover-border",
      fillStyle: { outline: "outline-border" },
      isSelected: {
        default: "selected-border",
        isEmphasized: "emphasized-selected-border",
      },
      staticColor: { black: "#000000", white: "#ffffff" },
    },
  },
};

function resolve(
  props: Readonly<Record<string, unknown>> = {},
  interactionState: "default" | "hover" | "pressed" = "default",
  variant: ComponentRuleVariant | undefined = BUTTON_VARIANT,
  size: ComponentRuleSize | undefined = SIZE,
) {
  const style = props.style as Readonly<Record<string, unknown>> | undefined;
  return resolveCatalogPaint({
    variant,
    size,
    props,
    style,
    interactionState,
  });
}

describe("resolveCatalogPaint", () => {
  it("default/hover/pressed와 fillStyle/quiet 상태를 data channel로 선택한다", () => {
    expect(resolve().backgroundColor).toBe("base-bg");
    expect(resolve({}, "hover").backgroundColor).toBe("hover-bg");
    expect(resolve({}, "pressed").backgroundColor).toBe("pressed-bg");
    expect(resolve({ fillStyle: "outline" }, "hover").backgroundColor).toBe(
      "outline-hover-bg",
    );
    expect(resolve({ fillStyle: "subtle" }, "pressed").backgroundColor).toBe(
      "subtle-pressed-bg",
    );
    expect(
      resolve({ fillStyle: "outline", isQuiet: true }, "hover").backgroundColor,
    ).toBe("quiet-hover-bg");
  });

  it("selected/emphasized는 interaction/fillStyle보다 우선하고 대응 text/border를 고른다", () => {
    expect(
      resolve(
        { fillStyle: "outline", isQuiet: true, isSelected: true },
        "pressed",
      ),
    ).toMatchObject({
      backgroundColor: "selected-bg",
      color: "selected-text",
      borderColor: "selected-border",
    });
    expect(
      resolve({ isSelected: true, isEmphasized: true }, "hover"),
    ).toMatchObject({
      backgroundColor: "emphasized-selected-bg",
      color: "emphasized-selected-text",
      borderColor: "emphasized-selected-border",
    });
  });

  it("inline style override가 static/selected/variant paint보다 우선한다", () => {
    expect(
      resolve({
        isSelected: true,
        staticColor: "black",
        style: {
          backgroundColor: "#112233",
          color: "#445566",
          borderColor: "#778899",
        },
      }),
    ).toMatchObject({
      backgroundColor: "#112233",
      color: "#445566",
      borderColor: "#778899",
      hasVisibleBoxPaint: true,
      hasOpaqueCatalogBackground: true,
    });
  });

  it("opaque staticColor는 역상 text를 쓰고 rule 의 staticAlpha (S2 overlay 투명도) 로 칠한다", () => {
    expect(resolve({ staticColor: "black" })).toMatchObject({
      backgroundColor: "#000000",
      color: "#ffffff",
      borderColor: "#000000",
      backgroundAlpha: 0.8,
      staticTrackWash: false,
    });

    // (a value-fill track — S2 `transparent-overlay-300`: its text keeps the static color)
    const track = resolve({ staticColor: "white" }, "default", {
      ...BUTTON_VARIANT,
      // (a track's static text keeps the static color — its tree branch says so)
      paint: {
        ...BUTTON_VARIANT.paint,
        color: { default: "base-text", staticColor: { white: "#ffffff" } },
      },
      fillBar: "value-fill",
      staticAlpha: 0.17,
    });
    expect(track).toMatchObject({
      backgroundColor: "#ffffff",
      color: "#ffffff",
      borderColor: "#ffffff",
      staticTrackWash: true,
    });
    expect(track.backgroundAlpha).toBeCloseTo(0.8 * 0.17);
    // (staticAlpha 는 static 칠에만 — auto 는 rule 의 alpha 그대로)
    expect(
      resolve({}, "default", { ...BUTTON_VARIANT, staticAlpha: 0.17 })
        .backgroundAlpha,
    ).toBe(0.8);
  });

  it("text-only/transparent variant에서 staticColor가 새 border나 opaque box를 만들지 않는다", () => {
    const textOnly: ComponentRuleVariant = {
      alpha: 0,
      paint: {
        backgroundColor: "{color.transparent}",
        color: {
          default: "variant-text",
          staticColor: { black: "#000000", white: "#ffffff" },
        },
      },
    };

    expect(
      resolve({ staticColor: "black" }, "default", textOnly, undefined),
    ).toEqual({
      backgroundColor: "{color.transparent}",
      color: "#000000",
      borderColor: undefined,
      backgroundAlpha: 0,
      staticTrackWash: false,
      hasVisibleBoxPaint: false,
      hasOpaqueCatalogBackground: false,
    });
  });

  it("사용자 inline border 는 box archetype 신호가 아니다 — text-only variant 에 border 를 줘도 inline", () => {
    const textOnly: ComponentRuleVariant = {
      alpha: 0,
      paint: { backgroundColor: "{color.transparent}", color: "variant-text" },
    };
    expect(
      resolve(
        { style: { borderColor: "#C20E0E", borderWidth: 1 } },
        "default",
        textOnly,
        undefined,
      ),
    ).toMatchObject({
      borderColor: "#C20E0E",
      hasVisibleBoxPaint: true,
      hasOpaqueCatalogBackground: false,
    });
  });

  it("static 테두리는 트리의 staticColor 가지만 — size 의 폭 채널로 판정하지 않는다 (ADR-297 Phase 3)", () => {
    // (the width-channel rule moved into the codemod `adr297-static-to-tree.ts`: a transparent border
    //  gets a static branch only where the rule's sizes carry a border width)
    const transparentBorder: ComponentRuleVariant = {
      paint: {
        backgroundColor: "opaque-bg",
        borderColor: "{color.transparent}",
      },
    };
    for (const size of [undefined, { borderWidth: 1 }])
      expect(
        resolve({ staticColor: "black" }, "default", transparentBorder, size)
          .borderColor,
      ).toBe("{color.transparent}");
    const withBranch: ComponentRuleVariant = {
      paint: {
        backgroundColor: "opaque-bg",
        borderColor: {
          default: "{color.transparent}",
          staticColor: { black: "#000000" },
        },
      },
    };
    expect(
      resolve({ staticColor: "black" }, "default", withBranch, undefined)
        .borderColor,
    ).toBe("#000000");
  });

  it("inline background는 visible paint에는 포함하지만 catalog opaque archetype을 바꾸지 않는다", () => {
    expect(
      resolveCatalogPaint({
        variant: undefined,
        size: undefined,
        props: { style: { backgroundColor: "#abcdef" } },
        style: { backgroundColor: "#abcdef" },
        interactionState: "default",
      }),
    ).toEqual({
      backgroundColor: "#abcdef",
      color: undefined,
      borderColor: undefined,
      backgroundAlpha: 1,
      staticTrackWash: false,
      hasVisibleBoxPaint: true,
      hasOpaqueCatalogBackground: false,
    });
  });

  it("_isShowAll data signal은 투명 background/accent text/no-border를 고정한다", () => {
    expect(resolve({ _isShowAll: true })).toMatchObject({
      backgroundColor: "{color.transparent}",
      color: "{color.accent-content}",
      borderColor: undefined,
    });
  });
});

/**
 * §9 검증 매트릭스 "Link" 행 — staticColor auto/black/white + text-only.
 *
 * 위의 합성 text-only fixture 와 규칙은 같지만, 실제 catalog `Link` rule 로 한 번 더 고정한다.
 * Link 는 `fill.alpha = 0` 에 border 채널이 없는 유일한 조합이라, staticColor 가 배경/테두리를
 * 만들지 않고 **텍스트만** 바꾸는지가 이 행의 계약이다.
 */
describe("resolveCatalogPaint — catalog Link (§9 매트릭스 행)", () => {
  const rule = COMPONENT_RULES_TABLE.Link;
  const size = rule.sizes[rule.defaultSize ?? "M"];

  function link(
    props: Readonly<Record<string, unknown>>,
    variantName = rule.defaultVariant ?? "primary",
  ) {
    return resolveCatalogPaint({
      variant: rule.variants[variantName],
      size,
      props,
      style: props.style as Readonly<Record<string, unknown>> | undefined,
      interactionState: "default",
    });
  }

  it("staticColor=auto 는 variant text 를 쓰고 box paint 를 만들지 않는다", () => {
    const paint = link({});
    expect(paint.color).toBe(
      evaluatePaint(rule.variants.primary.paint?.color, {}),
    );
    expect(paint.hasVisibleBoxPaint).toBe(false);
    expect(paint.hasOpaqueCatalogBackground).toBe(false);
    expect(paint.borderColor).toBeUndefined();
  });

  it("staticColor=black/white 는 text 만 고정색으로 바꾼다 (역상 아님)", () => {
    // alpha:0 이라 opaque background 가 아니므로 역상 규칙이 아니라 static 색 그대로다.
    expect(link({ staticColor: "black" }).color).toBe("#000000");
    expect(link({ staticColor: "white" }).color).toBe("#ffffff");
  });

  it("staticColor 가 Link 에 새 border 나 opaque box 를 만들지 않는다", () => {
    for (const staticColor of ["black", "white"] as const) {
      const paint = link({ staticColor });
      expect(paint.borderColor).toBeUndefined();
      expect(paint.hasVisibleBoxPaint).toBe(false);
      expect(paint.hasOpaqueCatalogBackground).toBe(false);
    }
  });

  it("inline override 는 Link 에서도 static/variant 보다 우선한다", () => {
    const paint = link({
      staticColor: "black",
      style: { color: "#123456", backgroundColor: "#abcdef" },
    });
    expect(paint.color).toBe("#123456");
    expect(paint.backgroundColor).toBe("#abcdef");
    expect(paint.hasVisibleBoxPaint).toBe(true);
    // inline background 는 catalog opaque archetype 을 바꾸지 않는다.
    expect(paint.hasOpaqueCatalogBackground).toBe(false);
  });

  it("secondary variant 도 같은 text-only 계약을 따른다", () => {
    const paint = link({ staticColor: "white" }, "secondary");
    expect(paint.color).toBe("#ffffff");
    expect(paint.borderColor).toBeUndefined();
    expect(paint.hasVisibleBoxPaint).toBe(false);
  });
});
