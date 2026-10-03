import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-248 Phase 4e-2 dashboard lifecycle contract: the project list, create and delete go to the
 * catalog storage only. No old document/project store is read or written, and no old document is
 * seeded. (Replaces the ADR-120 local mirror contract, whose `db.documents` store the Builder no
 * longer opens.)
 */
describe("ADR-248 dashboard catalog lifecycle contract", () => {
  it("lists, creates and deletes through the catalog storage only", async () => {
    const source = await readFile(resolve(__dirname, "../index.tsx"), "utf-8");

    expect(source).toContain("new CatalogStorage().list()");
    expect(source).toContain("createCatalogProject(");
    expect(source).toContain("new CatalogStorage().remove(projectId)");
    for (const old of [
      "db.documents.",
      "db.projects.",
      "db.pages.",
      "db.elements.",
      "db.layouts.",
      "createInitialProjectDocument",
      "historyIndexedDB",
    ])
      expect(source).not.toContain(old);
  });
});
