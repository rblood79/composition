import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-326 G3 · HC3 (breakdown §4.6) — a Cascader's open look is its rules: the old panel sheet
 * (`CASCADER_PANEL_STYLES` · `.cascader-panel`) is gone, no generated sheet holds a `.cascader-`
 * selector, and every block of the Cascader rule's `externalStyles` is scoped to its own open box
 * (`.react-aria-Popover[data-trigger="Cascader"]`) or its own parts (`.react-aria-CascaderItem`).
 */
const GENERATED = new URL(
  "../../components/styles/generated/",
  import.meta.url,
);
const TABLE = new URL("../generated/componentRulesTable.ts", import.meta.url);

describe("ADR-326 HC3 — the Cascader's open look is its rules", () => {
  it("the panel sheet is deleted and no generated sheet holds a `.cascader-` selector", () => {
    expect(readFileSync(TABLE, "utf8")).not.toMatch(/CASCADER_PANEL_STYLES/);
    const hits = readdirSync(GENERATED)
      .filter((file) => file.endsWith(".css"))
      .filter((file) =>
        /\.cascader-/.test(readFileSync(new URL(file, GENERATED), "utf8")),
      );
    expect(hits).toEqual([]);
  });

  it("every `externalStyles` block of the Cascader rule is its open box's or its parts'", () => {
    const blocks = (COMPONENT_RULES_TABLE.Cascader?.structure?.composition
      ?.externalStyles ?? []) as readonly { selector: string }[];
    expect(blocks.length).toBeGreaterThan(0);
    const outside = blocks
      .map((block) => block.selector)
      .filter(
        (selector) =>
          !selector.startsWith(
            '.react-aria-Popover[data-trigger="Cascader"]',
          ) && !selector.startsWith(".react-aria-CascaderItem"),
      );
    expect(outside).toEqual([]);
    // (A row's label takes its row's color — every level, the submenus' too: not in the open box.)
    expect(
      blocks.find(
        (block) =>
          block.selector ===
          '.react-aria-CascaderItem .react-aria-Text[slot="label"]',
      ),
    ).toMatchObject({ styles: { color: "inherit" } });
  });
});
