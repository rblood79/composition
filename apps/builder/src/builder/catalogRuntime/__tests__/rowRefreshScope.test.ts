import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  addView,
  promoteBindingView,
  updateView,
} from "../../../../../../packages/shared/src/catalog/commands/views";
import {
  addCollection,
  updateCollection,
} from "../../../../../../packages/shared/src/catalog/commands/data";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { applyCatalogTransaction } from "../../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  CatalogDocument,
  CollectionEntry,
  NodeEntry,
  NodeId,
  ViewEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBoundRows } from "../dataBinding";
import { catalogCollectionTables } from "../catalogDataRead";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body";
const LIST = "project:node:list" as NodeId;
const COLLECTION = "data:collection:c1";
const rows = (label = "Alpha") => [
  { id: "a", label },
  { id: "b", label: "Beta" },
];
const collection = (mockData = rows()): CollectionEntry => ({
  kind: "collection",
  id: COLLECTION,
  name: "Rows",
  useMockData: true,
  schema: [
    { id: "id", key: "id", type: "string" },
    { id: "label", key: "label", type: "string" },
  ],
  mockData,
});
const records = (workspace: CatalogWorkspace) =>
  [...workspace.root.domInputs].sort(([a], [b]) => a.localeCompare(b));

async function fixture(filler: number, runtimeRows = false) {
  const library = await buildCodeCatalogLibrary();
  const doc = newCatalogProjectDocument({
    projectId: "project:project:row-scope",
    name: "Row scope",
  });
  const entries = { ...doc.entries };
  const project = entries[doc.projectId];
  const body = entries[BODY];
  if (project.kind !== "project" || body.kind !== "node")
    throw Error("fixture");
  const node = (
    id: NodeId,
    definitionId: NodeEntry["definitionId"],
  ): NodeEntry => ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const ids = Array.from(
    { length: filler },
    (_, i) => `project:node:peer-${i}` as NodeId,
  );
  for (const id of ids) entries[id] = node(id, "lib:definition:type-frame");
  entries[BODY] = { ...body, children: ids };
  entries[COLLECTION] = { ...collection(), useMockData: !runtimeRows };
  entries[doc.projectId] = { ...project, collectionIds: [COLLECTION] };
  // The bound list is placed as the Builder places it (its items its own nodes, its first one the
  // rows' template — ADR-310), not written into the document with its origin's item positions.
  const placing = new CatalogGraph({ ...doc, entries }, library);
  let next = 0;
  const plan = insertNodes({
    parent: { kind: "node", id: BODY },
    entries: [
      {
        ...node(LIST, catalogPaletteDefinitionId(library, "ListBox")),
        binding: {
          collectionId: COLLECTION,
          fieldMap: { label: "data:field:label" },
        },
      },
    ],
    rootIds: [LIST],
    newId: (kind) => `project:${kind}:fixture-${next++}` as never,
  })(placing);
  applyCatalogTransaction(placing, {
    projectId: placing.projectId,
    expectedRevision: placing.revision,
    history: { kind: "skip", reason: "fixture" },
    ops: plan.ops,
  });
  Object.assign(entries, placing.exportDocument().entries);
  const runtime = new Map<string, Record<string, unknown>[]>([["c1", rows()]]);
  const create = async (document: CatalogDocument) => {
    const graph = new CatalogGraph(document, library);
    const engine = await nodeLayoutEngine();
    const workspace = new CatalogWorkspace(
      graph,
      new CatalogStorage(indexedDB, `row-scope-${Math.random()}`),
      {
        engine,
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
        root: {
          rows: (binding, kind) =>
            catalogBoundRows(
              binding,
              catalogCollectionTables(graph, runtime),
              kind,
            ),
        },
      },
    );
    return { workspace, engine };
  };
  return {
    ...(await create({ ...doc, entries })),
    runtime,
    fresh: (workspace: CatalogWorkspace) =>
      create(workspace.runtime.graph.exportDocument()),
  };
}

