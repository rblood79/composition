import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3: the pruned re-resolution follows only the owned child on the target path.
 * Every consumer record after the edit equals a fresh full resolution of the same graph, and
 * only the edited instance is notified.
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

function documentOf(roots: NodeEntry[], nested: NodeEntry[]): CatalogDocument {
  const projectId = "project:project:pruned" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "pruned",
      pageIds: [pageId],
      definitionIds: [],
      overrideIds: [],
      themeIds: [],
      tokenIds: [],
      stateVariableIds: [],
      interactionIds: [],
      assetIds: [],
    },
    [pageId]: {
      kind: "page",
      id: pageId,
      name: "Main",
      route: "/",
      children: roots.map((entry) => entry.id),
    },
  };
  for (const entry of [...roots, ...nested]) entries[entry.id] = entry;
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 23,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
}

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
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find((input) => input.sourceId === sourceId)
      ?.id;
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

const metricsOf = (root: CatalogCompositionRoot) => ({
  resolverVisits: root.metrics.resolverVisits,
  resolverIncludeChecks: root.metrics.resolverIncludeChecks,
  layoutInputVisits: root.metrics.layoutInputVisits,
  canvasNotifies: root.metrics.canvasInputUpdates,
  domNotifies: root.metrics.domInputUpdates,
});
const records: Record<string, unknown> = {};

describe("ADR-248 Phase 3 pruned re-resolution follows the owned path", () => {
  it("5k owned Text leaves: one include check, equal to a fresh resolution", () => {
    const size = 5000;
    const leaves = Array.from({ length: size }, (_, index) =>
      node(`leaf${index}`, "lib:definition:text", {
        props: { children: { kind: "set", value: `leaf ${index}` } },
      }),
    );
    const frame = node("frame", "lib:definition:frame", {
      children: leaves.map((leaf) => leaf.id),
    });
    const scene = open(
      documentOf([frame], leaves),
      createPencilFixtureLibrary(),
      "5k",
    );
    scene.watch();
    const edited = leaves[size / 2].id;
    scene.root.dispatch("edit leaf", [
      {
        kind: "patchNodeProp",
        id: edited,
        key: "children",
        write: { kind: "set", value: "edited" },
      },
    ]);
    const editedId = scene.inputId(edited)!;
    records["5k-owned-leaf"] = metricsOf(scene.root);
    expect(metricsOf(scene.root)).toEqual({
      resolverVisits: 2,
      resolverIncludeChecks: 1,
      layoutInputVisits: 1,
      canvasNotifies: 1,
      domNotifies: 1,
    });
    expect(scene.notified).toEqual([editedId, editedId]);
    expect(scene.root.canvasInputs.get(editedId)?.props.children).toBe(
      "edited",
    );
    scene.expectEqualsFresh();
  });

  it("nested owned chain Frame > Group > Text: one check per owned hop", () => {
    const t1 = node("t1", "lib:definition:text");
    const t2 = node("t2", "lib:definition:text");
    const group = node("group", "lib:definition:group", {
      children: [t1.id, t2.id],
    });
    const other = node("other", "lib:definition:text");
    const frame = node("frame", "lib:definition:frame", {
      children: [group.id, other.id],
    });
    const scene = open(
      documentOf([frame], [group, t1, t2, other]),
      createPencilFixtureLibrary(),
      "nested",
    );
    scene.watch();
    scene.root.dispatch("edit t2", [
      {
        kind: "patchNodeProp",
        id: t2.id,
        key: "children",
        write: { kind: "set", value: "edited" },
      },
    ]);
    records["nested-owned"] = metricsOf(scene.root);
    expect(metricsOf(scene.root)).toMatchObject({
      resolverVisits: 3,
      resolverIncludeChecks: 2,
      canvasNotifies: 1,
      domNotifies: 1,
    });
    expect(new Set(scene.notified)).toEqual(new Set([scene.inputId(t2.id)]));
    scene.expectEqualsFresh();
  });

  it("composite template + fillSlot child keeps the template/slot include path", () => {
    const { document, library } = createG1Fixture();
    const scene = open(document, library, "fill-slot");
    const fill: NodeEntry = node("slotFill", "lib:definition:text", {
      props: { children: { kind: "set", value: "filled" } },
    });
    scene.root.dispatch("fill slot", [
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
    scene.watch();
    scene.root.dispatch("edit fill", [
      {
        kind: "patchNodeProp",
        id: fill.id,
        key: "children",
        write: { kind: "set", value: "edited" },
      },
    ]);
    records["fill-slot"] = metricsOf(scene.root);
    expect(metricsOf(scene.root)).toMatchObject({
      canvasNotifies: 1,
      domNotifies: 1,
    });
    expect(new Set(scene.notified)).toEqual(new Set([scene.inputId(fill.id)]));
    expect(
      scene.root.canvasInputs.get(scene.inputId(fill.id)!)?.props.children,
    ).toBe("edited");
    scene.expectEqualsFresh();
  });

  it("records the counts", () => {
    console.info("[adr248-pruned-resolve]", JSON.stringify(records));
  });
});
