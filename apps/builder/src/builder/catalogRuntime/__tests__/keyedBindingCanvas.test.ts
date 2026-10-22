import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBoundRows } from "../dataBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A keyed binding on the Canvas (`useListData.getItem(key)`): a `{{ params.id }}` key has no route
 * here, so the container shows the collection's first item as its sample; a literal key is that
 * item (the same resolution the Preview's root runs).
 */
const BODY = "project:node:home-body" as NodeId;
const COLLECTIONS = [
  {
    id: "users",
    name: "Users",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
    ],
    mockData: [
      { id: "u1", name: "Kim" },
      { id: "u2", name: "Park" },
    ],
    useMockData: true,
  },
];

async function canvasWith(key: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:keyed" as EntryId<"project">,
        name: "Keyed",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `keyed-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rows: (binding) => catalogBoundRows(binding, COLLECTIONS) },
    },
  );
  const frame = "project:node:frame" as NodeId;
  const text = "project:node:text" as NodeId;
  const entries: NodeEntry[] = [
    {
      kind: "node",
      id: frame,
      definitionId: catalogPaletteDefinitionId(library, "frame"),
      children: [text],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      binding: { collectionId: "data:collection:users", fieldMap: {}, key },
    },
    {
      kind: "node",
      id: text,
      definitionId: "lib:definition:text" as NodeEntry["definitionId"],
      children: [],
      props: { children: { kind: "set", value: "{name}" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    },
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [frame],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(text)[0]!;
  return workspace.root.domInputs.get(record)?.props.children;
}

describe("keyed binding — Canvas", () => {
  it("a route key the Canvas cannot read shows the first item as the sample; a literal key that item", async () => {
    expect(await canvasWith("{{ params.id }}")).toBe("Kim");
    expect(await canvasWith("u2")).toBe("Park");
  });
});
