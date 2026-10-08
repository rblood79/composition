import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page as browserPage } from "vitest/browser";

import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import * as spatialIndex from "@/builder/workspace/canvas/wasm-bindings/spatialIndex";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";

/**
 * ADR-248 Phase 3: a layout edit's changed geometry reaches the product Canvas binding locally
 * (engine rects compared along the ancestor path, subtree splice), and the DOM binding follows
 * through browser layout without React notifications to the moved siblings.
 */
const RESULT_FILE = "../../docs/adr/design/248-phase3-geometry-delta.json"; // Vitest root = apps/builder
const results: unknown[] = [];
let css: HTMLStyleElement;
beforeAll(async () => {
  await initEngineWasm();
  spatialIndex.initSpatialIndex();
  css = document.createElement("style");
  css.textContent = `${bundleCss}\n@font-face { font-family: Pretendard; src: url('/fonts/PretendardVariable.ttf'); font-style: normal; font-weight: 100 900; }`;
  document.head.append(css);
  await document.fonts.load("16px Pretendard");
});
afterAll(async () => {
  css.remove();
  await commands.writeFile(
    RESULT_FILE,
    `${JSON.stringify({ adr: 248, phase: 3, check: "layout-edit-geometry-delta", cases: results }, null, 2)}\n`,
  );
});

const frames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeEntry["id"],
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
const text = (id: string, label: string) =>
  node(id, "lib:definition:text", {
    props: { children: { kind: "set", value: label } },
    sizing: {
      width: { kind: "set", value: 80 },
      height: { kind: "set", value: 20 },
    },
  });

function scene(name: string, frameSized: boolean) {
  const a = text("a", "A");
  const b = text("b", "B");
  const t1 = text("t1", "One");
  const t2 = text("t2", "Two");
  const t3 = text("t3", "Three");
  const group = node("group", "lib:definition:group", {
    children: [t1.id, t2.id, t3.id],
    props: { orientation: { kind: "set", value: "horizontal" } },
  });
  const frame = node("frame", "lib:definition:frame", {
    children: [a.id, b.id, group.id],
    visual: { fill: { kind: "set", value: "#ffffff" } },
    sizing: frameSized
      ? {
          width: { kind: "set", value: 600 },
          height: { kind: "set", value: 300 },
        }
      : {},
  });
  const projectId = "project:project:geometrydelta" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "geometry delta",
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
      children: [frame.id],
    },
  };
  for (const entry of [frame, a, b, group, t1, t2, t3])
    entries[entry.id] = entry;
  const catalog: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 21,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const root = new CatalogCompositionRoot(
    new CatalogRuntime(
      new CatalogGraph(catalog, createPencilFixtureLibrary()),
      new CatalogStorage(indexedDB, `adr248-geometry-delta-${name}`),
    ),
    createLayoutEngine(),
    { width: 1440, height: 900 },
  );
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find(
      (input) => input.sourceId === sourceId,
    )!.id;
  return {
    root,
    ids: {
      frame: inputId(frame.id),
      a: inputId(a.id),
      b: inputId(b.id),
      group: inputId(group.id),
      t1: inputId(t1.id),
      t2: inputId(t2.id),
      t3: inputId(t3.id),
    },
    source: { a: a.id, t1: t1.id },
  };
}

type Stream = ReturnType<typeof bindCatalogCanvas>["stream"];
/** Spatial index as hit-test answers: whole scene and each hit box center. */
function spatialSnapshot(stream: Stream) {
  const centers: Record<string, string[]> = {};
  for (const [id, box] of stream.hitBoundsMap)
    centers[id] = spatialIndex
      .hitTestPoint(box.x + box.width / 2, box.y + box.height / 2)
      .sort();
  return {
    scene: spatialIndex.queryRect(0, 0, 1440, 900).sort(),
    centers,
  };
}
function canvasSnapshot(stream: Stream) {
  return {
    commands: JSON.parse(JSON.stringify(Array.from(stream.commands))),
    bounds: Object.fromEntries(stream.boundsMap),
    hitBounds: Object.fromEntries(stream.hitBoundsMap),
    spatial: spatialSnapshot(stream),
  };
}

async function runCase(
  name: string,
  target: "a" | "t1",
  frameSized = true,
  key: "width" | "height" = "width",
) {
  await browserPage.viewport(1440, 900);
  spatialIndex.clearAll();
  const { root, ids, source } = scene(name, frameSized);
  const canvas = bindCatalogCanvas(root, [ids.frame]);
  const host = document.createElement("div");
  host.style.cssText =
    "position:relative;width:1440px;height:900px;display:flex;font-family:Pretendard,sans-serif";
  document.body.append(host);
  const reactRoot = createRoot(host);
  const renders: string[] = [];
  // Commit and subscribe before the edit: a DOM notify counts delivered notifications, and a
  // subscription made after the edit catches up through the snapshot check instead (notify 0).
  await act(async () => {
    reactRoot.render(
      renderCatalogDom(root, ids.frame, {
        onNodeRender: (id) => renders.push(id),
      }),
    );
  });
  await frames();
  const initial = {
    canvasRegistered: canvas.stream.boundsMap.size,
    canvasCommands: canvas.stream.commands.length,
    domNodeRenders: renders.length,
  };
  const before = Object.fromEntries(
    Object.entries(ids).map(([key, id]) => [
      key,
      canvas.stream.boundsMap.get(id),
    ]),
  );
  renders.length = 0;
  root.dispatch(`resize ${target} ${key}`, [
    {
      kind: "patchNodeSizing",
      id: source[target],
      key,
      write: { kind: "set", value: key === "width" ? 120 : 40 },
    },
  ]);
  const notifies = {
    canvas: root.metrics.canvasInputUpdates,
    dom: root.metrics.domInputUpdates,
  };
  const update = canvas.update();
  await frames();
  const after = Object.fromEntries(
    Object.entries(ids).map(([key, id]) => [
      key,
      canvas.stream.boundsMap.get(id),
    ]),
  );
  const hostBox = host.getBoundingClientRect();
  const dom = Object.fromEntries(
    Object.entries(ids).map(([key, id]) => {
      const box = host
        .querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)!
        .getBoundingClientRect();
      return [
        key,
        {
          x: box.x - hostBox.x,
          y: box.y - hostBox.y,
          width: box.width,
          height: box.height,
        },
      ];
    }),
  );
  const moved = Object.keys(ids).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const patched = canvasSnapshot(canvas.stream);
  // The rebuild starts from an empty index: equality must not come from the shared global index.
  spatialIndex.clearAll();
  const fresh = bindCatalogCanvas(root, [ids.frame]);
  const rebuilt = canvasSnapshot(fresh.stream);
  const result = {
    name,
    initial,
    edit: {
      notifies,
      canvas: update,
      domNodeRenders: [...renders],
      moved,
    },
    before,
    after,
    dom,
  };
  results.push(result);
  fresh.dispose();
  canvas.dispose();
  reactRoot.unmount();
  host.remove();
  return { result, ids, patched, rebuilt };
}

