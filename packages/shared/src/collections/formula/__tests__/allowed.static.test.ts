import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORMULA_FUNCTION_SNAPSHOT,
  FORMULA_FUNCTIONS,
  HIDDEN_FORMULA_FUNCTIONS,
} from "../allowed";

/**
 * ADR-291 R7 — the function vocabulary is a snapshot of the installed json-formula's table; a
 * version bump that adds · removes a function fails here (the panel list · the definition check
 * read the snapshot, never the package at run time).
 */
describe("ADR-291 — the function snapshot is the installed table", () => {
  it("every `name: {` of src/functions.js, no more, no less", () => {
    const require = createRequire(import.meta.url);
    const root = dirname(require.resolve("@adobe/json-formula/package.json"));
    const source = readFileSync(join(root, "src/functions.js"), "utf8");
    const installed = [...source.matchAll(/^ {4}([A-Za-z]+): \{$/gm)].map(
      (match) => match[1]!,
    );
    expect([...FORMULA_FUNCTION_SNAPSHOT].sort()).toEqual(
      [...new Set(installed)].sort(),
    );
    expect(require("@adobe/json-formula/package.json").version).toBe("2.1.0");
  });
  it("the hidden four are in the snapshot and out of the author's list", () => {
    for (const name of HIDDEN_FORMULA_FUNCTIONS) {
      expect(FORMULA_FUNCTION_SNAPSHOT).toContain(name);
      expect(FORMULA_FUNCTIONS).not.toContain(name);
    }
    expect(FORMULA_FUNCTIONS).toHaveLength(
      FORMULA_FUNCTION_SNAPSHOT.length - 4,
    );
  });
});
