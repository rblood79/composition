import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-317 G6 — the Table cell selection's D1 exception (`.claude/rules/ssot-hierarchy.md` §1 「Table
 * 칸 범위 선택 예외」, ADR-315 Phase 6 + the ADR-317 widening — list 정본 ADR-317 breakdown §4) and
 * the module that implements it (`tableCellSelection.ts` — the lazy chunk): the events it listens
 * to, the keys it handles and the ARIA it writes are exactly the listed ones, and each is named in
 * the rule. A new listener · key · attribute fails here until the rule (a user decision) says so.
 */
const repo = resolve(__dirname, "../../../../../..");
const source = readFileSync(
  resolve(repo, "packages/shared/src/catalog/runtime/tableCellSelection.ts"),
  "utf8",
);
const rule = readFileSync(
  resolve(repo, ".claude/rules/ssot-hierarchy.md"),
  "utf8",
);
/** The rule's Table exception paragraph (ADR-315 Phase 6 · ADR-317 widening). */
const tableException = (() => {
  const start = rule.indexOf("**Table 칸 범위 선택 예외");
  const end = rule.indexOf("\n- **", start + 1);
  return rule.slice(start, end);
})();

describe("ADR-317 G6 — D1 exception list ↔ tableCellSelection.ts", () => {
  it("listens to the listed events only", () => {
    const listened = new Set(
      [...source.matchAll(/addEventListener\(\s*"([a-z]+)"/g)].map(
        (match) => match[1],
      ),
    );
    const before = /BEFORE_CLIPBOARD = \[([^\]]+)\]/.exec(source)?.[1] ?? "";
    for (const match of before.matchAll(/"([a-z]+)"/g)) listened.add(match[1]);
    expect([...listened].sort()).toEqual(
      [
        // (ADR-315 — selection: pointer drag · Shift · Ctrl/Cmd click, keys, copy; focus entry.)
        "copy",
        "focusin",
        "keydown",
        "pointercancel",
        "pointerdown",
        "pointermove",
        "pointerup",
        // (ADR-317 — paste · cut; Safari's edit menu.)
        "paste",
        "cut",
        "beforecopy",
        "beforecut",
        "beforepaste",
      ].sort(),
    );
    for (const name of [
      "paste",
      "cut",
      "beforecopy",
      "beforecut",
      "beforepaste",
    ])
      expect(tableException).toContain(name);
  });

  it("handles the listed keys only", () => {
    const keys = new Set(
      [
        ...source.matchAll(
          /key(?:\.toLowerCase\(\))? === "([A-Za-z]+)"|case "([A-Za-z]+)"/g,
        ),
      ].map((match) => match[1] ?? match[2]),
    );
    // (Arrow keys by prefix — `key.startsWith("Arrow")`, Shift + arrow extends.)
    expect(source).toContain('key.startsWith("Arrow")');
    expect([...keys].sort()).toEqual(
      ["a", "Escape", "Delete", "Backspace", "d"].sort(),
    );
    for (const said of [
      "Shift + 화살표",
      "Ctrl / Cmd + A",
      "Ctrl / Cmd + C",
      "Esc",
      "Delete",
      "Backspace",
      "Ctrl / Cmd + D",
      // (Ctrl / Cmd + V is the browser's `paste` — the key itself is not taken, the rule says.)
      "키 자체는 가로채지 않는다",
      "`cut`",
    ])
      expect(tableException).toContain(said);
  });

  it("writes the listed ARIA only — and the status region is the listed one", () => {
    const aria = new Set(
      [...source.matchAll(/"(aria-[a-z]+)"/g)].map((match) => match[1]),
    );
    expect([...aria].sort()).toEqual(
      ["aria-hidden", "aria-multiselectable", "aria-selected"].sort(),
    );
    for (const name of aria) expect(tableException).toContain(name);
    // (No `aria-readonly` — breakdown §4 left it to P5's listening; the rule does not list it.)
    expect(tableException).not.toContain("aria-readonly");
    expect(tableException).toContain('role="status"');
  });
});
