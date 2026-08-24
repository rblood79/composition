import { describe, expect, it } from "vitest";

import type {
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/composition-document.types";
import { resolveCatalogPaint } from "../resolvers/resolveCatalogPaint";

const SIZE: ComponentRuleSize = { borderWidth: 1 };

const BUTTON_VARIANT: ComponentRuleVariant = {
  fill: {
    default: {
      base: "base-bg",
      hover: "hover-bg",
      pressed: "pressed-bg",
      selected: "selected-bg",
      emphasizedSelected: "emphasized-selected-bg",
    },
    outline: { base: "outline-bg", hover: "outline-hover-bg" },
    subtle: { base: "subtle-bg", pressed: "subtle-pressed-bg" },
    quiet: { base: "quiet-bg", hover: "quiet-hover-bg" },
    alpha: 0.8,
  },
  colors: {
    text: "base-text",
    textHover: "hover-text",
    border: "base-border",
    borderHover: "hover-border",
    outlineText: "outline-text",
    outlineBorder: "outline-border",
    subtleText: "subtle-text",
    selectedText: "selected-text",
    selectedBorder: "selected-border",
    emphasizedSelectedText: "emphasized-selected-text",
    emphasizedSelectedBorder: "emphasized-selected-border",
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

  it("opaque staticColor는 역상 text를 쓰고 value-fill track은 25% wash를 보존한다", () => {
    expect(resolve({ staticColor: "black" })).toMatchObject({
      backgroundColor: "#000000",
      color: "#ffffff",
      borderColor: "#000000",
      backgroundAlpha: 0.8,
      staticTrackWash: false,
    });

    expect(
      resolve({ staticColor: "white" }, "default", {
        ...BUTTON_VARIANT,
        fillBar: "value-fill",
      }),
    ).toMatchObject({
      backgroundColor: "#ffffff",
      color: "#ffffff",
      borderColor: "#ffffff",
      backgroundAlpha: 0.2,
      staticTrackWash: true,
    });
  });

  it("text-only/transparent variant에서 staticColor가 새 border나 opaque box를 만들지 않는다", () => {
    const textOnly: ComponentRuleVariant = {
      fill: {
        default: { base: "{color.transparent}" },
        alpha: 0,
      },
      colors: { text: "variant-text" },
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

  it("transparent border는 width channel이 있을 때만 static border 교체 대상이다", () => {
    const transparentBorder: ComponentRuleVariant = {
      fill: { default: { base: "opaque-bg" } },
      colors: { border: "{color.transparent}" },
    };

    expect(
      resolveCatalogPaint({
        variant: transparentBorder,
        size: undefined,
        props: { staticColor: "black" },
        style: undefined,
        interactionState: "default",
      }).borderColor,
    ).toBe("{color.transparent}");
    expect(
      resolve({ staticColor: "black" }, "default", transparentBorder, {
        borderWidth: 1,
      }).borderColor,
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
      color: "{color.accent}",
      borderColor: undefined,
    });
  });
});
