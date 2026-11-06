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
  ["accent", "primary", "secondary", "negative", "premium", "genai"].flatMap(
    (variant) =>
      ["fill", "outline"].map((fillStyle) => ({ mode, variant, fillStyle })),
  ),
);
it.each(cases)(
  "$mode $variant $fillStyle disabled 글자·편집·복원",
  ({ mode, variant, fillStyle }) => {
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
    button.dataset.catalogId = "disabled-parity";
    button.dataset.rac = "";
    button.dataset.variant = variant;
    button.dataset.fillStyle = fillStyle;
    button.dataset.disabled = "true";
    button.disabled = true;
    button.textContent = "Disabled";
    const rule = COMPONENT_RULES_TABLE.Button!;
    try {
      const paint = resolveCatalogPaint({
        variant: rule.variants[variant],
        size: undefined,
        props: { isDisabled: true, fillStyle },
        style: undefined,
        interactionState: "default",
        fillStyleValues: rule.fillStyleValues,
      });
      expect(paint.color).toBe("{color.disabled-content}");
      expect(snapshot.colors[mode]["disabled-content"]).toBe(
        mode === "light" ? "#c6c6c6" : "#444444",
      );
      expect(getComputedStyle(button).color).toBe(
        mode === "light" ? "rgb(198, 198, 198)" : "rgb(68, 68, 68)",
      );
      button.style.color = "#123456";
      expect(getComputedStyle(button).color).toBe("rgb(18, 52, 86)");
      button.style.removeProperty("color");
      expect(getComputedStyle(button).color).toBe(
        mode === "light" ? "rgb(198, 198, 198)" : "rgb(68, 68, 68)",
      );
    } finally {
      button.remove();
    }
  },
);
