import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";

/**
 * 2026-10-09 (사용자 「tagGroup 내의 tag 에 variant 를 selected 로 했을때 compare-css 에는 배경색이
 * 변경되지 않고」): a Tag's `variant="selected"` reaches the DOM as `data-variant="selected"`, but the
 * Tag has no generated CSS and the manual `TagGroup.css` styled only RAC's `[data-selected]` — the
 * Canvas painted the rule's selected fill, the Preview kept the default chip. The sheet now gives the
 * authored variant the rule's selected colours (the same block as RAC's selection).
 */
const CSS = readFileSync(
  resolve(
    __dirname,
    "../../../../../../packages/shared/src/components/styles/TagGroup.css",
  ),
  "utf8",
);
/** The catalog colour tokens → their CSS variables (`.claude/rules/css-tokens.md`). */
const TOKEN_VAR: Record<string, string> = {
  "{color.accent}": "var(--accent)",
  "{color.on-accent}": "var(--fg-on-accent)",
};

describe("Tag variant selected — the sheet gives the rule's selected colours", () => {
  it("the [data-variant=selected] block sets the rule's fill, text and border", () => {
    const selected = COMPONENT_RULES_TABLE.Tag!.variants!
      .selected as unknown as {
      fill: { default: { base: string } };
      colors: { text: string; border: string };
    };
    const start = CSS.indexOf('&[data-variant="selected"]');
    expect(start).toBeGreaterThan(0);
    const block = CSS.slice(start, CSS.indexOf("}", start));
    expect(block).toContain(
      `--tag-color: ${TOKEN_VAR[selected.fill.default.base]};`,
    );
    expect(block).toContain(`--tag-text: ${TOKEN_VAR[selected.colors.text]};`);
    expect(block).toContain(
      `--tag-border: ${TOKEN_VAR[selected.colors.border]};`,
    );
  });
});
