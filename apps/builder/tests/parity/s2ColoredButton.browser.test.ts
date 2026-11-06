import { afterAll, beforeAll, expect, it } from "vitest";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { resolveThemeSnapshot } from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { createThemeDefinition } from "../../../../packages/shared/src/theme/themesCollection";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";

const css = document.createElement("style");
beforeAll(() => {
  css.textContent = bundleCss + "\n* { transition: none !important; }";
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});
const cases = (["light", "dark"] as const).flatMap((mode) =>
  (["accent", "negative"] as const).flatMap((variant) =>
    ["fill", "outline"].flatMap((fillStyle) =>
      (["default", "hover", "pressed", "focus", "disabled"] as const).flatMap(
        (state) =>
          ([undefined, "white", "black"] as const).map((staticColor) => ({
            mode,
            variant,
            fillStyle,
            state,
            staticColor,
          })),
      ),
    ),
  ),
);
// 설치 S2 Button.css + s2ColoredButtonTokens.test.ts macro 역할 검증.
const fills = {
  light: { accent: ["#3b63fb", "#274dea"], negative: ["#d73220", "#b72818"] },
  dark: { accent: ["#345bf8", "#2549e5"], negative: ["#cd2e1d", "#b12617"] },
};
const rgb = (value: string) => {
  if (value === "transparent") return "rgba(0, 0, 0, 0)";
  if (value.startsWith("rgba")) return value;
  return `rgb(${[1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)).join(", ")})`;
};
it.each(cases)(
  "$mode $variant $fillStyle $state static=$staticColor",
  ({ mode, variant, fillStyle, state, staticColor }) => {
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("test", "Test"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    applyCatalogPreviewTheme({
      key: "",
      colorMode: mode,
      install() {},
      snapshot: () => snapshot,
    });
    const button = document.body.appendChild(document.createElement("button"));
    button.className = "react-aria-Button button-base";
    Object.assign(button.dataset, {
      catalogId: "colored-parity",
      rac: "",
      variant,
      fillStyle,
    });
    if (staticColor) button.dataset.staticColor = staticColor;
    if (state === "hover") button.dataset.hovered = "true";
    if (state === "pressed") button.dataset.pressed = "true";
    if (state === "focus") button.dataset.focusVisible = "true";
    if (state === "disabled") {
      button.dataset.disabled = "true";
      button.disabled = true;
    }
    button.textContent = "Colored";
    const rule = COMPONENT_RULES_TABLE.Button!;
    const paint = (style?: Record<string, string>) =>
      resolveCatalogPaint({
        variant: rule.variants[variant],
        size: undefined,
        props: {
          fillStyle,
          staticColor,
          isDisabled: state === "disabled",
          _isFocusVisible: state === "focus",
        },
        style,
        interactionState:
          state === "hover" || state === "pressed" ? state : "default",
        fillStyleValues: rule.fillStyleValues,
      });
    const resolved = (value: string | undefined) => {
      const key = /^\{color\.(.+)\}$/.exec(value ?? "")?.[1];
      return rgb(key ? snapshot.colors[mode][key]! : value!);
    };
    const active = ["hover", "pressed", "focus"].includes(state);
    const disabled = state === "disabled";
    const dark = mode === "dark";
    const outline = fillStyle === "outline";
    const overlay = (alpha: number) =>
      `rgba(${staticColor === "white" ? "255, 255, 255" : "0, 0, 0"}, ${alpha})`;
    let text = outline
      ? dark
        ? active
          ? "#f2f2f2"
          : "#dbdbdb"
        : active
          ? "#131313"
          : "#292929"
      : "#ffffff";
    let background = outline
      ? active
        ? dark
          ? "#2c2c2c"
          : "#e9e9e9"
        : "transparent"
      : fills[mode][variant][active ? 1 : 0]!;
    if (staticColor && outline) {
      text = staticColor === "white" ? "#ffffff" : "#000000";
      background = active ? overlay(0.11) : "transparent";
    }
    if (disabled) {
      text = staticColor ? overlay(0.21) : dark ? "#444444" : "#c6c6c6";
      background = outline
        ? "transparent"
        : staticColor
          ? overlay(0.11)
          : dark
            ? "#2c2c2c"
            : "#e9e9e9";
    }
    const border = disabled
      ? staticColor
        ? overlay(0.17)
        : dark
          ? "#393939"
          : "#dadada"
      : text;
    try {
      expect(getComputedStyle(button).color).toBe(rgb(text));
      expect(getComputedStyle(button).backgroundColor).toBe(rgb(background));
      expect(resolved(paint().color)).toBe(rgb(text));
      expect(resolved(paint().backgroundColor)).toBe(rgb(background));
      if (outline) {
        expect(getComputedStyle(button).borderTopColor).toBe(rgb(border));
        expect(resolved(paint().borderColor)).toBe(rgb(border));
      }
      // currentColor 테두리는 사용자 글자색을 따르고 명시 borderColor가 있으면 그 값을 쓴다.
      button.style.color = "#123456";
      const authored = paint({ color: "#123456" });
      expect(getComputedStyle(button).color).toBe(resolved(authored.color));
      if (outline && !disabled) {
        expect(getComputedStyle(button).borderTopColor).toBe("rgb(18, 52, 86)");
        expect(resolved(authored.borderColor)).toBe("rgb(18, 52, 86)");
      }
      button.style.borderColor = "#fedcba";
      expect(getComputedStyle(button).borderTopColor).toBe(
        resolved(
          paint({ color: "#123456", borderColor: "#fedcba" }).borderColor,
        ),
      );
      button.removeAttribute("style");
      expect(getComputedStyle(button).color).toBe(rgb(text));
      if (outline)
        expect(getComputedStyle(button).borderTopColor).toBe(rgb(border));
    } finally {
      button.remove();
    }
  },
);
