import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createThemeDefinition } from "@composition/shared";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveThemeSnapshot } from "../../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { installThemeMaps } from "../../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { catalogRuleNodeData, catalogRuleShapes } from "../ruleShapes";
import type { CatalogRuleShapeInput } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";

const require = createRequire(import.meta.url);
const s2 = require(
  join(
    dirname(require.resolve("@react-spectrum/s2/package.json")),
    "style/dist/spectrum-theme.cjs",
  ),
);
const snapshot = () =>
  resolveThemeSnapshot(createThemeDefinition("selection", "Selection"), {
    baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
  });
afterEach(() => installThemeMaps(null));
function oracle(property: string, token: string, mode: "light" | "dark") {
  const css: string[] = [];
  s2.style.call(
    { addAsset: (a: { content: string }) => css.push(a.content) },
    { [property]: token },
  );
  const pair = /light-dark\(rgb\(([^)]+)\), rgb\(([^)]+)\)\)/.exec(
    css.join(""),
  )!;
  return (
    "#" +
    pair[mode === "light" ? 1 : 2]!.split(",")
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
}
it.each([
  ["neutral-subdued", "color", "neutral-subdued"],
  ["selection-accent", "backgroundColor", "accent-900"],
  ["selection-accent-hover", "backgroundColor", "accent-900:hovered"],
  ["selection-negative", "backgroundColor", "negative-900"],
  ["selection-negative-hover", "borderColor", "negative:hovered"],
])("%s matches installed S2 %s %s", (key, property, token) => {
  const colors = snapshot().colors;
  for (const mode of ["light", "dark"] as const)
    expect(colors[mode][key]).toBe(oracle(property, token, mode));
});
const cases = (["Checkbox", "Radio", "Switch"] as const).flatMap((type) =>
  (["light", "dark"] as const).flatMap((mode) =>
    [false, true].flatMap((selected) =>
      [false, true].flatMap((emphasized) =>
        [
          "default",
          "hover",
          "pressed",
          "focusVisible",
          "invalid",
          "disabled-invalid",
        ].map((state) => ({ type, mode, selected, emphasized, state })),
      ),
    ),
  ),
);
it.each(cases)(
  "$type $mode selected=$selected emphasized=$emphasized $state",
  ({ type, mode, selected, emphasized, state }) => {
    installThemeMaps(snapshot());
    const disabled = state === "disabled-invalid";
    const invalid = state.includes("invalid") && type !== "Switch";
    const active = ["hover", "pressed", "focusVisible"].includes(state);
    const token = (base: string) => base + (active ? ":hovered" : "");
    const props = {
      size: "M",
      isSelected: selected,
      isEmphasized: emphasized,
      isDisabled: disabled,
      isInvalid: invalid,
    };
    const input: CatalogRuleShapeInput = {
      type,
      rule: COMPONENT_RULES_TABLE[type],
      theme: mode,
      state:
        state === "hover" || state === "pressed" || state === "focusVisible"
          ? state
          : undefined,
      rect: { width: type === "Switch" ? 26 : 16, height: 16 },
      node: {
        id: "selection",
        sourceId: "selection",
        definitionId: type,
        bindingId: undefined,
        parentId: "",
        props,
        visual: {},
        layout: {},
        sizing: {},
        children: [],
        instancePath: [],
        slot: undefined,
        name: undefined,
        regions: undefined,
        placeholder: undefined,
      },
      authoredVisual: {},
    };
    const shapes = catalogRuleShapes(input);
    const resolve = (v: unknown) =>
      typeof v === "string" && v.startsWith("{")
        ? resolveToken(v as TokenRef, mode)
        : v;
    const expectedBorder =
      type !== "Radio" && selected
        ? "transparent"
        : oracle(
            "borderColor",
            disabled
              ? "gray-400"
              : invalid
                ? token("negative")
                : selected && emphasized
                  ? token("accent-900")
                  : token("gray-800"),
            mode,
          );
    const fill = shapes.find(
      (s) => s.type === "roundRect" || s.type === "circle",
    )!;
    const bg =
      type === "Radio" && selected
        ? expectedBorder
        : oracle(
            "backgroundColor",
            !selected || type === "Radio"
              ? "gray-25"
              : disabled
                ? "gray-400"
                : invalid
                  ? token("negative-900")
                  : emphasized
                    ? token("accent-900")
                    : token("neutral"),
            mode,
          );
    expect(resolve("fill" in fill ? fill.fill : undefined)).toBe(bg);
    const border = shapes.find((s) => s.type === "border");
    if (border?.type === "border")
      expect(resolve(border.color)).toBe(expectedBorder);
    if (type === "Switch") {
      const thumb = shapes.find((s) => "id" in s && s.id === "thumb")!;
      expect(resolve("fill" in thumb ? thumb.fill : undefined)).toBe(
        oracle(
          "backgroundColor",
          selected ? "gray-25" : disabled ? "gray-400" : token("neutral"),
          mode,
        ),
      );
    }
    if (state === "focusVisible") {
      const data = catalogRuleNodeData(input);
      expect(data.box?.outlineWidth).toBe(2);
      expect(data.box?.outlineOffset).toBe(2);
    }
  },
);
it("selection token edit and restore keep defaults isolated", () => {
  const before = snapshot();
  const edited = resolveThemeSnapshot(
    createThemeDefinition("selection", "Selection", undefined, {
      "color.selection-accent": {
        type: "color",
        value: "#008866",
        source: "spec-token",
      },
    }),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  expect(edited.colors.dark["selection-accent"]).toBe("#008866");
  installThemeMaps(edited);
  expect(snapshot().colors).toEqual(before.colors);
});
