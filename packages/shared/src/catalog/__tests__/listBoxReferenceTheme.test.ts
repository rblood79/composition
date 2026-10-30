import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { catalogListItemFlexShrink } from "../document/rulePartRules";

/**
 * ListBox — the RAC reference theme (사용자 2026-10-13 「listbox 를 RAC 레퍼런스 테마 기준으로」 ·
 * 「다중선택 인경우 인접한 두개를 선택시 border radius 가 인접한부분은 제외된다」): the generated sheet
 * carries the reference `ListBox.css` rules for a list standing on its own (not a picker's — in a
 * Popover), and the Canvas reads the item margins from the same rule.
 */
const sheet = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../components/styles/generated/ListBox.css",
  ),
  "utf8",
);
const scope = ".react-aria-ListBox:not(.react-aria-Popover *)";
const block = (selector: string): string => {
  const start = sheet.indexOf(`${scope} ${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return sheet.slice(start, sheet.indexOf("}", start));
};

describe("ListBox — RAC reference theme", () => {
  it("adjacent selected items join: the touching corners square", () => {
    expect(
      block(".react-aria-ListBoxItem[data-selected]:has(+ [data-selected])"),
    ).toMatch(/border-end-start-radius: 0;\s*border-end-end-radius: 0;/);
    expect(
      block(".react-aria-ListBoxItem[data-selected] + [data-selected]"),
    ).toMatch(/border-start-start-radius: 0;\s*border-start-end-radius: 0;/);
  });

  it("a line under each item but the last, hidden on a selected item, light between two", () => {
    expect(block(".react-aria-ListBoxItem:not(:last-child)::after")).toMatch(
      /border-bottom: var\(--border-width-hairline\) solid var\(--listbox-separator\);/,
    );
    expect(block(".react-aria-ListBoxItem[data-selected]")).toContain(
      "--listbox-separator: transparent;",
    );
    expect(
      block(".react-aria-ListBoxItem[data-selected]:has(+ [data-selected])"),
    ).toContain(
      "--listbox-separator: color-mix(in srgb, var(--fg-on-accent) 30%, transparent);",
    );
  });

  it("the list: a hairline border, the radius + spacing corners, no padding — the items' margins", () => {
    const base = sheet.slice(
      sheet.indexOf(".react-aria-ListBox {"),
      sheet.indexOf("}", sheet.indexOf(".react-aria-ListBox {")),
    );
    expect(base).toContain(
      "border: var(--border-width-hairline) solid var(--border);",
    );
    expect(base).toContain("border-radius: var(--catalog-token-radius-xl);");
    // The list's padding (4) holds the items off its border — no item margins (사용자 2026-10-13
    // 「margin은 없애고 react-aria-ListBox 에 padding으로」).
    expect(base).toContain("padding: var(--spacing-xs);");
    expect(sheet).not.toMatch(/\.react-aria-ListBoxItem[^{]*\{[^}]*margin/);
    // The Canvas reads the same selector: the items do not shrink.
    expect(catalogListItemFlexShrink("ListBox", "ListBoxItem")).toBe(0);
  });
});
