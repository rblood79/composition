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
  css.textContent = bundleCss + "\nbutton { transition: none !important; }";
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});
const states = [
  "default",
  "hover",
  "pressed",
  "focus",
  "expanded",
  "disabled",
  "disabled-hover",
] as const;
const cases = (["light", "dark"] as const).flatMap((mode) =>
  (["ActionButton", "ToggleButton"] as const).flatMap((type) =>
    (type === "ActionButton"
      ? ["off"]
      : ["off", "selected", "emphasized"]
    ).flatMap((selection) =>
      [false, true].flatMap((quiet) =>
        ([undefined, "white", "black"] as const).flatMap((staticColor) =>
          states.map((state) => ({
            mode,
            type,
            selection,
            quiet,
            staticColor,
            state,
          })),
        ),
      ),
    ),
  ),
);
// 설치 S2 1.8.2 ActionButton.btnStyles 및 dist/private/ActionButton.css의 독립 기준값.
const tones = {
  light: {
    surface: "#e9e9e9",
    surfaceActive: "#e1e1e1",
    neutral: "#292929",
    active: "#131313",
    on: "#ffffff",
    disabled: "#c6c6c6",
    accent: "#3b63fb",
    accentActive: "#274dea",
  },
  dark: {
    surface: "#2c2c2c",
    surfaceActive: "#323232",
    neutral: "#dbdbdb",
    active: "#f2f2f2",
    on: "#111111",
    disabled: "#444444",
    accent: "#345bf8",
    accentActive: "#2549e5",
  },
};
it.each(cases)(
  "$mode $type $selection quiet=$quiet static=$staticColor $state",
  ({ mode, type, selection, quiet, staticColor, state }) => {
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
    button.className = `react-aria-${type}${type === "ToggleButton" ? " button-base" : ""}`;
    Object.assign(button.dataset, {
      catalogId: "action-toggle",
      rac: "",
      size: "M",
      variant: "default",
    });
    const selected = selection !== "off";
    const emphasized = selection === "emphasized";
    const disabled = state.startsWith("disabled");
    if (quiet) button.dataset.quiet = "true";
    if (selected) button.dataset.selected = "true";
    if (emphasized) button.dataset.emphasized = "true";
    if (staticColor) button.dataset.staticColor = staticColor;
    if (state === "hover" || state === "disabled-hover")
      button.dataset.hovered = "true";
    if (state === "pressed") button.dataset.pressed = "true";
    if (state === "expanded") button.setAttribute("aria-expanded", "true");
    if (state === "focus") button.dataset.focusVisible = "true";
    if (disabled) {
      button.disabled = true;
      button.dataset.disabled = "true";
    }
    button.textContent = "Action";
    const probe = document.body.appendChild(document.createElement("span"));
    const normalized = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const resolved = (value: string | undefined) => {
      const key = /^\{color\.(.+)\}$/.exec(value ?? "")?.[1];
      return normalized(key ? snapshot.colors[mode][key]! : value!);
    };
    const rule = COMPONENT_RULES_TABLE[type]!;
    const paint = (style?: Record<string, string>) =>
      resolveCatalogPaint({
        variant: rule.variants.default,
        size: undefined,
        props: {
          isQuiet: quiet,
          isSelected: selected,
          isEmphasized: emphasized,
          isDisabled: disabled,
          staticColor,
          _isFocusVisible: state === "focus",
          _overlayOpen: state === "expanded",
        },
        interactionState:
          state === "hover" || state === "disabled-hover"
            ? "hover"
            : state === "pressed"
              ? "pressed"
              : "default",
        style,
      });
    const active = !disabled && state !== "default";
    const t = tones[mode];
    let background = selected
      ? emphasized
        ? active
          ? t.accentActive
          : t.accent
        : active
          ? t.active
          : t.neutral
      : quiet && !active
        ? "transparent"
        : active
          ? t.surfaceActive
          : t.surface;
    let color = selected
      ? emphasized
        ? "#ffffff"
        : t.on
      : active
        ? t.active
        : t.neutral;
    if (disabled) {
      background = quiet ? "transparent" : t.surface;
      color = t.disabled;
    }
    if (staticColor) {
      const overlay = (alpha: number) =>
        `rgba(${staticColor === "white" ? "255, 255, 255" : "0, 0, 0"}, ${alpha})`;
      background = disabled
        ? quiet
          ? "transparent"
          : overlay(0.11)
        : selected
          ? overlay(active ? 0.94 : 0.85)
          : quiet && !active
            ? "transparent"
            : overlay(active ? 0.14 : 0.11);
      color = disabled
        ? overlay(0.21)
        : (staticColor === "white") !== selected
          ? "#ffffff"
          : "#000000";
    }
    try {
      expect(getComputedStyle(button).backgroundColor).toBe(
        normalized(background),
      );
      expect(getComputedStyle(button).color).toBe(normalized(color));
      expect(getComputedStyle(button).opacity).toBe("1");
      expect(getComputedStyle(button).borderTopWidth).toBe("0px");
      expect(resolved(paint().backgroundColor)).toBe(normalized(background));
      expect(resolved(paint().color)).toBe(normalized(color));
      button.style.backgroundColor = "#008866";
      button.style.color = "#fedcba";
      expect(getComputedStyle(button).backgroundColor).toBe(
        resolved(paint({ backgroundColor: "#008866" }).backgroundColor),
      );
      expect(getComputedStyle(button).color).toBe(
        resolved(paint({ color: "#fedcba" }).color),
      );
      button.removeAttribute("style");
      expect(getComputedStyle(button).backgroundColor).toBe(
        normalized(background),
      );
      expect(getComputedStyle(button).color).toBe(normalized(color));
    } finally {
      button.remove();
      probe.remove();
    }
  },
);
