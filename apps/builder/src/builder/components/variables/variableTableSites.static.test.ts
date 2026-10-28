import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-288 G2 — one variable table for every owner: the Data panel's Variables tab (project
 * variables + the page · element index) and the Design panel's State section (page · element
 * variables) both import `VariableTable`; neither draws its own variable rows (the old
 * `.list-item` list · `.state-variable-row` fieldset rows) or the old editor.
 */
const SITES = {
  data: resolve(__dirname, "../../panels/datatable/components/VariableList.tsx"),
  state: resolve(
    __dirname,
    "../../panels/properties/catalog/CatalogStateSection.tsx",
  ),
};
const read = (path: string) => readFileSync(path, "utf8");

describe("ADR-288 VariableTable sites", () => {
  it("the Data panel and the State section render VariableTable", () => {
    // (The State section loads it lazily — the Design panel is an initial chunk, G5.)
    for (const url of Object.values(SITES))
      expect(read(url)).toMatch(
        /import \{[^}]*\bVariableTable\b[^}]*\} from|import\("[^"]*\/VariableTable"\)/,
      );
  });

  it("no site draws its own variable rows or opens the old editor", () => {
    const data = read(SITES.data);
    expect(data).not.toMatch(/openVariableEditor|VariableEditor\b/);
    expect(data).not.toMatch(/className="list-item \$\{/);
    const state = read(SITES.state);
    expect(state).not.toContain("state-variable-row");
    expect(state).not.toContain("StateVariableTypeSelect");
  });
});
