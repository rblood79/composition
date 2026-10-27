import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { DataOp } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CATALOG_DB_NAME } from "../../../../../../packages/shared/src/catalog/runtime/storage";
import { useDataStore } from "../../stores/data";
import { reduceDataOps } from "../../stores/utils/dataChange";
import type { DataTable } from "../../../types/builder/data.types";
import {
  bindCatalogDataStore,
  catalogCollectionTables,
} from "../catalogDataStore";
import { catalogBoundRows } from "../dataBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-286 G2 — node bench (run with `ADR286_G2=1`). Arms: A = no data in the document (the HEAD
 * document shape — data lived in the IndexedDB data store) · B = 10 × 100 rows · C = 1 × 1,000 rows.
 * Each arm times the named stages of one edit separately — execute (step + consumers), save
 * (`runtime.save` into fake IndexedDB), undo, Preview delta (flush + structured clone of the
 * message = postMessage's copy). The HEAD data path (store reduce + IDB put of the table + the old
 * `CATALOG_DATA` that carried every collection) is rebuilt from the same reducer as the cell-edit
 * control. Results go to stdout; nothing is asserted.
 */
const RUN = !!process.env.ADR286_G2;
const ITER = Number(process.env.ADR286_G2_ITER ?? 40);
const BODY = "project:node:home-body" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

type Arm = { name: string; collections: number; rows: number };
const ARMS: Arm[] = [
  { name: "A (데이터 없음)", collections: 0, rows: 0 },
  { name: "B (10 × 100)", collections: 10, rows: 100 },
  { name: "C (1 × 1,000)", collections: 1, rows: 1000 },
];
const FIELDS = ["name", "email", "city", "age", "score"];
const row = (i: number) => ({
  name: `Person ${i}`,
  email: `person${i}@example.com`,
  city: ["Seoul", "Busan", "Incheon"][i % 3],
  age: 20 + (i % 50),
  score: (i * 37) % 100,
});

/** The control arm's tables (HEAD's data store); null = the document. */
const headTables: { current: DataTable[] | null } = { current: null };
const LIST = "project:node:g2-list" as NodeId;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const fmt = (ms: number) => ms.toFixed(3);

/** The list bound to `t0` (added after the element-edit stage — arm A has no collection). */
function addBoundList(workspace: CatalogWorkspace) {
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: LIST,
          definitionId:
            "lib:definition:origin-component-listbox" as NodeEntry["definitionId"],
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
          binding: { collectionId: "data:collection:t0", fieldMap: {} },
        } as unknown as NodeEntry,
      ],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
}

async function open(arm: Arm) {
  const factory = new IDBFactory();
  const library = await buildCodeCatalogLibrary();
  const document = newCatalogProjectDocument({
    projectId: "project:project:g2" as EntryId<"project">,
    name: "G2",
  });
  const storage = new CatalogStorage(factory, CATALOG_DB_NAME);
  await storage.create(document, library);
  const graph = new CatalogGraph(document, library);
  const workspace = new CatalogWorkspace(graph, storage, {
    engine: await nodeLayoutEngine(),
    viewport: { width: 1200, height: 800 },
    autosaveSchedule: () => {},
    root: {
      // The Builder's wiring; `headTables` = the control's store (HEAD read rows from it).
      rows: (binding, kind) =>
        catalogBoundRows(
          binding,
          headTables.current ?? catalogCollectionTables(graph),
          kind,
        ),
    },
  });
  useDataStore.getState().reset();
  bindCatalogDataStore(workspace);
  // 60 frames — the same element content in every arm.
  const ids: NodeId[] = [];
  const entries: NodeEntry[] = [];
  for (let i = 0; i < 60; i++) {
    const id = `project:node:g2-${i}` as NodeId;
    ids.push(id);
    entries.push({
      kind: "node",
      id,
      definitionId: "lib:definition:type-frame" as NodeEntry["definitionId"],
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    } as unknown as NodeEntry);
  }
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: ids,
      newId: workspace.newId,
    }),
  );
  for (let c = 0; c < arm.collections; c++)
    await useDataStore.getState().applyDataChange({
      ops: [
        {
          op: "create_collection",
          id: `t${c}`,
          name: `Table${c}`,
          schema: FIELDS.map((key) => ({
            id: `f-${key}`,
            key,
            type: key === "age" || key === "score" ? "number" : "string",
          })),
          rows: Array.from({ length: arm.rows }, (_, i) => row(i)),
        } as DataOp,
      ],
      origin: "user",
    });
  await workspace.runtime.save();
  const posted: unknown[] = [];
  const channel = workspace.attachPreview({ post: (m) => posted.push(m) });
  channel.onReady();
  posted.length = 0;
  return { workspace, factory, ids, channel, posted };
}

type Stages = { execute: number; save: number; undo: number; delta: number };
async function timeEdit(
  ctx: Awaited<ReturnType<typeof open>>,
  edit: (i: number) => Promise<void> | void,
): Promise<Stages & { deltaBytes: number }> {
  const t: Record<keyof Stages, number[]> = {
    execute: [],
    save: [],
    undo: [],
    delta: [],
  };
  let deltaBytes = 0;
  for (let i = 0; i < ITER; i++) {
    let s = performance.now();
    await edit(i);
    t.execute.push(performance.now() - s);
    s = performance.now();
    ctx.channel.flush();
    const message = ctx.posted.pop();
    structuredClone(message);
    t.delta.push(performance.now() - s);
    deltaBytes = JSON.stringify(message ?? null).length;
    s = performance.now();
    await ctx.workspace.runtime.save();
    t.save.push(performance.now() - s);
    s = performance.now();
    ctx.workspace.undo();
    t.undo.push(performance.now() - s);
    ctx.channel.flush();
    ctx.posted.length = 0;
    await ctx.workspace.runtime.save();
  }
  return {
    execute: median(t.execute),
    save: median(t.save),
    undo: median(t.undo),
    delta: median(t.delta),
    deltaBytes,
  };
}

