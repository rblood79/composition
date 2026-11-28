import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 (HC4) — a prop the Cascader's template binds (`{label}` · `{description}` …)
 * re-resolves every record under the instance (`bindingDependents`). Each was resolved on its own
 * path, and each path projects the bound rows' whole hierarchy: a label write on a bound Cascader
 * of 1,307 records took 7.8 s, of 3,917 records 67 s (each item now has a Text · Icon — 사용자
 * 결정 2). The records under one instance are resolved together: the resolver visits stay a few
 * times the record count, and the records are the ones a fresh root draws.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const nested = (depth: number, width: number, prefix = "R"): unknown[] =>
  Array.from({ length: width }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `${prefix}${i}`,
    ...(depth > 1 ? { sub: nested(depth - 1, width, `${prefix}${i}-`) } : {}),
  }));

async function open() {
  const sources = [
    {
      id: "t",
      schema: [
        { id: "f-id", key: "id" },
        { id: "f-name", key: "name" },
        { id: "f-sub", key: "sub", type: "array" },
      ],
      mockData: nested(3, 6),
      useMockData: true,
    },
  ];
  const library = await buildCodeCatalogLibrary();
  const engine = await nodeLayoutEngine();
  const open = (graph: CatalogGraph) =>
    new CatalogWorkspace(
      graph,
      new CatalogStorage(indexedDB, `adr326-scale-${Math.random()}`),
      {
        engine,
        viewport: { width: 1600, height: 900 },
        autosaveSchedule: () => {},
        root: {
          rows: (binding, kind, _owner, _path, slices) =>
            catalogBoundRows(
              binding,
              sources as never,
              kind,
              undefined,
              undefined,
              slices,
            ),
        },
      },
    );
  const workspace = open(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-scale" as EntryId<"project">,
        name: "ADR-326 scale",
      }),
      library,
    ),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: {},
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
        collectionId: "data:collection:t" as DataBindingRef["collectionId"],
        fieldMap: {
          value: "data:field:f-id",
          children: "data:field:f-sub",
        } as DataBindingRef["fieldMap"],
      },
      workspace.newId,
    ),
  );
  /** The same document in a fresh root (every record resolved whole). */
  const fresh = () =>
    open(
      new CatalogGraph(
        structuredClone(workspace.runtime.graph.exportDocument()),
        library,
      ),
    );
  return { workspace, fresh };
}

/** What a record draws: its props, visual, layout (compared with a fresh root's). */
const drawn = (workspace: CatalogWorkspace) =>
  new Map(
    [...workspace.root.domInputs].map(([id, record]) => [
      id,
      JSON.stringify([record.props, record.visual, record.layout]),
    ]),
  );

describe("ADR-326 HC4 — a bound Cascader's bound prop resolves its records together", () => {
  it("label · description · size writes: resolver visits a few times the records, records = a fresh root's", async () => {
    const { workspace, fresh } = await open();
    const records = workspace.root.domInputs.size;
    expect(records).toBeGreaterThan(700);
    for (const props of [
      { label: "Big" },
      { description: "words" },
      { size: "L" },
    ]) {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: PLACED }],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
        } as never),
      );
      expect(
        workspace.root.metrics.resolverVisits,
        JSON.stringify(props),
      ).toBeLessThan(records * 4);
      expect(drawn(workspace), JSON.stringify(props)).toEqual(drawn(fresh()));
    }
    workspace.undo();
    expect(drawn(workspace)).toEqual(drawn(fresh()));
  }, 120000);
});
