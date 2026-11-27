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