describe("ADR-248 Phase 3 layout edit geometry delta", () => {
  it("case 1: Text width 80→120 changes only its own box", async () => {
    const { result, ids, patched, rebuilt } = await runCase("self", "a");
    expect(result.edit.moved).toEqual(["a"]);
    expect(result.edit.notifies).toEqual({ canvas: 1, dom: 1 });
    expect(result.edit.canvas).toMatchObject({
      status: "patched",
      rebound: [ids.a],
      geometryChanged: [ids.a],
      // Block-flow Frame with an unchanged rect: only A and the Frame are read (was 4 with B and
      // the Group).
      geometryQueries: 2,
      patchRoots: [ids.a],
      subtreeBuilds: 1,
      subtreeNodeVisits: 1,
    });
    expect(result.edit.domNodeRenders).toEqual([ids.a]);
    expect(result.after.a).toMatchObject({ width: 120 });
    // DOM browser layout lands where the Canvas scene put every node.
    for (const key of Object.keys(ids))
      expect(result.dom[key], key).toEqual(
        expect.objectContaining({
          x: result.after[key]!.x,
          y: result.after[key]!.y,
          width: result.after[key]!.width,
          height: result.after[key]!.height,
        }),
      );
    expect(patched.spatial.scene).toHaveLength(Object.keys(ids).length);
    expect(patched).toEqual(rebuilt);
  });

  it("case 2: Text width in a horizontal Group moves its siblings", async () => {
    const { result, ids, patched, rebuilt } = await runCase("siblings", "t1");
    expect(result.edit.moved).toEqual(["t1", "t2", "t3"]);
    expect(result.after.t2!.x - result.before.t2!.x).toBe(40);
    expect(result.after.t3!.x - result.before.t3!.x).toBe(40);
    expect(result.edit.notifies).toEqual({ canvas: 1, dom: 1 });
    expect(result.edit.canvas).toMatchObject({
      status: "patched",
      geometryChanged: [ids.t1, ids.t2, ids.t3],
      // Flex row Group: siblings are read (they move).
      geometryQueries: 4,
      patchRoots: [ids.group],
      subtreeBuilds: 1,
      subtreeNodeVisits: 4,
    });
    // Moved siblings are re-registered for Canvas, but get no React notification: the browser
    // moves them by layout.
    expect(result.edit.domNodeRenders).toEqual([ids.t1]);
    for (const key of Object.keys(ids))
      expect(result.dom[key], key).toEqual(
        expect.objectContaining({
          x: result.after[key]!.x,
          y: result.after[key]!.y,
          width: result.after[key]!.width,
          height: result.after[key]!.height,
        }),
      );
    expect(patched.spatial.scene).toHaveLength(Object.keys(ids).length);
    expect(patched).toEqual(rebuilt);
  });

  it("block flow: a height change moves the following siblings, which are read", async () => {
    const { result, ids, patched, rebuilt } = await runCase(
      "block-height",
      "a",
      true,
      "height",
    );
    expect(result.edit.moved).toEqual(["a", "b", "group", "t1", "t2", "t3"]);
    expect(result.after.b!.y - result.before.b!.y).toBe(20);
    expect(result.edit.canvas).toMatchObject({
      status: "patched",
      geometryChanged: [ids.a, ids.b, ids.group],
      // A, the Frame, then siblings B and Group (height changed → no block-flow shortcut).
      geometryQueries: 4,
      patchRoots: [ids.frame],
    });
    expect(result.edit.domNodeRenders).toEqual([ids.a]);
    for (const key of Object.keys(ids))
      expect(result.dom[key], key).toEqual(
        expect.objectContaining({
          x: result.after[key]!.x,
          y: result.after[key]!.y,
          width: result.after[key]!.width,
          height: result.after[key]!.height,
        }),
      );
    expect(patched.spatial.scene).toHaveLength(Object.keys(ids).length);
    expect(patched).toEqual(rebuilt);
  });

  it("an auto-size scene root that grows returns rebind-required", async () => {
    const { result, ids } = await runCase("scene-root", "t1", false);
    expect(result.edit.canvas).toEqual({
      status: "rebind-required",
      id: ids.frame,
      reason: "geometry-reaches-scene-root",
    });
  });
});
