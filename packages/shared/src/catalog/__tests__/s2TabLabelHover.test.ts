import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluatePaint } from "../rule/rulePaintTree";

/**
 * S2 `Tabs.tsx` `tab` color (2026-11-23): `baseColor('neutral-subdued')` · `isSelected: baseColor('neutral')`
 * — `baseColor` bumps one stop on hover · focus-visible · press (`spectrum-theme.ts` `nextColorStop`):
 * an unselected tab gray-700 → gray-800 (`{color.neutral}`), a selected one gray-800 → gray-900
 * (`{color.neutral-content-hover}`). 7f76a6ee8 gave the unselected hover gray-900 and the selected tab
 * no stop. Canvas evaluates the tree, the generated sheet compiles it — both are checked.
 */
const tree = COMPONENT_RULES_TABLE.Tab.variants.default.paint?.color;
const at = (conditions: Record<string, boolean>) =>
  evaluatePaint(tree, conditions as never);

describe("S2 Tab label color — one stop up on hover · focus-visible · press", () => {
  it("Canvas: the paint tree", () => {
    expect(at({})).toBe("{color.neutral-subdued}");
    for (const state of ["isHovered", "isFocusVisible", "isPressed"]) {
      expect(at({ [state]: true }), state).toBe("{color.neutral}");
      expect(at({ isSelected: true, [state]: true }), state).toBe(
        "{color.neutral-content-hover}",
      );
    }
    expect(at({ isSelected: true })).toBe("{color.neutral}");
    expect(at({ isSelected: true, isHovered: true, isDisabled: true })).toBe(
      "{color.disabled-content}",
    );
  });

  it("DOM: the generated sheet", () => {
    const css = readFileSync(
      resolve(__dirname, "../../components/styles/generated/Tab.css"),
      "utf8",
    );
    const color = (selector: string) =>
      new RegExp(
        `${selector.replace(/[.[\]()]/g, "\\$&")} \\{\\s*color: ([^;]+);`,
      ).exec(css)?.[1];
    for (const state of ["hovered", "focus-visible", "pressed"]) {
      expect(color(`.react-aria-Tab:where([data-${state}])`), state).toBe(
        "var(--fg)",
      );
      expect(
        color(`.react-aria-Tab:where([data-selected][data-${state}])`),
        state,
      ).toBe("var(--neutral-content-hover)");
    }
  });
});