/** HEAD's cell edit: store reduce · IDB put of the table · `CATALOG_DATA` with every collection. */
async function headCellEdit(arm: Arm, workspace: CatalogWorkspace) {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open("g2-head", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("collections", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let collections = new Map<string, DataTable>();
  for (let c = 0; c < arm.collections; c++)
    collections = reduceDataOps(
      collections,
      [
        {
          op: "create_collection",
          id: `t${c}`,
          name: `Table${c}`,
          schema: FIELDS.map((key) => ({
            id: `f-${key}`,
            key,
            type: "string",
          })),
          rows: Array.from({ length: arm.rows }, (_, i) => row(i)),
        } as DataOp,
      ],
      { projectId: "p" },
    ).collections;
  const put = (table: DataTable) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction("collections", "readwrite");
      tx.objectStore("collections").put(table);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  const t = {
    execute: [] as number[],
    save: [] as number[],
    undo: [] as number[],
    delta: [] as number[],
  };
  let deltaBytes = 0;
  for (let i = 0; i < ITER; i++) {
    const op: DataOp = {
      op: "set_cell",
      collectionId: "t0",
      rowIndex: i % arm.rows,
      fieldId: "f-name",
      value: `Edited ${i}`,
    };
    let s = performance.now();
    const result = reduceDataOps(collections, [op], { projectId: "p" });
    collections = result.collections;
    // HEAD's store subscription: `refreshRows(changedCollectionIds)`.
    headTables.current = [...collections.values()];
    workspace.refreshRows(["t0"]);
    t.execute.push(performance.now() - s);
    s = performance.now();
    const message = {
      type: "CATALOG_DATA",
      collections: [...collections.values()].map((table) => ({
        id: table.id,
        name: table.name,
        schema: table.schema,
        mockData: table.mockData,
        useMockData: table.useMockData,
      })),
    };
    structuredClone(message);
    t.delta.push(performance.now() - s);
    deltaBytes = JSON.stringify(message).length;
    s = performance.now();
    await put(collections.get("t0")!);
    t.save.push(performance.now() - s);
    s = performance.now();
    const back = reduceDataOps(collections, result.inverse, { projectId: "p" });
    collections = back.collections;
    headTables.current = [...collections.values()];
    workspace.refreshRows(["t0"]);
    await put(collections.get("t0")!);
    t.undo.push(performance.now() - s);
  }
  db.close();
  headTables.current = null;
  workspace.refreshRows(["t0"]);
  return {
    execute: median(t.execute),
    save: median(t.save),
    undo: median(t.undo),
    delta: median(t.delta),
    deltaBytes,
  };
}

describe.skipIf(!RUN)("ADR-286 G2 bench", () => {
  it("arms A · B · C — element edit · cell edit · HEAD cell-edit control", async () => {
    const lines: string[] = [];
    const log = (label: string, r: Stages & { deltaBytes: number }) =>
      lines.push(
        `${label}\texecute ${fmt(r.execute)}\tsave ${fmt(r.save)}\tundo ${fmt(r.undo)}\tdelta ${fmt(r.delta)}\tdeltaBytes ${r.deltaBytes}`,
      );
    for (const arm of ARMS) {
      const ctx = await open(arm);
      const docBytes = JSON.stringify(
        ctx.workspace.runtime.graph.exportDocument(),
      ).length;
      lines.push(`# ${arm.name} — document JSON ${docBytes} B`);
      // warm-up
      await timeEdit(ctx, (i) => {
        ctx.workspace.execute(
          setFields({
            targets: [{ kind: "node", id: ctx.ids[i % ctx.ids.length]! }],
            visual: { overflow: set(["hidden", "visible", "scroll"][i % 3]!) },
          }),
        );
      });
      log(
        "element edit",
        await timeEdit(ctx, (i) => {
          ctx.workspace.execute(
            setFields({
              targets: [{ kind: "node", id: ctx.ids[i % ctx.ids.length]! }],
              visual: {
                overflow: set(["hidden", "visible", "scroll"][i % 3]!),
              },
            }),
          );
        }),
      );
      if (arm.collections) {
        addBoundList(ctx.workspace);
        await ctx.workspace.runtime.save();
        ctx.channel.flush();
        ctx.posted.length = 0;
        log(
          "cell edit (new)",
          await timeEdit(ctx, async (i) => {
            await useDataStore.getState().applyDataChange({
              ops: [
                {
                  op: "set_cell",
                  collectionId: "t0",
                  rowIndex: i % arm.rows,
                  fieldId: "f-name",
                  value: `Edited ${i}`,
                },
              ],
              origin: "user",
            });
          }),
        );
        await headCellEdit(arm, ctx.workspace); // warm-up
        log("cell edit (HEAD 재구성)", await headCellEdit(arm, ctx.workspace));
      }
    }
    const report = [`[ADR-286 G2] ITER=${ITER} (median ms)`, ...lines, ""].join(
      "\n",
    );
    if (process.env.ADR286_G2_OUT)
      writeFileSync(process.env.ADR286_G2_OUT, report);
    else console.log(report);
  }, 600_000);
});
