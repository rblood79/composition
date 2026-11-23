import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 체크리스트 부록 D.3 `guides/collections.md` 「각 collection 의 저장 · 로드」 (2026-11-23 1단계):
 * an item the user adds with a collection's "+" is a document node — saved to IndexedDB and loaded
 * again, it is still in its list (the list's records count it the same, with its key).
 */
const BODY = "project:node:home-body" as NodeId;
const PROJECT = "project:project:d3-collections" as EntryId<"project">;

const CASES: readonly (readonly [list: string, item: string])[] = [
  ["ListBox", "ListBoxItem"],
  ["GridList", "GridListItem"],
  ["Tree", "TreeItem"],
  ["Menu", "MenuItem"],
  ["TagGroup", "Tag"],
  ["Table", "Row"],
];

async function open(storage: CatalogStorage, document?: unknown) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      (document as never) ??
        newCatalogProjectDocument({ projectId: PROJECT, name: "D.3" }),
      library,
    ),
    storage,
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1600, height: 1200 },
      autosaveSchedule: () => {},
    },
  );
  return { library, workspace };
}

const itemsOf = (workspace: CatalogWorkspace, type: string) =>
  [...workspace.root.canvasInputs.values()].filter(
    (record) => workspace.root.typeOf(record) === type,
  );

describe("S2 D.3 collections — a user-added item survives save · load", () => {
  for (const [list, item] of CASES) {
    it(`${list}: the "+" ${item} is kept`, async () => {
      const storage = new CatalogStorage(indexedDB, `d3-${Math.random()}`);
      const { library, workspace } = await open(storage);
      await storage.create(workspace.runtime.graph.exportDocument(), library);
      const id = `project:node:${list.toLowerCase()}` as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(library, list),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId: workspace.newId,
        }),
      );
      const before = itemsOf(workspace, item).length;
      expect(before).toBeGreaterThan(0);
      // The "+" on the last item's host — the list (or a Table's body), as the Layers' "+" asks.
      const host = itemsOf(workspace, item).at(-1)!;
      const parent = workspace.root.canvasInputs.get(host.parentId!)!;
      const choice = catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(parent.id)!,
      ).find((option) => option.type === item);
      expect(choice, `${list} offers ${item}`).toBeDefined();
      workspace.execute(choice!.build());
      const added = itemsOf(workspace, item);
      expect(added).toHaveLength(before + 1);
      const sources = added.map((record) => record.sourceId).sort();

      await workspace.runtime.save();
      const loaded = await storage.load(PROJECT, library);
      const again = await open(storage, loaded);
      const kept = itemsOf(again.workspace, item);
      expect(kept).toHaveLength(before + 1);
      expect(kept.map((record) => record.sourceId).sort()).toEqual(sources);
    });
  }
});
