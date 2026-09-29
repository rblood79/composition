import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../workspace/canvas/wasm-bindings/engine";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { CatalogCompositionRoot } from "../compositionRoot";

class RecordingLayoutEngine implements LayoutEngineAPI {
  styles: string[] = [];
  computed = 0;
  batches: number[][] = [];
  private next = 1;
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    return (JSON.parse(json) as unknown[]).map(() => this.next++);
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("binary protocol disabled in test");
  }
  createNodeRaw(json: string) {
    this.styles.push(json);
    return this.next++;
  }
  updateStyleRaw(_handle: number, json: string) {
    this.styles.push(json);
  }
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {
    this.computed++;
  }
  getLayoutsBatch(handles: number[]): Map<number, LayoutResult> {
    this.batches.push([...handles]);
    return new Map(
      handles.map((id) => [id, { x: id, y: 0, width: 100, height: 20 }]),
    );
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}

function setup() {
  const { document, library } = createG1Fixture();
  const graph = new CatalogGraph(document, library);
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr248-phase3-root-${Math.random()}`),
  );
  const engine = new RecordingLayoutEngine();
  const root = new CatalogCompositionRoot(runtime, engine, {
    width: 1440,
    height: 900,
  });
  const inputId = (sourceId: string) =>
    [...root.layoutInputs.values()].find((value) => value.sourceId === sourceId)
      ?.id;
  return { graph, runtime, root, engine, inputId };
}

describe("ADR-248 Phase 3 isolated composition root delta seam", () => {
  it("sends typed node placement to the layout input and only invalidates its instance", () => {
    const { root, engine, inputId } = setup();
    const first = inputId("project:node:cardA")!;
    const second = inputId("project:node:cardB")!;
    let unrelated = 0;
    root.subscribeCanvas(second, () => unrelated++);
    root.subscribeDom(second, () => unrelated++);
    const result = root.dispatch("move child", [
      {
        kind: "setNodePlacement",
        id: "project:node:cardA",
        placement: { kind: "absolute", x: 20, y: 150 },
      },
    ]);
    expect(result.changedIds).toEqual(new Set(["project:node:cardA"]));
    expect(root.layoutInputs.get(first)?.placement).toEqual({
      kind: "absolute",
      x: 20,
      y: 150,
    });
    expect(engine.styles.at(-1)).toContain('"insetLeft":"20px"');
    expect(engine.styles.at(-1)).toContain('"insetTop":"150px"');
    expect(root.metrics.layoutInputVisits).toBe(1);
    expect(unrelated).toBe(0);
    root.undo();
    expect(root.layoutInputs.get(first)?.placement).toBeUndefined();
    expect(unrelated).toBe(0);
  });
  it("replays G0 leaf scenario public commands and refreshes new-format semantic input", async () => {
    const old = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "../../docs/adr/design/248-baseline/leaf-value/baseline.json",
        ),
        "utf8",
      ),
    ) as {
      scenario: {
        id: string;
        viewport: { width: number; height: number };
        operations: Array<{ op: string; id?: string; text?: string }>;
      };
      after: { element: { text: string } };
    };
    expect(old.scenario.id).toBe("adr248-old-leaf-value-v1");
    const { document, library } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const fresh = {
      ...document,
      entries: {
        [document.projectId]: project,
        [page.id]: { ...page, children: [] },
      },
    };
    const graph = new CatalogGraph(fresh, library);
    const db = new CatalogStorage(
      indexedDB,
      `adr248-phase3-leaf-${Math.random()}`,
    );
    await db.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, db);
    const root = new CatalogCompositionRoot(
      runtime,
      new RecordingLayoutEngine(),
      old.scenario.viewport,
    );
    const insert = old.scenario.operations[0];
    const leafId = `project:node:${insert.id}` as NodeEntry["id"];
    root.dispatch("insert Text", [
      {
        kind: "put",
        entry: {
          kind: "node",
          id: leafId,
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: insert.text! } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      },
      { kind: "put", entry: { ...page, children: [leafId] } },
    ]);
    const edit = old.scenario.operations[1];
    root.dispatch("setText", [
      {
        kind: "patchNodeProp",
        id: leafId,
        key: "children",
        write: { kind: "set", value: edit.text! },
      },
    ]);
    expect(root.metrics.layoutInputVisits).toBe(1);
    expect(root.metrics.resolverVisits).toBe(1);
    expect(root.metrics.traversedWholeInputGraph).toBe(true); // one-node fixture
    await runtime.save();
    const reloaded = new CatalogGraph(
      await db.load(graph.projectId, library),
      library,
    );
    const refreshed = new CatalogCompositionRoot(
      new CatalogRuntime(reloaded, db),
      new RecordingLayoutEngine(),
      old.scenario.viewport,
    );
    const leaf = [...refreshed.layoutInputs.values()].find(
      (input) => input.sourceId === leafId,
    );
    expect(leaf?.props.children).toBe(old.after.element.text);
    expect((reloaded.getEntry(page.id) as typeof page).children).toEqual([
      leafId,
    ]);
    expect(reloaded.revision).toBe(2);
  });

  it("leaf transaction revision/delta update only affected layout and Canvas/DOM inputs", () => {
    const { root, engine, inputId, graph } = setup();
    const first = inputId("project:node:cardA")!;
    const second = inputId("project:node:cardB")!;
    let firstCanvas = 0;
    let firstDom = 0;
    let unrelated = 0;
    root.subscribeCanvas(first, () => firstCanvas++);
    root.subscribeDom(first, () => firstDom++);
    root.subscribeCanvas(second, () => unrelated++);
    const initialVisits = root.layoutInputs.size;
    const exportDocument = graph.exportDocument;
    graph.exportDocument = () => {
      throw new Error("leaf path must not export whole graph");
    };
    const result = root.dispatch("fill", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    graph.exportDocument = exportDocument;
    expect(root.metrics.revision).toBe(result.revision);
    expect(root.metrics.changedIds).toEqual(["project:node:cardA"]);
    expect(root.metrics.removedIds).toEqual([]);
    expect(root.metrics.affectedRootIds).toEqual(["project:node:cardA"]);
    expect(root.metrics.layoutInputVisits).toBeLessThan(initialVisits);
    expect(root.metrics.traversedWholeInputGraph).toBe(false);
    expect([firstCanvas, firstDom, unrelated]).toEqual([1, 1, 0]);
    expect(root.canvasInputs.get(first)?.visual.fill).toBe("red");
    expect(root.domInputs.get(first)?.visual.fill).toBe("red");
    root.dispatch("width", [
      {
        kind: "patchNodeSizing",
        id: "project:node:cardA",
        key: "width",
        write: { kind: "set", value: 120 },
      },
    ]);
    expect(
      engine.styles.some((style) => style.includes('"width":"120px"')),
    ).toBe(true);
    expect(engine.computed).toBe(3); // cold + two targeted edits
  });

  it("updates one input in a multi-node single root on a leaf edit", () => {
    const { document, library } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const entries = { ...document.entries };
    delete entries["project:node:cardB"];
    entries[page.id] = { ...page, children: ["project:node:cardA"] };
    const graph = new CatalogGraph(
      {
        ...document,
        entries,
      },
      library,
    );
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, `adr248-phase3-scan-${Math.random()}`),
      ),
      new RecordingLayoutEngine(),
      { width: 1440, height: 900 },
    );
    const before = root.layoutInputs.size;
    expect(before).toBeGreaterThan(1);
    root.dispatch("one leaf", [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: { kind: "set", value: "red" },
      },
    ]);
    expect(root.metrics.layoutInputVisits).toBe(1);
    // The instance record is its template root: the composite layer and the root it collapses
    // into are resolved (constant per edit, independent of the tree size).
    expect(root.metrics.resolverVisits).toBe(2);
    expect(root.metrics.affectedInstanceCount).toBe(1);
    expect(root.metrics.traversedWholeInputGraph).toBe(false);
    expect(before).toBeGreaterThan(root.metrics.layoutInputVisits);
  });

  it("definition and token fan-out reach actual instances, while unrelated root remains untouched", () => {
    const { root, graph, inputId } = setup();
    const a = inputId("project:node:cardA")!;
    const b = inputId("project:node:cardB")!;
    const project = graph.getEntry(graph.projectId) as Extract<
      CatalogEntry,
      { kind: "project" }
    >;
    root.dispatch("add token", [
      {
        kind: "put",
        entry: {
          kind: "token",
          id: "project:token:accent",
          name: "Accent",
          tokenType: "color",
          value: "red",
          source: "user-defined",
        },
      },
      {
        kind: "put",
        entry: { ...project, tokenIds: ["project:token:accent"] },
      },
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "fill",
        write: {
          kind: "set",
          value: { kind: "token", tokenId: "project:token:accent" },
        },
      },
    ]);
    let aHits = 0;
    let bHits = 0;
    root.subscribeCanvas(a, () => aHits++);
    root.subscribeCanvas(b, () => bHits++);
    const token = graph.getEntry("project:token:accent") as Extract<
      CatalogEntry,
      { kind: "token" }
    >;
    root.dispatch("token value", [
      { kind: "put", entry: { ...token, value: "blue" } },
    ]);
    expect(root.metrics.affectedRootIds).toEqual(["project:node:cardA"]);
    expect([aHits, bHits]).toEqual([1, 0]);
    expect(root.canvasInputs.get(a)?.visual.fill).toBe("blue");
  });

  it("owner-child edit, remove tombstone and undo/redo update input graph", () => {
    const { root, graph, inputId } = setup();
    const owner = graph.getEntry("project:node:cardA") as NodeEntry;
    const child: NodeEntry = {
      kind: "node",
      id: "project:node:child",
      definitionId: "lib:definition:text",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    root.dispatch("add child", [
      { kind: "put", entry: child },
      { kind: "put", entry: { ...owner, children: [child.id] } },
    ]);
    const childInput = inputId(child.id);
    expect(childInput).toBeDefined();
    root.dispatch("child fill", [
      {
        kind: "patchNodeVisual",
        id: child.id,
        key: "fill",
        write: { kind: "set", value: "green" },
      },
    ]);
    expect(root.metrics.affectedRootIds).toEqual([owner.id]);
    expect(root.canvasInputs.get(childInput!)?.visual.fill).toBe("green");
    root.dispatch("remove child", [
      {
        kind: "put",
        entry: { ...(graph.getEntry(owner.id) as NodeEntry), children: [] },
      },
      { kind: "remove", id: child.id },
    ]);
    expect(root.metrics.removedIds).toEqual([child.id]);
    expect(root.metrics.affectedRootIds).toEqual([owner.id]);
    expect(root.layoutInputs.has(childInput!)).toBe(false);
    root.undo();
    expect(root.layoutInputs.has(childInput!)).toBe(true);
    root.redo();
    expect(root.layoutInputs.has(childInput!)).toBe(false);
  });

  it("nested template patch and slot fill stay within one instance and undo/redo", () => {
    const { root, inputId } = setup();
    const aText = [...root.layoutInputs.values()].find(
      (input) =>
        input.id.startsWith("project:node:cardA::") &&
        input.sourceId === "lib:template:cardText",
    );
    const bText = [...root.layoutInputs.values()].find(
      (input) =>
        input.id.startsWith("project:node:cardB::") &&
        input.sourceId === "lib:template:cardText",
    );
    expect(aText).toBeDefined();
    expect(bText).toBeDefined();
    let relevant = 0;
    let unrelated = 0;
    root.subscribeCanvas(aText!.id, () => relevant++);
    root.subscribeCanvas(bText!.id, () => unrelated++);
    root.dispatch("nested text patch", [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address: {
            instances: ["project:node:cardA"],
            templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
          },
          props: { children: { kind: "set", value: "changed" } },
        },
      },
    ]);
    expect(root.canvasInputs.get(aText!.id)?.props.children).toBe("changed");
    expect(root.canvasInputs.get(bText!.id)?.props.children).toBe("title");
    expect([relevant, unrelated]).toEqual([1, 0]);
    const fill: NodeEntry = {
      kind: "node",
      id: "project:node:slotFill",
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "filled" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    root.dispatch("fill slot", [
      { kind: "put", entry: fill },
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "fillSlot",
          address: {
            instances: ["project:node:cardA"],
            templatePath: ["lib:template:cardRoot", "lib:template:cardSlot"],
          },
          childIds: [fill.id],
        },
      },
    ]);
    expect(inputId(fill.id)).toBeDefined();
    expect(root.metrics.affectedRootIds).toEqual(["project:node:cardA"]);
    expect(unrelated).toBe(0);
    root.undo();
    expect(inputId(fill.id)).toBeUndefined();
    root.redo();
    expect(inputId(fill.id)).toBeDefined();
  });

  it("owner child reorder changes parent order without notifying child or another root", () => {
    const { root, graph, inputId } = setup();
    const owner = graph.getEntry("project:node:cardA") as NodeEntry;
    const makeChild = (id: NodeEntry["id"]): NodeEntry => ({
      kind: "node",
      id,
      definitionId: "lib:definition:text",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const first = makeChild("project:node:reorderFirst");
    const second = makeChild("project:node:reorderSecond");
    root.dispatch("add reorder children", [
      { kind: "put", entry: first },
      { kind: "put", entry: second },
      { kind: "put", entry: { ...owner, children: [first.id, second.id] } },
    ]);
    const childInput = inputId(first.id)!;
    const unrelatedInput = inputId("project:node:cardB")!;
    let childHits = 0;
    let unrelatedHits = 0;
    root.subscribeCanvas(childInput, () => childHits++);
    root.subscribeCanvas(unrelatedInput, () => unrelatedHits++);
    root.dispatch("reorder", [
      {
        kind: "put",
        entry: {
          ...(graph.getEntry(owner.id) as NodeEntry),
          children: [second.id, first.id],
        },
      },
    ]);
    expect(
      root.canvasInputs.get(inputId(owner.id)!)?.children.slice(-2),
    ).toEqual([inputId(second.id), inputId(first.id)]);
    expect([childHits, unrelatedHits]).toEqual([0, 0]);
    root.undo();
    expect(
      root.canvasInputs.get(inputId(owner.id)!)?.children.slice(-2),
    ).toEqual([inputId(first.id), inputId(second.id)]);
  });
});
