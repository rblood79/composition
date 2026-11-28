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
import type { CollectionDataSource } from "@composition/shared";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import {
  catalogBoundRows,
  catalogCollectionId,
} from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { sendCatalogData } from "./support/catalogDataEntries";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * ADR-323 판독 F3 — a bound Timeline in the Preview draws every row: it is an `ol` with no
 * collection end to see (no RAC load-more item), so a 100-row window would hide the rest.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:timeline" as NodeId;

describe("ADR-323 — a bound Timeline reads every row in the Preview", () => {
  it("101 local rows: 101 items, the last row's title among them", async () => {
    const library = await buildCodeCatalogLibrary();
    const collections: CollectionDataSource[] = [
      {
        id: "events",
        name: "Events",
        schema: [
          { id: "f-id", key: "id", type: "string" },
          { id: "f-title", key: "title", type: "string" },
        ],
        mockData: Array.from({ length: 101 }, (_, n) => ({
          id: `e${n + 1}`,
          title: `Event ${n + 1}`,
        })),
        useMockData: true,
      } as CollectionDataSource,
    ];
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:adr323-rows" as EntryId<"project">,
          name: "Rows",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr323-rows-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
        root: {
          rows: (binding, kind) => catalogBoundRows(binding, collections, kind),
        },
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: LIST,
            definitionId: catalogPaletteDefinitionId(library, "Timeline"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [LIST],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        {
          collectionId: catalogCollectionId("events"),
          fieldMap: { title: "data:field:f-title" },
        } as never,
        workspace.newId,
      ),
    );
    const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
      requestSnapshot: (request) =>
        channel.onPreviewMessage(structuredClone(request)),
      engine: () => new NullLayoutEngine(),
      viewport: { width: 1000, height: 800 },
    });
    const channel = new CatalogPreviewChannel(workspace.runtime, {
      post: (message) => session.receive(structuredClone(message)),
    });
    channel.onReady();
    sendCatalogData(workspace, session, structuredClone({ collections }));
    const root = session.root!;
    const list = root.domInputs.get(root.recordsOfSource(LIST)[0]!)!;
    const items = list.children.map((id) => root.domInputs.get(id)!);
    expect(items).toHaveLength(101);
    expect(items.at(-1)!.props.label).toBe("Event 101");
  });
});
