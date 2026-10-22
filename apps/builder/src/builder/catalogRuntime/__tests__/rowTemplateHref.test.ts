import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBoundRows } from "../dataBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A bound list's row template takes a per-row link (`href="/detail/{id}"` — the list → detail
 * flow): the edit is one step and every row record stays (the Canvas draws the rows).
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:users",
  fieldMap: {},
};
const COLLECTIONS = [
  {
    id: "users",
    name: "Users",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
      { id: "f-avatar", key: "avatar" },
    ],
    mockData: [
      {
        id: "usr_a1",
        name: "Leo",
        avatar: "https://example.test/a.jpg",
      },
      {
        id: "usr_b2",
        name: "Mia",
        avatar: "https://example.test/b.jpg",
      },
    ],
    useMockData: true,
  },
];

describe("row template href", () => {
  it("a per-row href on a bound ListBox's row template is one step and keeps every row record", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:href" as EntryId<"project">,
          name: "Href",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `row-href-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
        root: { rows: (binding) => catalogBoundRows(binding, COLLECTIONS) },
      },
    );
    const node: NodeEntry = {
      kind: "node",
      id: LIST,
      definitionId: catalogPaletteDefinitionId(library, "ListBox"),
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      binding: BINDING,
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node],
        rootIds: [LIST],
        newId: workspace.newId,
      }),
    );
    const owner = workspace.runtime.graph.getEntry(LIST) as NodeEntry;
    const fill = owner.descendantOverrides.find(
      (item) => item.kind === "fillSlot",
    ) as { childIds: readonly NodeId[] };
    const rowsBefore = [...workspace.root.domInputs.keys()].filter((id) =>
      id.includes("#row:"),
    );
    expect(rowsBefore.length).toBeGreaterThan(0);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: fill.childIds[0]! }],
        props: { href: { kind: "set", value: "/detail/{id}" } },
        label: "Edit properties",
      }),
    );
    const hrefs = [...workspace.root.domInputs.values()]
      .map((record) => record.props.href)
      .filter((href) => typeof href === "string");
    expect(hrefs).toEqual(["/detail/usr_a1", "/detail/usr_b2"]);
  });
});
