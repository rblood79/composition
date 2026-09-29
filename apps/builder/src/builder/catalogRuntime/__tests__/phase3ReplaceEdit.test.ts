import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import type {
  CatalogDocument,
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3: a node placed by a `replace` descendant override (template root or template
 * child) is editable through the selective re-resolution; edit/undo/redo keep graph revision,
 * history, pending saves and the root's Canvas/DOM inputs in step with a freshly built root.
 */
class CountLayoutEngine implements LayoutEngineAPI {
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
    throw new Error("not used");
  }
  createNodeRaw() {
    return this.next++;
  }
  updateStyleRaw() {}
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {}
  getLayoutsBatch() {
    return new Map();
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}

const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

function open(
  document: CatalogDocument,
  library: CatalogLibrary,
  name: string,
) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr248-pruned-${name}`),
  );
  const root = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
    width: 1440,
    height: 900,
  });
  const notified: string[] = [];
  const watch = () => {
    for (const id of root.canvasInputs.keys()) {
      root.subscribeCanvas(id, () => notified.push(id));
      root.subscribeDom(id, () => notified.push(id));
    }
  };
  // A replaced template root belongs to its instance's record (a composite instance is its root).
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find(
      (input) =>
        input.sourceId === sourceId ||
        input.collapsedSourceIds?.includes(sourceId),
    )?.id;
  /** Fresh full resolution of the same graph through a second composition root. */
  const expectEqualsFresh = () => {
    const fresh = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
      width: 1440,
      height: 900,
    });
    expect(new Map(root.canvasInputs)).toEqual(new Map(fresh.canvasInputs));
  };
  return {
    root,
    watch,
    inputId,
    notified,
    expectEqualsFresh,
  };
}


describe("ADR-248 Phase 3 replace-placed node edits", () => {
  it.each([
    ["template root", ["lib:template:cardRoot"]],
    ["template child", ["lib:template:cardRoot", "lib:template:cardText"]],
  ] as const)("replace of the %s: edit, undo, redo", (name, templatePath) => {
    const { document, library } = createG1Fixture();
    const scene = open(document, library, `replace-${name.replace(" ", "-")}`);
    const runtime = scene.root.runtime;
    const replacement = node(`rep${templatePath.length}`, "lib:definition:text", {
      props: { children: { kind: "set", value: "rep" } },
    });
    scene.root.dispatch("replace", [
      { kind: "put", entry: replacement },
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "replace",
          address: {
            instances: ["project:node:cardA"],
            templatePath: [...templatePath],
          },
          replacementId: replacement.id,
        },
      },
    ]);
    const repId = scene.inputId(replacement.id)!;
    expect(repId).toBeDefined();
    scene.watch();
    const state = () => ({
      graphRevision: runtime.graph.revision,
      rootRevision: scene.root.metrics.revision,
      history: runtime.historyDepth,
      pending: runtime.pendingCount,
      children: scene.root.canvasInputs.get(repId)?.props.children,
      domChildren: scene.root.domInputs.get(repId)?.props.children,
    });

    scene.root.dispatch("edit replacement", [
      {
        kind: "patchNodeProp",
        id: replacement.id,
        key: "children",
        write: { kind: "set", value: "edited" },
      },
    ]);
    expect(state()).toEqual({
      graphRevision: 2,
      rootRevision: 2,
      history: { undo: 2, redo: 0 },
      pending: 2,
      children: "edited",
      domChildren: "edited",
    });
    expect(scene.notified).toEqual([repId, repId]);
    // Selective: the replacement instance only, through owner → (template path) → replacement.
    expect(scene.root.metrics).toMatchObject({
      layoutInputVisits: 1,
      affectedInstanceCount: 1,
      traversedWholeInputGraph: false,
    });
    console.info(
      "[adr248-replace-edit]",
      name,
      JSON.stringify({
        inputs: scene.root.canvasInputs.size,
        resolverVisits: scene.root.metrics.resolverVisits,
        resolverIncludeChecks: scene.root.metrics.resolverIncludeChecks,
      }),
    );
    scene.expectEqualsFresh();

    scene.notified.length = 0;
    scene.root.undo();
    expect(state()).toEqual({
      graphRevision: 3,
      rootRevision: 3,
      history: { undo: 1, redo: 1 },
      pending: 3,
      children: "rep",
      domChildren: "rep",
    });
    expect(scene.notified).toEqual([repId, repId]);
    scene.expectEqualsFresh();

    scene.notified.length = 0;
    scene.root.redo();
    expect(state()).toEqual({
      graphRevision: 4,
      rootRevision: 4,
      history: { undo: 2, redo: 0 },
      pending: 4,
      children: "edited",
      domChildren: "edited",
    });
    expect(scene.notified).toEqual([repId, repId]);
    scene.expectEqualsFresh();
  });
});
