import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../fixture";
import { CatalogGraph } from "../graph";
import type { CatalogDocument, CatalogEntry, PageEntry } from "../types";
import { CatalogValidationError, validateCatalogEntry } from "../validation";
import { applyCatalogTransaction } from "../../transactions/transaction";

/**
 * ADR-248 Phase 4a: page schema — nested routes (`parentId`) and reusable page layouts (a
 * definition with `usage: "layout"` whose instance is the page body; content fills its slots).
 */
const page = (id: string, patch: Partial<PageEntry> = {}): PageEntry => ({
  kind: "page",
  id: `project:page:${id}`,
  name: id,
  route: `/${id}`,
  children: [],
  ...patch,
});
function graph(pages: PageEntry[]): CatalogGraph {
  const { document, library } = createG1Fixture();
  const project = document.entries["project:project:g1"] as Extract<
    CatalogEntry,
    { kind: "project" }
  >;
  const main = document.entries["project:page:main"] as PageEntry;
  const entries: Record<string, CatalogEntry> = {
    ...document.entries,
    [project.id]: { ...project, pageIds: [main.id, ...pages.map((p) => p.id)] },
  };
  for (const item of pages) entries[item.id] = item;
  return new CatalogGraph({ ...document, entries } as CatalogDocument, library);
}
const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};

describe("ADR-248 Phase 4a page schema", () => {
  it("accepts a nested route and a layout definition", () => {
    expect(
      code(() =>
        graph([page("docs"), page("intro", { parentId: "project:page:docs" })]),
      ),
    ).toBe("ACCEPTED");
    expect(
      code(() =>
        validateCatalogEntry({
          kind: "definition",
          id: "project:definition:shell",
          name: "Shell",
          mode: "composite",
          usage: "layout",
          templateRootId: "project:node:shellRoot",
          accepts: {},
          defaults: {},
          visual: {},
          stateRules: {},
        }),
      ),
    ).toBe("ACCEPTED");
  });

  it("rejects a dangling, self or cyclic parent page", () => {
    expect(
      code(() => graph([page("a", { parentId: "project:page:missing" })])),
    ).toBe("DANGLING_PARENT_PAGE");
    expect(code(() => graph([page("a", { parentId: "project:page:a" })]))).toBe(
      "PAGE_PARENT_CYCLE",
    );
    expect(
      code(() =>
        graph([
          page("a", { parentId: "project:page:b" }),
          page("b", { parentId: "project:page:a" }),
        ]),
      ),
    ).toBe("PAGE_PARENT_CYCLE");
  });

  it("rejects a parent edit that would close a cycle, locally", () => {
    const g = graph([page("a"), page("b", { parentId: "project:page:a" })]);
    const a = g.getEntry("project:page:a") as PageEntry;
    expect(
      code(() =>
        applyCatalogTransaction(g, {
          projectId: g.projectId,
          expectedRevision: g.revision,
          history: { kind: "record", label: "nest" },
          ops: [{ kind: "put", entry: { ...a, parentId: "project:page:b" } }],
        }),
      ),
    ).toBe("PAGE_PARENT_CYCLE");
    // Removing a parent page that still has a child page is refused.
    const project = g.getEntry(g.projectId) as Extract<
      CatalogEntry,
      { kind: "project" }
    >;
    expect(
      code(() =>
        applyCatalogTransaction(g, {
          projectId: g.projectId,
          expectedRevision: g.revision,
          history: { kind: "record", label: "remove" },
          ops: [
            { kind: "remove", id: "project:page:a" },
            {
              kind: "put",
              entry: {
                ...project,
                pageIds: project.pageIds.filter(
                  (id) => id !== "project:page:a",
                ),
              },
            },
          ],
        }),
      ),
    ).toBe("DANGLING_PARENT_PAGE");
  });
});
