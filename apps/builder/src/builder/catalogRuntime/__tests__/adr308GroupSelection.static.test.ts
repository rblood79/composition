import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-308 G2 (c) — a group's selection · expansion is read and written as the group's props only
 * (`groupSelection.ts`): no runtime · command · Builder write path reads an item's `isSelected` ·
 * `isExpanded` for its group, or writes one. What remains is listed with why — a standalone
 * toggle · Card · Disclosure (RAC's own state), a state origin's display state, a Components page
 * sample. A new reading fails here: route it through `catalogItemSelected` · `catalogGroupSelection`.
 */
const REPO = join(__dirname, "../../../../../..");
const SCANNED = [
  "packages/shared/src/catalog/runtime",
  "packages/shared/src/catalog/commands",
  "packages/shared/src/interactions",
  "apps/builder/src/builder/catalogRuntime/singleSelection.ts",
  "apps/builder/src/builder/catalogRuntime/viewAuthoring.ts",
  "apps/builder/src/builder/catalogRuntime/itemInsert.ts",
  "apps/builder/src/builder/panels/properties/catalog",
];
const PATTERN =
  /props\.isSelected|props\.isExpanded|isSelected: (?:true|set\(true\)|\{ kind: "set")|isExpanded: \{ kind: "set"/g;

/** file → occurrences, each one kept on purpose. */
const KEPT: ReadonlyMap<string, [number, string]> = new Map([
  [
    "packages/shared/src/catalog/runtime/rulePaint.ts",
    [
      5,
      "the owner's derived `_isSelected` paints the item · a state origin's forced state",
    ],
  ],
  [
    "packages/shared/src/catalog/runtime/presence.ts",
    [
      3,
      "a TreeItem outside a Tree · a standalone item's own Selected · a standalone own expansion",
    ],
  ],
  [
    "packages/shared/src/catalog/runtime/domBinding.runtime.ts",
    [1, "a Components page sample Radio's orphan host"],
  ],
  [
    "packages/shared/src/catalog/runtime/delegatedDom.runtime.ts",
    [
      9,
      "standalone Switch · Radio · Checkbox · ToggleButton · Card · Disclosure (RAC's own state) and the generic own-state reads",
    ],
  ],
  [
    "packages/shared/src/catalog/commands/materialize.ts",
    [1, "a Components page sample's display state (comment)"],
  ],
]);

function files(path: string): string[] {
  const full = join(REPO, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { recursive: true, encoding: "utf8" })
    .map((name) => join(full, name))
    .filter(
      (name) =>
        /\.tsx?$/.test(name) &&
        !name.includes("__tests__") &&
        !/\.test\.tsx?$/.test(name),
    );
}

describe("ADR-308 G2 (c) — no item isSelected · isExpanded for a group", () => {
  it("every remaining item read · write is a standalone state, listed", () => {
    const found = new Map<string, number>();
    for (const path of SCANNED)
      for (const file of files(path)) {
        const count = (readFileSync(file, "utf8").match(PATTERN) ?? []).length;
        if (count) found.set(relative(REPO, file), count);
      }
    expect(Object.fromEntries(found)).toEqual(
      Object.fromEntries([...KEPT].map(([file, [count]]) => [file, count])),
    );
  });

  it("the old item-aggregating readers are gone", () => {
    const text = SCANNED.flatMap(files)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    for (const name of [
      "catalogItemStartsSelected(",
      "selectBoxKeySelected(",
      "resolveGroupExpandedDisclosureIds(",
      "catalogSingleSelectionCommand",
    ])
      expect(text.includes(name), name).toBe(false);
  });
});
