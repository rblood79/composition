import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { resolveCatalogPaint } from "../resolvers/resolveCatalogPaint";

/**
 * ADR-297 Phase 3h — the confirmed differences (breakdown §6.1 #2 · #4 · #5 · #6 · #7 · #9 · #10 · #11) follow the
 * installed S2 1.8.2 source (user decision 2). The oracle is S2's style macro, not this repository's previous output:
 * `Button.tsx` (`backgroundColor` · `color` · `borderColor` key order — fill → outline → disabled → static),
 * `ActionButton.tsx` (quiet = rest only), `InlineAlert.tsx` (`subtleFill` border `transparent`), the state step
 * (`spectrum-theme.ts` `nextColorStop` — hover · pressed · focus are the next stop) and the overlay alphas
 * (`style/dist/spectrum-theme.mjs` `transparent-overlay-N`). Canvas evaluates through `resolveCatalogPaint`;
 * the DOM sheet compiles the same tree.
 */
type Interaction = "default" | "hover" | "pressed";
function paint(
  type: string,
  variant: string,
  props: Record<string, unknown>,
  interactionState: Interaction = "default",
) {
  const rule = COMPONENT_RULES_TABLE[type]!;
  const out = resolveCatalogPaint({
    variant: rule.variants[variant],
    size: undefined,
    props,
    style: undefined,
    interactionState,
    fillStyleValues: rule.fillStyleValues,
  });
  return {
    background: out.backgroundColor,
    color: out.color,
    border: out.borderColor,
  };
}

describe("ADR-297 3h — Button · ToggleButton · InlineAlert paint = S2", () => {
  it("#5 pressed is the hover stop and the fill border never rings", () => {
    expect(paint("Button", "accent", {}, "pressed")).toEqual({
      background: "{color.accent-fill-hover}",
      color: "{color.on-accent}",
      border: "{color.accent-fill-hover}",
    });
    expect(paint("Button", "negative", {}, "pressed").background).toBe(
      "{color.negative-fill-hover}",
    );
    const primary = paint("Button", "primary", {}, "pressed");
    expect(primary.border).toBe(primary.background);
  });

  it("#2 outline: gray-100 under hover · pressed, border = baseColor stops", () => {
    for (const state of ["hover", "pressed"] as const)
      expect(
        paint("Button", "primary", { fillStyle: "outline" }, state),
      ).toEqual({
        background: "{color.neutral-surface}",
        color: "{color.neutral-content-hover}",
        border: "{color.neutral-fill-hover}",
      });
    expect(paint("Button", "primary", { fillStyle: "outline" })).toEqual({
      background: "{color.transparent}",
      color: "{color.neutral-content}",
      border: "{color.neutral-fill}",
    });
    expect(
      paint("Button", "secondary", { fillStyle: "outline" }, "hover").border,
    ).toBe("{color.neutral-outline-hover}");
  });

  it("#7 disabled is a color, not opacity", () => {
    for (const variant of ["accent", "primary", "secondary", "negative"])
      expect(paint("Button", variant, { isDisabled: true }, "hover")).toEqual({
        background: "{color.disabled}",
        color: "{color.disabled-content}",
        border: "{color.disabled}",
      });
    expect(
      paint("Button", "primary", { isDisabled: true, fillStyle: "outline" }),
    ).toEqual({
      background: "{color.transparent}",
      color: "{color.disabled-content}",
      border: "{color.border-disabled}",
    });
    const states = COMPONENT_RULES_TABLE.Button!.structure?.stateStyles;
    expect(states?.opacity).toBeUndefined();
  });

  it("#9 static: the transparent-overlay stops of the static color", () => {
    expect(paint("Button", "primary", { staticColor: "white" })).toEqual({
      background: "rgba(255, 255, 255, 0.85)",
      color: "#000000",
      border: "{color.transparent}",
    });
    expect(
      paint("Button", "primary", { staticColor: "white" }, "hover").background,
    ).toBe("rgba(255, 255, 255, 0.94)");
    expect(
      paint("Button", "secondary", { staticColor: "black" }, "hover"),
    ).toEqual({
      background: "rgba(0, 0, 0, 0.14)",
      color: "#000000",
      border: "{color.transparent}",
    });
    expect(
      paint(
        "Button",
        "secondary",
        { staticColor: "white", fillStyle: "outline" },
        "hover",
      ),
    ).toEqual({
      background: "rgba(255, 255, 255, 0.11)",
      color: "#ffffff",
      border: "rgba(255, 255, 255, 0.21)",
    });
    expect(
      paint("Button", "primary", { staticColor: "white", isDisabled: true })
        .color,
    ).toBe("rgba(255, 255, 255, 0.21)");
    // S2 accent/negative의 enabled fill 색은 staticColor에서도 유지된다.
    expect(paint("Button", "accent", { staticColor: "white" })).toEqual({
      ...paint("Button", "accent", {}),
      border: "{color.transparent}",
    });
  });

  it("#6 · #10 quiet ToggleButton: rest only is transparent; selected is neutral", () => {
    expect(
      paint("ToggleButton", "default", { isQuiet: true }, "hover").background,
    ).toBe("{color.neutral-surface-hover}");
    expect(
      paint("ToggleButton", "default", { isQuiet: true }, "pressed").background,
    ).toBe("{color.neutral-surface-hover}");
    expect(
      paint("ToggleButton", "default", { isQuiet: true, isSelected: true }),
    ).toEqual({
      background: "{color.neutral-fill}",
      color: "{color.on-neutral}",
      border: "{color.transparent}",
    });
  });

  it("#11 InlineAlert subtleFill has no border", () => {
    for (const variant of Object.keys(
      COMPONENT_RULES_TABLE.InlineAlert!.variants,
    ))
      expect(
        paint("InlineAlert", variant, { fillStyle: "subtleFill" }).border,
      ).toBe("{color.transparent}");
  });

  it("the DOM sheet compiles the same disabled branch (no opacity block)", () => {
    const css = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../components/styles/generated/Button.css",
      ),
      "utf8",
    );
    expect(css).toMatch(
      /\.react-aria-Button:where\(\[data-variant="accent"\]\[data-disabled\]\) \{\s*background: var\(--bg-disabled\);/,
    );
    expect(css).not.toMatch(/opacity: 0\.38/);
  });
});
