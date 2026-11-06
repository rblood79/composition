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
  ["primary", "secondary"].flatMap((variant) =>
    ["fill", "outline"].flatMap((fillStyle) =>
      (["default", "hover", "pressed", "focus"] as const).map((state) => ({
        mode,
        variant,
        fillStyle,
        state,
      })),
    ),
  ),
);
// S2 Button.tsx + s2NeutralColors.test.ts 설치 macro 검증 역할값.
const s2 = {
  light: {
    neutral: "rgb(41, 41, 41)",
    active: "rgb(19, 19, 19)",
    surface: "rgb(233, 233, 233)",
    surfaceActive: "rgb(225, 225, 225)",
    border: "rgb(218, 218, 218)",
    borderActive: "rgb(198, 198, 198)",
    on: "rgb(255, 255, 255)",
  },
  dark: {
    neutral: "rgb(219, 219, 219)",
    active: "rgb(242, 242, 242)",
    surface: "rgb(44, 44, 44)",
    surfaceActive: "rgb(50, 50, 50)",
    border: "rgb(57, 57, 57)",
    borderActive: "rgb(68, 68, 68)",
    on: "rgb(17, 17, 17)",
  },
};
const rgb = (hex: string) =>
  hex === "transparent"
    ? "rgba(0, 0, 0, 0)"
    : `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
it.each(cases)(
  "$mode $variant $fillStyle $state — S2 · Canvas · DOM · 스타일 복원",
  ({ mode, variant, fillStyle, state }) => {
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
      catalogId: "neutral-parity",
      rac: "",
      variant,
      fillStyle,
    });
    if (state === "hover") button.dataset.hovered = "true";
    if (state === "pressed") button.dataset.pressed = "true";
    if (state === "focus") button.dataset.focusVisible = "true";
    button.textContent = "Neutral";
    const rule = COMPONENT_RULES_TABLE.Button!;
    const paint = (style?: Record<string, string>) =>
      resolveCatalogPaint({
        variant: rule.variants[variant],
        size: undefined,
        props: { fillStyle, _isFocusVisible: state === "focus" },
        style,
        interactionState: state === "focus" ? "default" : state,
        fillStyleValues: rule.fillStyleValues,
      });
    const resolveColor = (value: string | undefined) => {
      const key = /^\{color\.(.+)\}$/.exec(value ?? "")?.[1];
      return rgb(key ? snapshot.colors[mode][key]! : value!);
    };
    const active = state !== "default";
    const expected = s2[mode];
    const content = active ? expected.active : expected.neutral;
    const surface = active ? expected.surfaceActive : expected.surface;
    const text =
      variant === "primary" && fillStyle === "fill" ? expected.on : content;
    const background =
      fillStyle === "outline"
        ? active
          ? expected.surface
          : "rgba(0, 0, 0, 0)"
        : variant === "primary"
          ? content
          : surface;
    try {
      expect(getComputedStyle(button).color).toBe(text);
      expect(getComputedStyle(button).backgroundColor).toBe(background);
      expect(resolveColor(paint().color)).toBe(text);
      expect(resolveColor(paint().backgroundColor)).toBe(background);
      if (fillStyle === "outline") {
        const border =
          variant === "primary"
            ? content
            : active
              ? expected.borderActive
              : expected.border;
        expect(getComputedStyle(button).borderTopColor).toBe(border);
        expect(resolveColor(paint().borderColor)).toBe(border);
      }
      button.style.color = "#123456";
      button.style.backgroundColor = "#fedcba";
      const authored = paint({ color: "#123456", backgroundColor: "#fedcba" });
      expect(getComputedStyle(button).color).toBe(resolveColor(authored.color));
      expect(getComputedStyle(button).backgroundColor).toBe(
        resolveColor(authored.backgroundColor),
      );
      button.style.removeProperty("color");
      button.style.removeProperty("background-color");
      expect(getComputedStyle(button).color).toBe(text);
      expect(getComputedStyle(button).backgroundColor).toBe(background);
    } finally {
      button.remove();
    }
  },
);
