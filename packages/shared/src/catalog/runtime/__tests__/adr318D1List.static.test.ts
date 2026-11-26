/**
 * ADR-318 HC2 · G2 — the Handle's D1 exception is a closed list (breakdown §4): the ARIA attributes
 * and keys the interaction writes are exactly the list's, useMove's key handler is left off (it would
 * take the off-axis arrows), and the Group · Panel renderers write no role · ARIA.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const handle = here("../resizable.components.tsx");
const code = handle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("ADR-318 — the Handle's D1 list", () => {
  it("ARIA attributes = role · orientation · valuenow · valuemin · valuemax · controls · label · disabled", () => {
    const aria = [...new Set(code.match(/aria-[a-z]+(?==)/g) ?? [])].sort();
    expect(aria).toEqual([
      "aria-controls",
      "aria-disabled",
      "aria-label",
      "aria-orientation",
      "aria-valuemax",
      "aria-valuemin",
      "aria-valuenow",
    ]);
    expect(code.match(/\brole="([a-z]+)"/g)).toEqual(['role="separator"']);
    // (`setAttribute` is the drag's live `aria-valuenow` only.)
    expect(code.match(/setAttribute\(\s*"([a-z-]+)"/g)).toEqual([
      'setAttribute(\n      "aria-valuenow"',
    ]);
  });
  it("keys = the axis arrows · Home · End · Enter; the rest go on", () => {
    const keys = [
      ...new Set(
        code.match(/"(Arrow\w+|Home|End|Enter|Escape|F6|PageUp|PageDown)"/g) ??
          [],
      ),
    ].sort();
    expect(keys).toEqual([
      '"ArrowDown"',
      '"ArrowLeft"',
      '"ArrowRight"',
      '"ArrowUp"',
      '"End"',
      '"Enter"',
      '"Home"',
    ]);
    expect(code).toContain("continuePropagation()");
    // useMove's key handler is dropped from the pointer props.
    expect(code).toMatch(
      /onKeyDown:\s*_\w+,\s*\.\.\.pointerProps\s*}\s*=\s*moveProps/,
    );
  });
  it("the Group · Panel renderers write no role · ARIA", () => {
    const dom = here("../delegatedDom.runtime.ts");
    const start = dom.indexOf("resizablepanelgroup: {");
    const block = dom
      .slice(start, dom.indexOf("resizablehandle: {", start))
      .replace(/\/\/.*$/gm, "");
    expect(block).not.toMatch(/\brole\b|aria-/);
  });
});
