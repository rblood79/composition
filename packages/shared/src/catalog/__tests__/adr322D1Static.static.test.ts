import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ADR-322 G2 (breakdown §3) — the Cascader's assembly writes no role, `aria-*` attribute or key
 * handler of its own: those are RAC's (`Menu` · `SubmenuTrigger` · `Button`) and react-aria's
 * (`useField` · `useMenuTrigger`). Allowed: the props RAC components take for a name and a
 * description (`aria-label` · `aria-labelledby` · `aria-describedby`). The one element it draws —
 * the form value input (§3.1, Phase 6) — is checked against its own list then.
 */
const FILES = [
  "../runtime/cascader.ts",
  "../runtime/cascader.components.tsx",
  "../runtime/cascaderMenu.components.tsx",
  "../runtime/cascaderPanel.components.tsx",
  "../runtime/cascaderSearch.components.tsx",
  "../runtime/cascaderOpen.ts",
  "../runtime/cascaderForm.components.tsx",
  "../runtime/cascaderLevels.ts",
];
const ALLOWED_ARIA = new Set([
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
]);
const source = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
    // (Comments may name the attributes RAC writes.)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("ADR-322 G2 — D1: the assembly's role · aria · key handler are RAC's", () => {
  for (const file of FILES)
    it(`${file.split("/").pop()}: no role · own aria-* · onKeyDown`, () => {
      const text = source(file);
      expect(text.match(/\brole\s*[=:]/g) ?? []).toEqual([]);
      expect(text.match(/\bonKey(Down|Up)\b/g) ?? []).toEqual([]);
      const aria = [...text.matchAll(/["'`]?(aria-[a-z]+)["'`]?\s*[:=]/g)]
        .map((match) => match[1]!)
        .filter((name) => !ALLOWED_ARIA.has(name));
      expect(aria).toEqual([]);
    });
});

/**
 * ADR-322 G6 — the closed D1 exception (breakdown §3.1, `ssot-hierarchy.md` §1 D1): the one element
 * the assembly draws itself is the form value `input`, with RAC `HiddenSelect`'s props and nothing
 * else — no role, `aria-*`, focus or key handler; no other native element.
 */
const INPUT_PROPS = [
  "key",
  "ref",
  "name",
  "form",
  "value",
  "disabled",
  "type",
  "style",
  "required",
  "onChange",
];

describe("ADR-322 G6 — D1 exception: the value input's props are §3.1's list", () => {
  const field = source("../runtime/cascader.components.tsx");
  const run = source("../runtime/cascaderForm.components.tsx");

  it("the form run draws one `input` element, its props = the list", () => {
    const inputs = [...run.matchAll(/<input\b([\s\S]*?)\/>/g)];
    expect(inputs).toHaveLength(1);
    const props = [...inputs[0]![1]!.matchAll(/^\s*([A-Za-z]+)=/gm)].map(
      (match) => match[1],
    );
    expect(props).toEqual(INPUT_PROPS);
    expect([...run.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1])).toEqual([
      "input",
    ]);
  });

  it("the field draws no other native element than its `div` and the value text's `span` (RAC `SelectValue`'s)", () => {
    const tags = [...field.matchAll(/createElement\(\s*"([a-z]+)"/g)].map(
      (match) => match[1],
    );
    expect([...new Set(tags)].sort()).toEqual(["div", "span"]);
  });
});