describe("data refresh owner scope", () => {
  it.each([0, 100, 5000])(
    "무관한 형제 %i개가 API row 해석 범위를 늘리지 않고 같은 record는 유지한다",
    async (filler) => {
      const { workspace, engine, runtime } = await fixture(filler, true);
      const root = workspace.root;
      const before = new Map(root.canvasInputs);
      const compute = vi.spyOn(engine, "computeLayout");
      try {
        runtime.set("c1", rows("Changed"));
        workspace.refreshRows(["c1"]);
        expect(root.metrics.resolverVisits).toBeLessThan(100);
        // The layout pass visits the bound list's own records only — not the body, not a sibling.
        // (27 = list + 2 rows × (item · selection Checkbox 6 · check Icon · icon · label ·
        // description) + empty state 4; the selection parts are `73fc516d2` · `8560fece5`.)
        const owned: string[] = [];
        const walk = (id: string) => {
          const record = root.canvasInputs.get(id);
          if (!record) return;
          owned.push(id);
          record.children.forEach(walk);
        };
        walk(root.recordsOfSource(LIST)[0]!);
        expect(owned).toHaveLength(27);
        expect(root.metrics.layoutInputVisits).toBe(owned.length);
        expect(
          [...root.canvasInputs].filter(
            ([id, record]) =>
              JSON.stringify(before.get(id)) !== JSON.stringify(record),
          ),
        ).toHaveLength(2);
        for (const [id, record] of before)
          if (record.sourceId.startsWith("project:node:peer-"))
            expect(root.canvasInputs.get(id)).toBe(record);
        compute.mockClear();
        let noticed = 0;
        const unsub = [...root.canvasInputs.keys()].map((id) =>
          root.subscribeCanvas(id, () => noticed++),
        );
        workspace.refreshRows(["c1"]);
        expect(noticed).toBe(0);
        expect(compute).not.toHaveBeenCalled();
        unsub.forEach((stop) => stop());
      } finally {
        workspace.dispose();
      }
    },
  );

  it("문서의 mock row 수정·추가·정렬·삭제·Undo/Redo가 fresh resolve와 일치한다", async () => {
    const { workspace, fresh } = await fixture(1000);
    try {
      for (const next of [
        rows("Changed"),
        [{ id: "c", label: "Gamma" }, ...rows()],
        [rows()[1]],
        [],
      ]) {
        workspace.execute(updateCollection({ entry: collection(next) }));
        // (The list's own records only — ~15 per row over 62: never the 1,000 siblings. Its items
        //  are its own nodes since ADR-310, resolved per row on the owned path.)
        expect(workspace.root.metrics.resolverVisits).toBeLessThan(150);
        const copy = await fresh(workspace);
        expect(records(workspace)).toEqual(records(copy.workspace));
        const geometry = (w: CatalogWorkspace) =>
          [...w.root.getGeometry(w.root.canvasInputs.keys())].sort(([a], [b]) =>
            a.localeCompare(b),
          );
        expect(geometry(workspace)).toEqual(geometry(copy.workspace));
        copy.workspace.dispose();
      }
      workspace.undo();
      expect(
        [...workspace.root.domInputs.values()].some(
          (record) => record.props.children === "Beta",
        ),
      ).toBe(true);
      workspace.redo();
      expect(
        [...workspace.root.domInputs.values()].some(
          (record) => record.props.children === "Beta",
        ),
      ).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  it("공유 view를 거쳐 정렬하는 owner도 무관한 형제 없이 갱신한다", async () => {
    const { workspace, fresh } = await fixture(1000);
    try {
      const viewId = "project:view:rows";
      workspace.execute(
        promoteBindingView({ nodeId: LIST, id: viewId, name: "Rows" }),
      );
      const derived: ViewEntry = {
        kind: "view",
        id: "project:view:derived",
        name: "Derived",
        source: { viewId },
        where: { id: "all", op: "and", items: [] },
      };
      workspace.execute(addView({ entry: derived }));
      workspace.execute((reader) => {
        const node = reader.getEntry(LIST) as NodeEntry;
        return {
          label: "Use derived view",
          ops: [
            {
              kind: "put",
              entry: {
                ...node,
                binding: { ...node.binding!, viewId: derived.id },
              },
            },
          ],
        };
      });
      const view = workspace.runtime.graph.getEntry(viewId) as ViewEntry;
      workspace.execute(
        updateView({
          entry: {
            ...view,
            sort: { field: ["data:field:label"], direction: "descending" },
          },
        }),
      );
      expect(workspace.root.metrics.resolverVisits).toBeLessThan(100);
      const copy = await fresh(workspace);
      expect(records(workspace)).toEqual(records(copy.workspace));
      const list = [...workspace.root.domInputs.values()].find(
        (record) => record.sourceId === LIST,
      )!;
      const labels: unknown[] = [];
      const visit = (id: string) => {
        const record = workspace.root.domInputs.get(id)!;
        if (
          !record.children.length &&
          ["Alpha", "Beta"].includes(String(record.props.children))
        )
          labels.push(record.props.children);
        record.children.forEach(visit);
      };
      visit(list.id);
      expect(labels).toEqual(["Beta", "Alpha"]);
      copy.workspace.dispose();
    } finally {
      workspace.dispose();
    }
  });

  it.each([false, true])(
    "2단계 reference의 %s runtime 변경도 실제 필터 결과를 갱신한다",
    async (runtimeRows) => {
      const { workspace, runtime } = await fixture(1000, runtimeRows);
      const org: CollectionEntry = {
        kind: "collection",
        id: "data:collection:orgs",
        name: "Orgs",
        useMockData: !runtimeRows,
        schema: [
          { id: "oid", key: "id", type: "string" },
          { id: "name", key: "name", type: "string" },
        ],
        mockData: [{ id: "o1", name: "Red" }],
      };
      const team: CollectionEntry = {
        kind: "collection",
        id: "data:collection:teams",
        name: "Teams",
        useMockData: true,
        schema: [
          { id: "tid", key: "id", type: "string" },
          {
            id: "org",
            key: "orgId",
            type: "reference",
            reference: { collectionId: "orgs", keyField: "oid" },
          },
        ],
        mockData: [{ id: "t1", orgId: "o1" }],
      };
      try {
        runtime.set("orgs", [{ id: "o1", name: "Red" }]);
        workspace.execute(addCollection({ entry: org }));
        workspace.execute(addCollection({ entry: team }));
        const data = [{ id: "a", label: "Alpha", teamId: "t1" }];
        runtime.set("c1", data);
        workspace.execute(
          updateCollection({
            entry: {
              ...collection(),
              useMockData: !runtimeRows,
              mockData: data,
              schema: [
                ...collection().schema,
                {
                  id: "team",
                  key: "teamId",
                  type: "reference",
                  reference: { collectionId: "teams", keyField: "tid" },
                },
              ],
            },
          }),
        );
        workspace.execute((reader) => {
          const node = reader.getEntry(LIST) as NodeEntry;
          return {
            label: "Filter reference",
            ops: [
              {
                kind: "put",
                entry: {
                  ...node,
                  binding: {
                    ...node.binding!,
                    view: {
                      where: {
                        id: "all",
                        op: "and",
                        items: [
                          {
                            id: "red",
                            fields: [
                              [
                                "data:field:team",
                                "data:field:org",
                                "data:field:name",
                              ],
                            ],
                            op: "equals",
                            value: "Red",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          };
        });
        const hasAlpha = () =>
          [...workspace.root.domInputs.values()].some(
            (record) => record.props.children === "Alpha",
          );
        expect(hasAlpha()).toBe(true);
        const blue = [{ id: "o1", name: "Blue" }];
        if (runtimeRows) {
          runtime.set("orgs", blue);
          workspace.refreshRows(["orgs"]);
        } else
          workspace.execute(
            updateCollection({ entry: { ...org, mockData: blue } }),
          );
        expect(hasAlpha()).toBe(false);
        expect(workspace.root.metrics.resolverVisits).toBeLessThan(100);
      } finally {
        workspace.dispose();
      }
    },
  );

  it("부분 적용 중 엔진 실패는 문서·record·인덱스를 복구하고 재시도할 수 있다", async () => {
    const { workspace, engine, fresh } = await fixture(100);
    const before = records(workspace);
    const document = workspace.runtime.graph.exportDocument();
    try {
      vi.spyOn(engine, "computeLayout").mockImplementationOnce(() => {
        throw Error("EXPECTED_LAYOUT_FAILURE");
      });
      expect(() =>
        workspace.execute(
          updateCollection({
            entry: collection([{ id: "c", label: "Gamma" }]),
          }),
        ),
      ).toThrow();
      expect(workspace.runtime.graph.exportDocument()).toEqual(document);
      expect(records(workspace)).toEqual(before);
      workspace.execute(updateCollection({ entry: collection(rows("Retry")) }));
      const copy = await fresh(workspace);
      expect(records(workspace)).toEqual(records(copy.workspace));
      copy.workspace.dispose();
    } finally {
      workspace.dispose();
    }
  });
});
