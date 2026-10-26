import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-284 G1 — one evaluator: the Canvas (Builder row source), the Preview and Publish (the shared
 * `CatalogPreviewSession`) all run a view through `catalogBoundRows` → `runViewQueries`. No app
 * defines its own filter of a view (R1 · Decision 6 — a second evaluator would let the Preview and
 * Publish disagree on the same condition).
 */
const ROOT = resolve(__dirname, "../../../../../..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || name === "dist")
      return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
const read = (path: string) => readFileSync(path, "utf8");

describe("ADR-284 — one view evaluator for every consumer", () => {
  const files = [
    ...sources(join(ROOT, "packages/shared/src")),
    ...sources(join(ROOT, "apps/builder/src")),
    ...sources(join(ROOT, "apps/publish/src")),
  ];

  it("the evaluator and the comparison table are defined once", () => {
    const define = (name: string) =>
      files
        .filter((file) =>
          new RegExp(`export function ${name}\\b`).test(read(file)),
        )
        .map((file) => relative(ROOT, file));
    expect(define("runViewQueries")).toEqual([
      "packages/shared/src/collections/view/evaluate.ts",
    ]);
    expect(define("viewCompare")).toEqual([
      "packages/shared/src/collections/view/comparison.ts",
    ]);
  });

  it("the row source runs it; Publish and the Preview share that session", () => {
    const callers = files
      .filter((file) => /runViewQueries\(/.test(read(file)))
      .map((file) => relative(ROOT, file))
      .filter((file) => !file.endsWith("collections/view/evaluate.ts"));
    expect(callers).toEqual([
      "packages/shared/src/catalog/runtime/dataBinding.ts",
    ]);
    expect(read(join(ROOT, "apps/publish/src/catalogSession.ts"))).toMatch(
      /packages\/shared\/src\/catalog\/runtime\/catalogPreviewSession/,
    );
    expect(
      read(
        join(
          ROOT,
          "packages/shared/src/catalog/runtime/catalogPreviewSession.ts",
        ),
      ),
    ).toMatch(/catalogBoundRows\(/);
  });
});
