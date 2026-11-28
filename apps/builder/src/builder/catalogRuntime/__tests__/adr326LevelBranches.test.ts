import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CollectionEntry,
  DataBindingRef,
  EndpointEntry,
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  cascaderTableOf,
  cascaderValueMatch,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { CatalogPreviewSession } from "../../../preview/catalog/catalogPreviewSession";
import { useDataStore } from "../../stores/data";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import { catalogBindingCommand } from "../dataBindingCommand";
import { NullLayoutEngine } from "../nullLayoutEngine";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogPreviewChannel } from "../previewChannel";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 · §4.7 (4) — a Cascader whose levels load one by one (its query endpoint reads
 * `{{ parentKey }}` and declares keys unique). The Builder has the first answer only (the API
 * rows the store caches); a Preview that just opened has loaded no level either. A start key of a
 * branch whose level is not loaded is a `branch` on both sides (no value — its key shown); a key
 * inside that level is `missing` on both. The expected kinds are written out here.
 */
const COLLECTION = "data:collection:regions" as DataBindingRef["collectionId"];
const PLACED = "project:node:placed" as NodeId;
const FIRST = [
  { id: "11", name: "서울", more: true },
  { id: "26", name: "부산", more: true },
  { id: "36", name: "세종", more: false },
];

afterEach(() => {
  vi.restoreAllMocks();
  useDataStore.setState({ runtimeRows: new Map() });
});

async function open(start: string, flagged: boolean) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // (The Preview asks nothing here — no level is opened; a request would never answer.)
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  useDataStore.setState({ runtimeRows: new Map([["regions", FIRST]]) });
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr326-levels" as EntryId<"project">,
      name: "ADR-326 levels",
    }),
    library,
  );
  const workspace: CatalogWorkspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr326-levels-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        // (The Builder's own row reader, as `CatalogBuilderCore` wires it.)
        rows: (binding, kind, ownerId, _path, slices) =>
          catalogBuilderBoundRows(
            workspace.runtime.graph,
            binding,
            kind,
            ownerId,
            slices,
          ),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "Regions",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-more", key: "more", type: "boolean" },
          ],
          mockData: [],
          useMockData: false,
        } as unknown as CollectionEntry,
        {
          kind: "endpoint",
          id: "data:endpoint:regions" as EndpointEntry["id"],
          name: "regions",
          method: "GET",
          baseUrl: "http://stub.local",
          path: "/regions",
          headers: [],
          queryParams: [
            {
              key: "parent",
              value: "{{ parentKey }}",
              type: "string",
              required: false,
            },
          ],
          bodyType: "none",
          responseMapping: { dataPath: "", keysUnique: true },
          targetCollectionId: COLLECTION,
          executionMode: "client",
        } as EndpointEntry,
      ],
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: { defaultValue: { kind: "set", value: start } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: PLACED }],
      {
        collectionId: COLLECTION,
        fieldMap: {
          value: "data:field:f-id",
          label: "data:field:f-name",
          ...(flagged ? { hasChildren: "data:field:f-more" } : {}),
        } as DataBindingRef["fieldMap"],
      },
      workspace.newId,
    ),
  );
  // The Preview: the document, then the Builder's API rows (`CATALOG_DATA`).
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  channel.onReady();
  session.receive({
    type: "CATALOG_DATA",
    version: 1,
    variables: [],
    collections: [
      {
        id: "regions",
        name: "Regions",
        schema: [
          { id: "f-id", key: "id", type: "string" },
          { id: "f-name", key: "name", type: "string" },
          { id: "f-more", key: "more", type: "boolean" },
        ],
        mockData: [],
        runtimeData: FIRST,
        useMockData: false,
      },
    ],
    apiEndpoints: [
      {
        id: "regions",
        name: "regions",
        method: "GET",
        baseUrl: "http://stub.local",
        path: "/regions",
        headers: [],
        queryParams: [
          {
            key: "parent",
            value: "{{ parentKey }}",
            type: "string",
            required: false,
          },
        ],
        bodyType: "none",
        responseMapping: { dataPath: "", keysUnique: true },
        targetCollectionId: "regions",
        executionMode: "client",
      },
    ],
  } as never);
  flushes.splice(0).forEach((run) => run());

  const builderTable = () => {
    const root = workspace.root;
    const get = (id: string) => root.domInputs.get(id);
    return cascaderTableOf(
      get(root.recordsOfSource(PLACED)[0]!)!,
      get,
      (node) => root.typeOf(node),
    );
  };
  const previewTable = () => {
    const root = session.root!;
    const get = (id: string) => root.domInputs.get(id);
    const record = root.recordsOfSource(PLACED)[0]!;
    return cascaderTableOf(
      get(record)!,
      get,
      (node) => root.typeOf(node),
      session.cascaderLevels(record),
    );
  };
  return { builderTable, previewTable };
}

describe("ADR-326 §4.7 (4) — a branch whose level is not loaded: the same answer on both sides", () => {
  for (const flagged of [false, true])
    it(`start 11 = branch · 11-1 = missing · 36 (${flagged ? "flagged leaf" : "no flag field — a branch too"})`, async () => {
      const at11 = await open("11", flagged);
      // (The Preview's levels are its session's — loaded one by one.)
      expect(
        [...(at11.previewTable().entries ?? [])].length,
        "preview rows",
      ).toBe(3);
      for (const side of ["builderTable", "previewTable"] as const) {
        expect(cascaderValueMatch(at11[side](), "11").kind, side).toBe(
          "branch",
        );
        expect(cascaderValueMatch(at11[side](), "36").kind, `${side} 36`).toBe(
          flagged ? "item" : "branch",
        );
      }
      const inside = await open("11-1", flagged);
      for (const side of ["builderTable", "previewTable"] as const)
        expect(cascaderValueMatch(inside[side](), "11-1").kind, side).toBe(
          "missing",
        );
    });
});
