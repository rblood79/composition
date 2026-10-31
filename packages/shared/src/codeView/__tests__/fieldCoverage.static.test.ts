import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../catalog/document/types";
import { CODE_VIEW_COVERAGE, type CodeViewFieldPlace } from "../fieldCoverage";

/**
 * ADR-296 G0 · G1 (R1) — the document → file inventory. The key enumeration itself is the type
 * check (`CodeViewCoverage<T>` maps every key of `T`: a key the types gain fails to compile until it
 * has a place); this checks every place is filled — a file, a form and a command, or a reason — and
 * that every entry kind has its table.
 */
const ENTRY_TABLES = {
  project: "ProjectEntry",
  page: "PageEntry",
  definition: "DefinitionEntry",
  definitionOverride: "DefinitionOverrideEntry",
  node: "NodeEntry",
  theme: "ThemeEntry",
  token: "TokenEntry",
  stateVariable: "StateVariableEntry",
  interaction: "InteractionEntry",
  asset: "AssetEntry",
  view: "ViewEntry",
  collection: "CollectionEntry",
  endpoint: "EndpointEntry",
  projectVariable: "ProjectVariableEntry",
} as const satisfies Record<
  CatalogEntry["kind"],
  keyof typeof CODE_VIEW_COVERAGE
>;

const places = Object.entries(CODE_VIEW_COVERAGE).flatMap(([type, table]) =>
  Object.entries(table as Readonly<Record<string, CodeViewFieldPlace>>).map(
    ([key, place]) => [`${type}.${key}`, place] as const,
  ),
);

describe("ADR-296 — every document field has a place in the code (G0)", () => {
  it("every entry kind has its table (14 — the document's 11 + the data 3)", () => {
    expect(Object.keys(ENTRY_TABLES)).toHaveLength(14);
    for (const table of Object.values(ENTRY_TABLES))
      expect(CODE_VIEW_COVERAGE[table]).toBeDefined();
  });

  it.each(places)("%s — a file · form · command, or a reason", (_, place) => {
    if ("notInCode" in place)
      expect(place.notInCode.trim().length).toBeGreaterThan(10);
    else {
      expect(place.file).toBeTruthy();
      expect(place.form.trim()).not.toBe("");
      expect(place.command.trim()).not.toBe("");
    }
  });

  it("the inventory's size (recorded — a change is a table change)", () => {
    const by = (phase: number) =>
      places.filter(([, place]) => "phase" in place && place.phase === phase)
        .length;
    const out = places.filter(([, place]) => "notInCode" in place).length;
    expect({
      total: places.length,
      notInCode: out,
      phases: [0, 1, 2, 3, 4, 5, 6].map(by),
    }).toMatchSnapshot();
  });
});
