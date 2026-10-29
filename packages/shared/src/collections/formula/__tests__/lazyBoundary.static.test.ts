import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-291 G3 — the first screen holds the formula loader and the computed cell front only
 * (`engine.ts` · `compute.ts`); the run (`computeCells.ts`), the definition checks (`validate.ts`
 * · `scope.ts` · `allowed.ts`), the names (`names.ts`) and the json-formula instance
 * (`instance.ts`) load with the engine. 2026-10-29: the document validation and the evaluator
 * imported them statically — Builder initial +3.4 KB gz in the `graph` chunk.
 */
const ROOT = resolve(__dirname, "../../..");
const LAZY = /["']\.{1,2}\/(?:[\w./]*\/)?(?:formula\/)?(computeCells|validate|scope|allowed|names|instance)["']/;
const FIRST_SCREEN = [
  "collections/formula/engine.ts",
  "collections/formula/compute.ts",
  "collections/view/evaluate.ts",
  "catalog/document/validation.ts",
  "catalog/runtime/dataBinding.ts",
];

/** The value imports (and re-exports) of a module — `import type` is erased. */
function valueImports(source: string): string[] {
  return [
    ...source.matchAll(
      /^(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+(["'][^"']+["'])/gms,
    ),
  ].map((match) => match[1]!);
}

describe("ADR-291 G3 — the formula modules stay behind the engine load", () => {
  it.each(FIRST_SCREEN)("%s imports no formula module but the loader and the front", (file) => {
    const source = readFileSync(resolve(ROOT, file), "utf8");
    expect(valueImports(source).filter((path) => LAZY.test(path))).toEqual([]);
  });

  it("the loader brings the run, the checks and the instance by dynamic import", () => {
    const source = readFileSync(resolve(ROOT, "collections/formula/engine.ts"), "utf8");
    for (const name of ["instance", "computeCells", "validate"])
      expect(source).toContain(`import("./${name}")`);
  });
});
