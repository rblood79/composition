/**
 * ADR-279 G1 — the ADR-260 reference machinery is gone: a definition owns its template (one
 * shape), so no source reads the reference field, restores a deleted origin, keeps a removed
 * origin as a hidden template, copies an origin "as instance" by a clipboard map, or builds the
 * old in-place shape in a test support file.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  resolve(__dirname, "../../.."),
  resolve(__dirname, "../../../../../../packages/shared/src"),
];
const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);

function sources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
        out.push(full);
    }
  };
  walk(root);
  return out;
}

const GONE = [
  "originRef",
  "restoreOrigin",
  "keepRemovedOrigins",
  "referencedOriginOf",
  "asInstance",
  "componentizeInPlace",
];

describe("ADR-279 G1 — no ADR-260 reference machinery", () => {
  it("no source names the removed symbols", () => {
    const hits: string[] = [];
    for (const root of ROOTS)
      for (const file of sources(root)) {
        const text = readFileSync(file, "utf8");
        for (const symbol of GONE)
          if (new RegExp(`\\b${symbol}\\b`).test(text))
            hits.push(`${relative(process.cwd(), file)}: ${symbol}`);
      }
    expect(hits).toEqual([]);
  });
});
