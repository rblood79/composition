import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { renderCatalogDom } from "../domBinding";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3: a Text leaf edit reaches the product Canvas/DOM bindings as a per-ID delta.
 * Initial bind cost and edit cost are counted separately on a 5k-leaf document.
 */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type RawLayout = {
  buildTreeBatch(input: string): Uint32Array;
  createNodeRaw(input: string): number;
  updateStyleRaw(handle: number, input: string): boolean;
  setChildren(handle: number, children: Uint32Array): boolean;
  markDirty(handle: number): boolean;
  removeNode(handle: number): boolean;
  setViewport(width: number, height: number): void;
  computeLayout(handle: number, width: number, height: number): void;
  getLayout(handle: number): string;
  clear(): void;
  nodeCount(): number;
};

async function layoutEngine(): Promise<LayoutEngineAPI> {
  const directory = resolve(
    process.cwd(),
    "src/builder/workspace/canvas/wasm-bindings/engine-pkg",
  );
  const glue = (await import(
    pathToFileURL(join(directory, "engine_bg.js")).href
  )) as {
    __wbg_set_wasm(value: WebAssembly.Exports): void;
    LayoutEngine: new () => RawLayout;
  };
  const instance = await WebAssembly.instantiate(
    readFileSync(join(directory, "engine_bg.wasm")),
    { "./engine_bg.js": glue },
  );
  glue.__wbg_set_wasm(instance.instance.exports);
  const raw = new glue.LayoutEngine();
  return {
    isAvailable: () => true,
    hasBinaryProtocol: () => false,
    buildTreeBatch: (input) => [...raw.buildTreeBatch(input)],
    buildTreeBatchBinary: () => {
      throw new Error("JSON harness only");
    },
    createNodeRaw: (input) => raw.createNodeRaw(input),
    updateStyleRaw: (handle, input) => raw.updateStyleRaw(handle, input),
    setChildren: (handle, children) =>
      raw.setChildren(handle, Uint32Array.from(children)),
    markDirty: (handle) => raw.markDirty(handle),
    removeNode: (handle) => raw.removeNode(handle),
    setViewport: (width, height) => raw.setViewport(width, height),
    computeLayout: (handle, width, height) =>
      raw.computeLayout(handle, width, height),
    getLayoutsBatch: (handles) =>
      new Map(
        handles.map((handle) => [handle, JSON.parse(raw.getLayout(handle))]),
      ),
    clear: () => raw.clear(),
    nodeCount: () => raw.nodeCount(),
  };
}

