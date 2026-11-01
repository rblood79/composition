import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { resolveCatalogPaint } from "../resolvers/resolveCatalogPaint";

/**
 * ADR-297 Phase 3h — the confirmed differences (breakdown §6.1 #2 · #4 · #5 · #6 · #7 · #9 · #10 · #11) follow the
 * installed S2 1.8.1 source (user decision 2). The oracle is S2's style macro, not this repository's previous output:
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
      background: "{color.accent-hover}",
      color: "{color.on-accent}",
      border: "{color.accent-hover}",
    });
    expect(paint("Button", "negative", {}, "pressed").background).toBe(
      "{color.negative-hover}",
    );
    const primary = paint("Button", "primary", {}, "pressed");
    expect(primary.border).toBe(primary.background);
  });

  it("#2 outline: gray-100 under hover · pressed, border = baseColor stops", () => {
    for (const state of ["hover", "pressed"] as const)
      expect(
        paint("Button", "primary", { fillStyle: "outline" }, state),
      ).toEqual({
        background: "{color.neutral-subtle}",
        color: "{color.neutral}",
        border: "{color.neutral-fill-hover}",
      });
    expect(paint("Button", "primary", { fillStyle: "outline" })).toEqual({
      background: "{color.transparent}",
      color: "{color.neutral}",
      border: "{color.neutral}",
    });
    expect(
      paint("Button", "secondary", { fillStyle: "outline" }, "hover").border,
    ).toBe("{color.border-hover}");
  });

  it("#7 disabled is a color, not opacity", () => {
    for (const variant of ["accent", "primary", "secondary", "negative"])
      expect(paint("Button", variant, { isDisabled: true }, "hover")).toEqual({
        background: "{color.disabled}",
        color: "{color.neutral-subdued}",
        border: "{color.disabled}",
      });
    expect(
      paint("Button", "primary", { isDisabled: true, fillStyle: "outline" }),
    ).toEqual({
      background: "{color.transparent}",
      color: "{color.neutral-subdued}",
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
    // (S2 has no static branch for accent · negative — their own paint)
    expect(paint("Button", "accent", { staticColor: "white" })).toEqual(
      paint("Button", "accent", {}),
    );
  });

  it("#6 · #10 quiet ToggleButton: rest only is transparent; selected is neutral", () => {
    expect(
      paint("ToggleButton", "default", { isQuiet: true }, "hover").background,
    ).toBe("{color.neutral-hover}");
    expect(
      paint("ToggleButton", "default", { isQuiet: true }, "pressed").background,
    ).toBe("{color.neutral-pressed}");
    expect(
      paint("ToggleButton", "default", { isQuiet: true, isSelected: true }),
    ).toEqual({
      background: "{color.neutral}",
      color: "{color.base}",
      border: "{color.neutral}",
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
