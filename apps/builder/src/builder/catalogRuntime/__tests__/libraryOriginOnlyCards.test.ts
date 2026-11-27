import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogComponentsPageEntries } from "../componentsPage";
import { catalogBuiltinOrigins } from "../layouts";
import { originInstanceId, originSampleId } from "../originView";
import { newCatalogProjectDocument } from "../project";

/**
 * A Library card draws no filled instance beside its origin (user 2026-10-25 「instance 제거」,
 * 2026-11-27 「opt-in 으로」): every origin with a filled slot — not only a named list. **Why**:
 * the 10-25 removal was a list of names, so origins added after it (ActionBar · StepList ·
 * Stepper · SegmentedControl · SelectBoxGroup · ResizablePanelGroup · FilterBar …) drew it again.
 */
describe("Library card — origin without a filled instance", () => {
  it("draws no `instance` cell for any built-in origin", async () => {
    const library = await buildCodeCatalogLibrary();
    const graph = new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:origin-only" as EntryId<"project">,
        name: "Origin only",
      }),
      library,
    );
    const entries = catalogComponentsPageEntries(graph);
    const origins = catalogBuiltinOrigins(library);
    // (The page is built: each origin's ◆ sample is there.)
    expect(
      origins.filter((origin) => entries.has(originSampleId(origin.id))),
    ).toHaveLength(origins.length);
    expect(
      origins
        .filter((origin) => entries.has(originInstanceId(origin.id, "instance")))
        .map((origin) => origin.name),
    ).toEqual([]);
  }, 60_000);
});
