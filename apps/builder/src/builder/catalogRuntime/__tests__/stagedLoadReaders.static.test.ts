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
 * - `P` — a Preview · Publish root: other pages are shells, the shown page is filled before the
 *   session tells its readers (`fillShown` — a navigation, a new root at the shown page), and they
 *   read again on that change.
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

/**
 * ADR-307 후속 — a read by document id (`recordsOfSource(nodeId)`) finds nothing while the node's
 * page is a shell. A read that may name a node on such a page goes through
 * `workspace.recordsOfNode` (fills the page first); the direct reads left are listed here:
 *
 * - `R` — a page root (its record is in the shell too) or the one root of a view.
 * - `A` — read per frame (badges · overlay) — the next frame after the fill reads it again.
 * - `F` — the filling read itself (`recordsOfNode`).
 * - `S` — under a record already drawn (a rule owner's record — its page is filled).
 * - `P` — a Preview · Publish root: other pages are shells, the shown page is filled before the
 *   session tells its readers (`fillShown` — a navigation, a new root at the shown page), and they
 *   read again on that change.
 * - `O` — the root's own reads.
 *
 * (A record identity read — `domInputs.get(identity)` — takes an identity the scene drew; not
 * counted.)
 */
const BY_ID = /\.recordsOfSource\(/g;
const KNOWN_BY_ID = new Map<string, readonly [number, string, string]>([
  [
    "apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx",
    [6, "R A", "page bodies (compare · active · reveal) · loading roots · badges · overlay"],
  ],
  [
    "apps/builder/src/builder/catalogRuntime/workspace.ts",
    [1, "F", "recordsOfNode"],
  ],
  [
    "apps/builder/src/builder/catalogRuntime/componentsPage.ts",
    [1, "R", "the Components view's cards — its one root, filled first"],
  ],
  [
    "apps/builder/src/builder/catalogRuntime/shortcuts.ts",
    [1, "R", "the open page's body (paste without a selection)"],
  ],
  [
    "packages/shared/src/catalog/runtime/capabilityTarget.ts",
    [1, "S", "a rule target under the record that ran it"],
  ],
  [
    "packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts",
    [2, "P", "Preview interaction records"],
  ],
  [
    "packages/shared/src/catalog/runtime/catalogPreviewSession.ts",
    [3, "P", "Preview session"],
  ],
  [
    "packages/shared/src/catalog/runtime/compositionRoot.ts",
    [4, "O", "the root's own"],
  ],
]);

function count(pattern: RegExp): Record<string, number> {
  const found: Record<string, number> = {};
  for (const source of SOURCES)
    for (const path of walk(source)) {
      const n = readFileSync(path, "utf8").match(pattern)?.length ?? 0;
      if (n) found[relative(REPO, path)] = n;
    }
  return found;
}

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

describe("ADR-307 whole-record walks and by-id reads are classified", () => {
  it("every walk over a root's record map is listed with how it follows a staged fill", () => {
    expect(count(WALK)).toEqual(
      Object.fromEntries([...KNOWN].map(([file, [n]]) => [file, n])),
    );
  });

  it("every direct read by document id is listed — the rest go through workspace.recordsOfNode", () => {
    expect(count(BY_ID)).toEqual(
      Object.fromEntries([...KNOWN_BY_ID].map(([file, [n]]) => [file, n])),
    );
  });
});
