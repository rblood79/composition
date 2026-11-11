import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * ADR-307 (R4) — a composition root opened in stages holds only the records of the pages filled so
 * far. Code that walks the whole record map (`domInputs` · `canvasInputs`) reads a part of the
 * document until the fill ends, so every such walk is listed here with how it stays right:
 *
 * - `A` — a record that appears later is read when it appears (the walk runs again with the scene).
 * - `B` — the walk is told of a fill (the workspace's row listeners) and reads again.
 * - `C` — the reader fills first (`workspace.ensureAllPages` · `ensurePage`).
 * - `P` — a Preview · Publish root (not opened in stages).
 *
 * A new walk fails this test: classify it and add it — or read by id (`get` · `recordsOfSource`).
 * (What the test cannot see: a walk over the map handed on as an argument or kept in a local.)
 */
const REPO = resolve(__dirname, "../../../../../..");
const SOURCES = [
  join(REPO, "apps/builder/src"),
  join(REPO, "packages/shared/src"),
];
const WALK =
  /(?:domInputs|canvasInputs)\.(?:values|keys|entries|forEach)\(|\bof\s+[\w.]*(?:domInputs|canvasInputs)\s*\)|\[\.\.\.[\w.]*(?:domInputs|canvasInputs)\s*[\].]/g;
/** file → [walks, class, how]. */
const KNOWN = new Map<string, readonly [number, string, string]>([
  [
    "apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx",
    [1, "B", "gridRecordSet — dropped on a step, a root change and a fill"],
  ],
  [
    "apps/builder/src/builder/catalogRuntime/rowSample.ts",
    [1, "A", "row remainders — the chrome cache is rebuilt with the scene"],
  ],
  [
    "apps/builder/src/builder/main/CatalogBuilderCore.tsx",
    [
      1,
      "B",
      "font sync — reads again after a fill, and the document's written fonts",
    ],
  ],
  [
    "packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts",
    [3, "P", "Preview interaction index"],
  ],
  [
    "packages/shared/src/catalog/runtime/delegatedDom.runtime.ts",
    [1, "P", "Preview tag list"],
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__" && name !== "tests") walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("ADR-307 whole-record walks are classified", () => {
  it("every walk over a root's record map is listed with how it follows a staged fill", () => {
    const found = new Map<string, number>();
    for (const source of SOURCES)
      for (const path of walk(source)) {
        const count = readFileSync(path, "utf8").match(WALK)?.length ?? 0;
        if (count) found.set(relative(REPO, path), count);
      }
    expect(Object.fromEntries(found)).toEqual(
      Object.fromEntries([...KNOWN].map(([file, [count]]) => [file, count])),
    );
  });
});
