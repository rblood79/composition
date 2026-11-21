import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-315 Phase 7 — the sheet's pinned-column · pinned-row · row-pin rules use `:has()`. Left
 * unscoped they cost every Table's scroll · sort their style work (HC4 A/B 2026-11-21: a 10,000
 * row virtual Table without a pinned column — task per frame 7.2 → 7.9 ms, back to 7.25 once
 * scoped). Each is scoped to its Table's mark (`data-pinned-columns` · `data-pinned-rows` ·
 * `data-row-pinning` — `domBinding.runtime.ts`), so a Table without them never matches one.
 */
const sheet = readFileSync(resolve(__dirname, "../Table.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Every selector (the text before a `{`, from the last `{` · `}` · `;`) with its nesting. */
function selectors(text: string): { selector: string; scope: string[] }[] {
  const out: { selector: string; scope: string[] }[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === ";") start = at + 1;
    else if (char === "{") {
      const selector = text.slice(start, at).trim();
      out.push({ selector, scope: [...stack] });
      stack.push(selector);
      start = at + 1;
    } else if (char === "}") {
      stack.pop();
      start = at + 1;
    }
  }
  return out;
}

const MARKS = {
  "data-pinned-row": "[data-pinned-rows]",
  "table-row-pin-button": "[data-row-pinning]",
  "data-pinned": "[data-pinned-columns]",
} as const;

describe("Table.css pinned rules are scoped to their Table's mark (ADR-315 Phase 7)", () => {
  it("no `:has()` of a pinned · pin feature matches a Table without it", () => {
    const found = selectors(sheet).filter(({ selector }) =>
      /:has\([^{]*(data-pinned|table-row-pin-button)/.test(selector),
    );
    expect(found.length).toBeGreaterThanOrEqual(10);
    for (const { selector, scope } of found) {
      const feature = (Object.keys(MARKS) as (keyof typeof MARKS)[]).find(
        (key) => selector.includes(key),
      )!;
      const whole = [...scope, selector].join(" ");
      expect(
        whole.includes(MARKS[feature]),
        `${selector} — scope it to ${MARKS[feature]}`,
      ).toBe(true);
      // (A Table-wide `:has(…)` over its subtree is what the mark replaces.)
      expect(selector).not.toMatch(/&:has\(\[data-pinned/);
    }
  });
});
