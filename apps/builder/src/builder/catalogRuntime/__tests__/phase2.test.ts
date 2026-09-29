import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { cloneNodeSubgraph } from "../../../../../../packages/shared/src/catalog/document/clone";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../../packages/shared/src/catalog/transactions/transaction";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import {
  exportCatalogFolder,
  exportCatalogJson,
  importCatalogFolder,
  importCatalogJson,
  writeCatalogFolder,
} from "../exchange";

let dbSequence = 0;
const storage = (hooks?: ConstructorParameters<typeof CatalogStorage>[2]) =>
  new CatalogStorage(indexedDB, `adr248-phase2-test-${++dbSequence}`, hooks);
const fixture = () => {
  const { document, library } = createG1Fixture();
  return { document, library, graph: new CatalogGraph(document, library) };
};
const semantic = (graph: CatalogGraph) => {
  const { revision: _revision, ...document } = graph.exportDocument();
  return document;
};
const node = (id: NodeEntry["id"]): NodeEntry => ({
  kind: "node",
  id,
  definitionId: "lib:definition:text",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

describe("ADR-248 Phase 2 independent runtime / G2", () => {
  it("one command is one history entry; create, move, style, reset, clone, paste and delete invert and redo", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    const run = (label: string, ops: CatalogOperation[]) => {
      const before = semantic(graph);
      const depth = runtime.historyDepth.undo;
      const result = runtime.dispatch(label, ops);
      const after = semantic(graph);
      expect(runtime.historyDepth.undo).toBe(depth + 1);
      expect(result.forward).toHaveLength(ops.length);
      runtime.undo();
      expect(semantic(graph)).toEqual(before);
      runtime.redo();
      expect(semantic(graph)).toEqual(after);
    };
    const page = graph.getEntry("project:page:main") as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    run("create", [
      { kind: "put", entry: node("project:node:new") },
      {
        kind: "put",
        entry: { ...page, children: [...page.children, "project:node:new"] },
      },
    ]);
    const createdPage = graph.getEntry(page.id) as typeof page;
    run("move", [
      {
        kind: "put",
        entry: {
          ...createdPage,
          children: ["project:node:new", ...page.children],
        },
      },
    ]);
    run("style", [
      {
        kind: "patchNodeVisual",
        id: "project:node:new",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    run("reset", [
      {
        kind: "patchNodeVisual",
        id: "project:node:new",
        key: "fill",
        write: { kind: "remove" },
      },
    ]);
    const movedPage = graph.getEntry(page.id) as typeof page;
    const clone = cloneNodeSubgraph(
      graph,
      "project:node:cardA",
      () => "project:node:clone",
    );
    run("clone", [
      ...clone.entries.map(
        (entry) => ({ kind: "put", entry }) as CatalogOperation,
      ),
      {
        kind: "put",
        entry: {
          ...movedPage,
          children: [...movedPage.children, "project:node:clone"],
        },
      },
    ]);
    const clonedPage = graph.getEntry(page.id) as typeof page;
    const paste = cloneNodeSubgraph(
      graph,
      "project:node:cardA",
      () => "project:node:paste",
    );
    run("paste", [
      ...paste.entries.map(
        (entry) => ({ kind: "put", entry }) as CatalogOperation,
      ),
      {
        kind: "put",
        entry: {
          ...clonedPage,
          children: [...clonedPage.children, "project:node:paste"],
        },
      },
    ]);
    const pastedPage = graph.getEntry(page.id) as typeof page;
    run("delete", [
      {
        kind: "put",
        entry: {
          ...pastedPage,
          children: pastedPage.children.filter(
            (id) => id !== "project:node:paste",
          ),
        },
      },
      { kind: "remove", id: "project:node:paste" },
    ]);
  });

  it("definition detach, library override and binding ref edit use the same reducer", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    const root = graph.getEntry(graph.projectId) as Extract<
      CatalogEntry,
      { kind: "project" }
    >;
    const before = semantic(graph);
    runtime.dispatch("detach", [
      {
        kind: "put",
        entry: {
          kind: "definition",
          id: "project:definition:detached",
          name: "Detached",
          mode: "primitive",
          bindingId: "text",
          accepts: { children: "string" },
          defaults: {},
          visual: {},
          stateRules: {},
        },
      },
      {
        kind: "put",
        entry: { ...root, definitionIds: ["project:definition:detached"] },
      },
      {
        kind: "put",
        entry: {
          ...(graph.getEntry("project:node:cardA") as NodeEntry),
          definitionId: "project:definition:detached",
        },
      },
    ]);
    runtime.undo();
    expect(semantic(graph)).toEqual(before);
    runtime.redo();
    expect(
      (graph.getEntry("project:node:cardA") as NodeEntry).definitionId,
    ).toBe("project:definition:detached");
    const root2 = graph.getEntry(graph.projectId) as typeof root;
    runtime.dispatch("override", [
      {
        kind: "put",
        entry: {
          kind: "definitionOverride",
          id: "project:definitionOverride:text",
          targetId: "lib:definition:text",
          defaults: {},
          visual: {},
          stateRules: {},
        },
      },
      {
        kind: "put",
        entry: { ...root2, overrideIds: ["project:definitionOverride:text"] },
      },
    ]);
    const overrideBefore = semantic(graph);
    runtime.dispatch("override fill", [
      {
        kind: "patchDefinitionOverride",
        id: "project:definitionOverride:text",
        scope: "visual",
        key: "color",
        write: { kind: "set", value: "blue" },
      },
    ]);
    runtime.undo();
    expect(semantic(graph)).toEqual(overrideBefore);
    runtime.redo();
    const filled = semantic(graph);
    runtime.dispatch("override reset", [
      {
        kind: "patchDefinitionOverride",
        id: "project:definitionOverride:text",
        scope: "visual",
        key: "color",
        write: { kind: "remove" },
      },
    ]);
    runtime.undo();
    expect(semantic(graph)).toEqual(filled);
    runtime.redo();
    runtime.dispatch("binding", [
      {
        kind: "setNodeBinding",
        id: "project:node:cardB",
        binding: {
          collectionId: "data:collection:rows",
          fieldMap: { children: "data:field:title" },
        },
      },
    ]);
    expect(
      graph.indexes.collectionToBindings
        .get("data:collection:rows")
        ?.has("project:node:cardB"),
    ).toBe(true);
    runtime.undo();
    expect(graph.indexes.collectionToBindings.has("data:collection:rows")).toBe(
      false,
    );
  });

  it("failed validation and stale revision leave graph, indexes, history, dirty and subscribers unchanged", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    let notifications = 0;
    runtime.subscribeEntryField(
      "project:node:cardA",
      "props.children",
      () => notifications++,
    );
    const before = {
      graph: semantic(graph),
      indexes: graph.indexes,
      history: graph.history,
      dirty: [...graph.dirtyIds],
      revision: graph.revision,
      pending: runtime.pendingCount,
      depth: runtime.historyDepth,
    };
    expect(() =>
      runtime.dispatch("invalid", [
        {
          kind: "patchNodeProp",
          id: "project:node:cardA",
          key: "children",
          write: { kind: "set", value: "changed" },
        },
        {
          kind: "setNodeBinding",
          id: "project:node:cardA",
          binding: {
            collectionId: "data:collection:rows",
            fieldMap: { children: "bad" as "data:field:bad" },
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      runtime.dispatch(
        "stale",
        [
          {
            kind: "patchNodeVisual",
            id: "project:node:cardA",
            key: "fill",
            write: { kind: "set", value: "red" },
          },
        ],
        -1,
      ),
    ).toThrow();
    expect({
      graph: semantic(graph),
      indexes: graph.indexes,
      history: graph.history,
      dirty: [...graph.dirtyIds],
      revision: graph.revision,
      pending: runtime.pendingCount,
      depth: runtime.historyDepth,
    }).toEqual(before);
    expect(notifications).toBe(0);
  });

  it("delta invalidates only affected resolver/cache/ID and field subscribers; leaf has no graph traversal or full export", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    let changed = 0;
    let unrelated = 0;
    runtime.subscribeResolvedField(
      "project:node:cardA",
      "visual.fill",
      () => changed++,
    );
    runtime.subscribeResolvedField(
      "project:node:cardB",
      "visual.fill",
      () => unrelated++,
    );
    runtime.subscribeEntryField(
      "project:node:cardB",
      "props.children",
      () => unrelated++,
    );
    const originalExport = graph.exportDocument;
    graph.exportDocument = () => {
      throw new Error("full export on leaf");
    };
    const result = runtime.dispatch("leaf", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    graph.exportDocument = originalExport;
    expect(result.changedIds).toEqual(new Set(["project:node:cardA"]));
    expect(runtime.lastInvalidatedIds).toContain("project:node:cardA");
    expect(runtime.lastInvalidatedIds).not.toContain("project:node:cardB");
    expect(changed).toBe(1);
    expect(unrelated).toBe(0);
    expect(graph.metrics).toMatchObject({
      transactionEntriesTraversed: 0,
      transactionEntryTableClones: 0,
      transactionRecordReplacements: 1,
    });
    expect(runtime.pendingCount).toBe(1);
  });

  it("definition override closure updates dependent resolved subscribers without notifying unrelated fields", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    const root = graph.getEntry(graph.projectId) as Extract<
      CatalogEntry,
      { kind: "project" }
    >;
    runtime.dispatch("add override", [
      {
        kind: "put",
        entry: {
          kind: "definitionOverride",
          id: "project:definitionOverride:box",
          targetId: "lib:definition:box",
          defaults: {},
          visual: {},
          stateRules: {},
        },
      },
      {
        kind: "put",
        entry: { ...root, overrideIds: ["project:definitionOverride:box"] },
      },
    ]);
    let first = 0;
    let second = 0;
    let irrelevant = 0;
    runtime.subscribeResolvedField(
      "project:node:cardA",
      "children.0.visual.fill",
      () => first++,
    );
    runtime.subscribeResolvedField(
      "project:node:cardB",
      "children.0.visual.fill",
      () => second++,
    );
    runtime.subscribeResolvedField(
      "project:node:cardB",
      "props.unused",
      () => irrelevant++,
    );
    runtime.dispatch("override value", [
      {
        kind: "patchDefinitionOverride",
        id: "project:definitionOverride:box",
        scope: "visual",
        key: "fill",
        write: { kind: "set", value: "green" },
      },
    ]);
    expect(runtime.lastInvalidatedIds).toEqual(
      expect.arrayContaining(["project:node:cardA", "project:node:cardB"]),
    );
    expect([first, second, irrelevant]).toEqual([1, 1, 0]);
    const rootWithOverride = graph.getEntry(graph.projectId) as typeof root;
    runtime.dispatch("remove override", [
      { kind: "put", entry: { ...rootWithOverride, overrideIds: [] } },
      { kind: "remove", id: "project:definitionOverride:box" },
    ]);
    expect(runtime.lastInvalidatedIds).toEqual(
      expect.arrayContaining(["project:node:cardA", "project:node:cardB"]),
    );
    expect([first, second, irrelevant]).toEqual([2, 2, 0]);
  });

  it("nested descendant patch is one reversible command and only its instance subscriber changes", () => {
    const { graph } = fixture();
    const runtime = new CatalogRuntime(graph, storage());
    const field = "children.0.children.0.props.children";
    let first = 0;
    let second = 0;
    runtime.subscribeResolvedField("project:node:cardA", field, () => first++);
    runtime.subscribeResolvedField("project:node:cardB", field, () => second++);
    const initial = runtime.selectResolvedField("project:node:cardA", field);
    runtime.dispatch("patch descendant", [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address: {
            instances: ["project:node:cardA"],
            templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
          },
          props: { children: { kind: "set", value: "Edited" } },
        },
      },
    ]);
    expect(runtime.selectResolvedField("project:node:cardA", field)).toBe(
      "Edited",
    );
    expect([first, second]).toEqual([1, 0]);
    expect(runtime.historyDepth.undo).toBe(1);
    runtime.undo();
    expect(runtime.selectResolvedField("project:node:cardA", field)).toBe(
      initial,
    );
    runtime.redo();
    expect(runtime.selectResolvedField("project:node:cardA", field)).toBe(
      "Edited",
    );
  });
});

describe("ADR-248 Phase 2 independent storage / G4 subset", () => {
  it("create → edit → undo/redo → durable save → restart/load preserves semantic graph; delta writes only changed record", async () => {
    const { graph, library } = fixture();
    const db = storage();
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    runtime.dispatch("edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    runtime.undo();
    runtime.redo();
    expect(runtime.pendingCount).toBe(3);
    expect([...runtime.dirtyIds]).toEqual(["project:node:cardA"]);
    await runtime.save();
    expect(runtime.durableRevision).toBe(3);
    expect(runtime.pendingCount).toBe(0);
    expect(runtime.dirtyIds.size).toBe(0);
    const loaded = await db.load(graph.projectId, library);
    expect(loaded.revision).toBe(3);
    expect(new CatalogGraph(loaded, library).exportDocument()).toEqual(
      graph.exportDocument(),
    );
  });

  it("failure before and inside IDB transaction keeps durable head unchanged and retry succeeds", async () => {
    const { graph, library } = fixture();
    let failBefore = true;
    let failInside = false;
    const db = storage({
      beforeTransaction: () => {
        if (failBefore) throw new Error("injected before");
      },
      afterWritesBeforeCommit: () => {
        if (failInside) throw new Error("injected inside");
      },
    });
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    runtime.dispatch("edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    await expect(runtime.save()).rejects.toThrow();
    expect(runtime.durableRevision).toBe(0);
    expect(runtime.dirtyIds.has("project:node:cardA")).toBe(true);
    expect((await db.load(graph.projectId, library)).revision).toBe(0);
    failBefore = false;
    failInside = true;
    await expect(runtime.save()).rejects.toThrow();
    expect((await db.load(graph.projectId, library)).revision).toBe(0);
    failInside = false;
    await runtime.save();
    expect((await db.load(graph.projectId, library)).revision).toBe(1);
  });

  it("overlapping save calls serialize project revisions in commit order", async () => {
    const { graph, library } = fixture();
    const revisions: number[] = [];
    const db = storage({
      beforeTransaction: async (commit) => {
        revisions.push(commit.revision);
        await Promise.resolve();
      },
    });
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    runtime.dispatch("first", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    const firstSave = runtime.save();
    runtime.dispatch("second", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardB",
        key: "fill",
        write: { kind: "set", value: "blue" },
      },
    ]);
    const secondSave = runtime.save();
    await Promise.all([firstSave, secondSave]);
    expect(revisions).toEqual([1, 2]);
    expect(runtime.durableRevision).toBe(2);
    expect((await db.load(graph.projectId, library)).revision).toBe(2);
  });

  it("aborted transaction is still at old revision after restart, and a fresh writer can resume", async () => {
    const { graph, library } = fixture();
    let fail = true;
    const db = storage({
      afterWritesBeforeCommit: () => {
        if (fail) throw new Error("crash");
      },
    });
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    runtime.dispatch("lost unsaved edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    await expect(runtime.save()).rejects.toThrow();
    const restarted = new CatalogRuntime(
      new CatalogGraph(await db.load(graph.projectId, library), library),
      db,
    );
    expect(restarted.graph.revision).toBe(0);
    fail = false;
    restarted.dispatch("fresh edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "blue" },
      },
    ]);
    await restarted.save();
    expect((await db.load(graph.projectId, library)).revision).toBe(1);
  });

  it("changed records and tombstones persist in one revision without copying unrelated entries", async () => {
    const { graph, library } = fixture();
    const commits: {
      changed: readonly { id: string; json: string }[];
      removedIds: readonly string[];
    }[] = [];
    const db = storage({
      beforeTransaction: (commit) => {
        commits.push(commit);
      },
    });
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    const page = graph.getEntry("project:page:main") as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    runtime.dispatch("delete", [
      { kind: "put", entry: { ...page, children: ["project:node:cardB"] } },
      { kind: "remove", id: "project:node:cardA" },
    ]);
    await runtime.save();
    expect(commits).toHaveLength(1);
    expect(commits[0].changed.map((entry) => entry.id)).toEqual([page.id]);
    expect(commits[0].removedIds).toEqual(["project:node:cardA"]);
    const loaded = await db.load(graph.projectId, library);
    expect(loaded.entries["project:node:cardA"]).toBeUndefined();
    expect(loaded.entries["project:node:cardB"]).toBeDefined();
    expect(loaded.revision).toBe(1);
  });

  it("concurrent tab revision conflict and project switch do not mark wrong project saved", async () => {
    const { graph, library } = fixture();
    const db = storage();
    await db.create(graph.exportDocument(), library);
    const other = new CatalogGraph(
      await db.load(graph.projectId, library),
      library,
    );
    const tabA = new CatalogRuntime(graph, db);
    const tabB = new CatalogRuntime(other, db);
    const op: CatalogOperation = {
      kind: "patchNodeVisual",
      id: "project:node:cardA",
      key: "fill",
      write: { kind: "set", value: "red" },
    };
    tabA.dispatch("A", [op]);
    tabB.dispatch("B", [op]);
    await tabA.save();
    await expect(tabB.save()).rejects.toThrow("REVISION_CONFLICT");
    expect(tabB.durableRevision).toBe(0);
    const secondDoc: CatalogDocument = {
      ...createG1Fixture().document,
      projectId: "project:project:second",
      rootId: "project:project:second",
      entries: {
        ...createG1Fixture().document.entries,
        "project:project:second": {
          ...(graph.getEntry(graph.projectId) as Extract<
            CatalogEntry,
            { kind: "project" }
          >),
          id: "project:project:second",
        },
      },
    };
    delete (secondDoc.entries as Record<string, CatalogEntry>)[graph.projectId];
    const secondGraph = new CatalogGraph(secondDoc, library);
    await db.create(secondDoc, library);
    tabA.addProject(secondGraph);
    tabA.dispatch("A2", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardB",
        key: "fill",
        write: { kind: "set", value: "blue" },
      },
    ]);
    const firstSave = tabA.save();
    tabA.switchProject(secondGraph.projectId);
    expect(tabA.durableRevision).toBe(0);
    tabA.dispatch("B edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardB",
        key: "fill",
        write: { kind: "set", value: "green" },
      },
    ]);
    await tabA.save();
    await firstSave;
    expect(tabA.durableRevision).toBe(1);
    await tabA.save(graph.projectId);
    expect((await db.load(graph.projectId, library)).revision).toBe(2);
    expect((await db.load(secondGraph.projectId, library)).revision).toBe(1);
  });

  it("new JSON/folder exchange roundtrip; old or unsupported format fails visibly", async () => {
    const { graph, library } = fixture();
    expect(importCatalogJson(exportCatalogJson(graph), library)).toEqual(
      graph.exportDocument(),
    );
    expect(
      await importCatalogFolder(await exportCatalogFolder(graph), library),
    ).toEqual(graph.exportDocument());
    expect(() => importCatalogJson('{"pages":[]}', library)).toThrow(
      "UNSUPPORTED_PROJECT_FORMAT",
    );
    await expect(
      importCatalogFolder({ "manifest.json": '{"pages":[]}' }, library),
    ).rejects.toThrow("UNSUPPORTED_PROJECT_FORMAT");
  });

  it("folder writer keeps prior active manifest on interruption and verifies content hashes", async () => {
    const { graph, library } = fixture();
    const files = new Map<string, string>();
    let failAtManifest = false;
    const target = {
      read: async (path: string) => files.get(path) ?? null,
      write: async (path: string, content: string) => {
        if (failAtManifest && path === "manifest.json")
          throw new Error("interrupted");
        files.set(path, content);
      },
    };
    await writeCatalogFolder(target, graph);
    const oldManifest = files.get("manifest.json");
    const runtime = new CatalogRuntime(graph, storage());
    runtime.dispatch("edit", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    failAtManifest = true;
    await expect(writeCatalogFolder(target, graph)).rejects.toThrow(
      "interrupted",
    );
    expect(files.get("manifest.json")).toBe(oldManifest);
    failAtManifest = false;
    await writeCatalogFolder(target, graph);
    expect(
      (await importCatalogFolder(Object.fromEntries(files), library)).revision,
    ).toBe(1);
    const manifest = JSON.parse(files.get("manifest.json")!) as {
      paths: Record<string, string>;
    };
    const path = manifest.paths["project:node:cardA"];
    files.set(path, "corrupt");
    await expect(
      importCatalogFolder(Object.fromEntries(files), library),
    ).rejects.toThrow("CORRUPT_CATALOG_ENTRY");
  });
});