async function makeScene(size: number) {
  const projectId = "project:project:bindingdelta" as const;
  const pageId = "project:page:main" as const;
  const containerId = "project:node:container" as NodeEntry["id"];
  const leaves = Array.from(
    { length: size },
    (_, index) => `project:node:leaf${index}` as NodeEntry["id"],
  );
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "binding delta",
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
      children: [containerId],
    },
    [containerId]: {
      kind: "node",
      id: containerId,
      definitionId: "lib:definition:frame",
      children: leaves,
      props: {},
      visual: { fill: { kind: "set", value: "#ffffff" } },
      // Fixed width: a leaf resize stays inside the container (an auto-width container would
      // grow with its widest leaf and escalate to the scene root → rebind-required).
      sizing: { width: { kind: "set", value: 1440 } },
      descendantOverrides: [],
    },
  };
  for (const [index, id] of leaves.entries())
    entries[id] = {
      kind: "node",
      id,
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: `leaf ${index}` } },
      visual: {},
      sizing: {
        width: { kind: "set", value: 80 },
        height: { kind: "set", value: 20 },
      },
      descendantOverrides: [],
    };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 1,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const graph = new CatalogGraph(document, createPencilFixtureLibrary());
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr248-phase3-binding-delta-${size}`),
  );
  const root = new CatalogCompositionRoot(runtime, await layoutEngine(), {
    width: 1440,
    height: 900,
  });
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find((node) => node.sourceId === sourceId)!
      .id;
  return { root, containerId: inputId(containerId), leaves, inputId };
}

describe("ADR-248 Phase 3 product binding leaf delta", () => {
  it("a Text leaf prop edit re-derives one Canvas node and re-renders one DOM node on 5k leaves", async () => {
    const size = 5000;
    const { root, containerId, leaves, inputId } = await makeScene(size);
    const edited = leaves[size / 2];
    const editedId = inputId(edited);

    // Initial bind: full walk is allowed and counted.
    const canvas = bindCatalogCanvas(root, [containerId]);
    const initialCommands = canvas.stream.commands.length;
    const renders: string[] = [];
    const host = document.createElement("div");
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(
        renderCatalogDom(root, containerId, {
          onNodeRender: (id) => renders.push(id),
        }),
      ),
    );
    const initial = {
      inputs: root.canvasInputs.size,
      canvasRegistered: canvas.stream.boundsMap.size,
      canvasCommands: initialCommands,
      domNodeRenders: renders.length,
    };
    expect(initial).toEqual({
      inputs: size + 1,
      canvasRegistered: size + 1,
      canvasCommands: initialCommands,
      domNodeRenders: size + 1,
    });

    // Edit: one Text leaf's content.
    renders.length = 0;
    await act(async () => {
      root.dispatch("edit one text leaf", [
        {
          kind: "patchNodeProp",
          id: edited,
          key: "children",
          write: { kind: "set", value: "edited" },
        },
      ]);
    });
    const update = canvas.update();
    const edit = {
      changedIds: root.metrics.changedIds,
      resolverVisits: root.metrics.resolverVisits,
      // The pruned re-resolution follows only the owned child on the path (was 5,000 checks).
      resolverIncludeChecks: root.metrics.resolverIncludeChecks,
      layoutInputVisits: root.metrics.layoutInputVisits,
      canvasNotifies: root.metrics.canvasInputUpdates,
      domNotifies: root.metrics.domInputUpdates,
      traversedWholeInputGraph: root.metrics.traversedWholeInputGraph,
      canvas: update,
      domNodeRenders: [...renders],
    };
    expect(edit).toEqual({
      changedIds: [edited],
      resolverVisits: 2,
      resolverIncludeChecks: 1,
      layoutInputVisits: 1,
      canvasNotifies: 1,
      domNotifies: 1,
      traversedWholeInputGraph: false,
      canvas: {
        status: "patched",
        rebound: [editedId],
        geometryChanged: [],
        geometryQueries: 1,
        patchRoots: [editedId],
        subtreeBuilds: 1,
        subtreeNodeVisits: 1,
        commandWrites: expect.any(Number),
      },
      domNodeRenders: [editedId],
    });
    if (update.status !== "patched") throw new Error("unreachable");
    expect(update.commandWrites).toBeLessThan(initialCommands / 100);

    // The patched stream equals a fresh full build from the same registry and layout.
    const text = getSkiaNode(editedId);
    expect(text?.text?.content).toBe("edited");
    const fresh = bindCatalogCanvas(root, [containerId]);
    expect(Array.from(canvas.stream.commands)).toEqual(
      Array.from(fresh.stream.commands),
    );
    expect(canvas.stream.boundsMap).toEqual(fresh.stream.boundsMap);
    fresh.dispose();
    expect(canvas.stream.commands.length).toBe(initialCommands);
    expect(
      host.querySelector(`[data-catalog-id="${editedId}"]`)?.textContent,
    ).toBe("edited");
    const unrelated = host.querySelector(
      `[data-catalog-id="${inputId(leaves[size - 1])}"]`,
    );
    expect(unrelated?.textContent).toBe(`leaf ${size - 1}`);

    // A size edit is patched in place. The container is block flow with an unchanged rect and
    // the leaf's height is unchanged, so no sibling rect is read (was 1 + 4,999 + 1 = 5,001).
    await act(async () => {
      root.dispatch("resize one text leaf", [
        {
          kind: "patchNodeSizing",
          id: edited,
          key: "width",
          write: { kind: "set", value: 120 },
        },
      ]);
    });
    const resize = canvas.update();
    expect(resize).toEqual({
      status: "patched",
      rebound: [editedId],
      geometryChanged: [editedId],
      geometryQueries: 2,
      patchRoots: [editedId],
      subtreeBuilds: 1,
      subtreeNodeVisits: 1,
      commandWrites: 3,
    });
    const freshAfterResize = bindCatalogCanvas(root, [containerId]);
    expect(Array.from(canvas.stream.commands)).toEqual(
      Array.from(freshAfterResize.stream.commands),
    );
    expect(canvas.stream.boundsMap).toEqual(freshAfterResize.stream.boundsMap);
    expect(canvas.stream.hitBoundsMap).toEqual(
      freshAfterResize.stream.hitBoundsMap,
    );
    freshAfterResize.dispose();
    console.info(
      "[adr248-binding-delta]",
      JSON.stringify({ size, initial, edit, resize }),
    );
    await act(async () => reactRoot.unmount());
    canvas.dispose();
  }, 60_000);

  it("keeps the geometry climb's premise: no typed layout places a box by a baseline", async () => {
    // `canvasBinding` climbs to siblings only when a box changes size. A size-invariant edit can
    // still move siblings where placement follows a baseline — a flex/grid baseline group or an
    // atomic inline in a block line box, whose baseline a container synthesizes from its content
    // (padding swap at a fixed height). Instances author no layout (`NodeEntry` has none), so the
    // libraries decide: none declares either. Adding one needs a baseline-aware climb first.
    const offenders: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (
          key === "display" &&
          typeof child === "string" &&
          child.startsWith("inline")
        )
          offenders.push(`${path}.${key}=${child}`);
        if (
          /^(align|justify)(Items|Self|Content)$/.test(key) &&
          typeof child === "string" &&
          child.includes("baseline")
        )
          offenders.push(`${path}.${key}=${child}`);
        visit(child, `${path}.${key}`);
      }
    };
    visit(await buildCodeCatalogLibrary(), "code");
    visit(createPencilFixtureLibrary(), "fixture");
    expect(offenders).toEqual([]);
  });
});
