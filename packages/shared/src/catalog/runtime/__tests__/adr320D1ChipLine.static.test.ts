import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ADR-320 G3 · breakdown §4 (D1 예외 0) — the running chip line is RAC parts only: no `role` and no
 * `aria-*` written by hand. The names it gives are RAC props (`aria-label` of a RAC `Menu` ·
 * `SearchField` · `Toolbar` · `Group` · the builder's `Tree`, an icon-only RAC `Button`'s name) — the
 * element's role · state attributes are RAC's (the Tree's drag · chevron buttons are named by RAC).
 */
const SOURCES = [
  "../filterBar.components.tsx",
  "../filterBuilder.components.tsx",
  "../filterBarRun.tsx",
  "../filterTreeEdit.ts",
  "../filterBarAccess.ts",
  "../filterScopeSession.ts",
].map((path) => ({
  path,
  text: readFileSync(new URL(path, import.meta.url), "utf8")
    // (Comments say what RAC does — only code is checked.)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, ""),
}));

describe("ADR-320 — the chip line writes no role · aria by hand", () => {
  it("no `role` attribute", () => {
    for (const { path, text } of SOURCES)
      expect(text.match(/\brole\s*[=:]/g) ?? [], path).toEqual([]);
  });

  it("`aria-*` only as a RAC component's name (`aria-label` on Toolbar · Group · Menu · SearchField · Tree · Button)", () => {
    for (const { path, text } of SOURCES) {
      const uses = [...text.matchAll(/<(\w+)[^<>]*?\baria-([a-z]+)=/g)].map(
        ([, tag, name]) => `${tag} aria-${name}`,
      );
      expect(
        uses.filter(
          (use) =>
            ![
              "Menu aria-label",
              "SearchField aria-label",
              "Toolbar aria-label",
              "Group aria-label",
              "Tree aria-label",
              "Button aria-label",
            ].includes(use),
        ),
        path,
      ).toEqual([]);
      // (No `aria-*` key in an object of props either.)
      expect(text.match(/["']aria-[a-z]+["']\s*:/g) ?? [], path).toEqual([]);
    }
  });
});
