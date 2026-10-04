import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  moveNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { bindCatalogCanvas } from "../canvasBinding";
import { CatalogCanvasScene } from "../canvasScene";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 G5 (§6.2): a leaf edit on a large page reads geometry and measures text for the
 * affected set only. Live 5k (`scripts/adr248-g5-live.mjs`) found two reads that grew with the
 * page: the text re-wrap took every record under the edited record's parent as a candidate, and
 * the Canvas geometry region compared every sibling of a resized absolutely placed box. Sibling
 * boxes that can change (a flex parent, a parent whose rect changed) are still re-read: the
 * results equal a workspace built fresh from the edited document.
 */
const set = <T>(value: T) => ({ kind: "set" as const, value });
const BODY = "project:node:home-body" as NodeEntry["id"];

/** 10px per character; words break at spaces (the text-behavior test's measure). */
function countingMeasure() {
  const calls = { count: 0 };
  const measure: CatalogTextMeasure = (text, font, maxWidth) => {
    calls.count++;
    const line = font.fontSize * font.lineHeight;
    const words = text.split(" ");
    if (maxWidth === undefined)
      return {
        width: text.length * 10,
        exactWidth: text.length * 10,
        minWidth: Math.max(...words.map((word) => word.length)) * 10,
        height: line,
      };
    const perLine = Math.max(1, Math.floor(maxWidth / 10));
    let lines = 1;
    let used = 0;
    for (const word of words) {
      const need = used ? used + 1 + word.length : word.length;
      if (need <= perLine) used = need;
      else if (used) {
        lines += 1;
        used = word.length;
      } else used = word.length;
    }
    return { width: maxWidth, height: lines * line };
  };
  return { measure, calls };
}

/** The engine with its geometry reads counted (handles requested). */
function countingEngine(engine: LayoutEngineAPI) {
  const reads = { handles: 0 };
  const getLayoutsBatch = engine.getLayoutsBatch.bind(engine);
  engine.getLayoutsBatch = (handles) => {
    reads.handles += handles.length;
    return getLayoutsBatch(handles);
  };
  return { engine, reads };
}

const text = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeEntry["id"],
  definitionId: "TEXT" as NodeEntry["definitionId"],
  children: [],
  props: { children: set(`Seed ${id}`) },
  visual: { fontSize: set(14) },
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
const frame = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeEntry["id"],
  definitionId: "FRAME" as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

async function workspaceWith(
  entries: NodeEntry[],
  rootIds: string[],
  measure: CatalogTextMeasure,
  engine?: LayoutEngineAPI,
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:g5" as const,
        name: "G5",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-g5-leaf-${Math.random()}`),
    {
      engine: engine ?? (await nodeLayoutEngine()),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  // The fixture's TEXT / FRAME stand for the palette's definitions in the code library.
  const library = workspace.runtime.graph.library;
  const definition = {
    TEXT: catalogPaletteDefinitionId(library, "Text"),
    FRAME: catalogPaletteDefinitionId(library, "frame"),
  } as Record<string, NodeEntry["definitionId"]>;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: entries.map((entry) => ({
        ...entry,
        definitionId: definition[entry.definitionId] ?? entry.definitionId,
      })),
      rootIds: rootIds.map((id) => `project:node:${id}` as NodeEntry["id"]),
      newId: workspace.newId,
    }),
  );
  return workspace;
}

/** Geometry and text input of every node, keyed by source ID. */
function snapshot(workspace: CatalogWorkspace) {
  const root = workspace.root;
  const out: Record<string, unknown> = {};
  for (const record of root.canvasInputs.values()) {
    const rect = root.getGeometry([record.id]).get(record.id);
    out[record.sourceId] = {
      rect: rect && [rect.x, rect.y, rect.width, rect.height],
      contentHeight: root.getLayoutInput(record.id)?.contentHeight,
    };
  }
  return out;
}

async function freshSnapshot(workspace: CatalogWorkspace) {
  const fresh = new CatalogWorkspace(
    new CatalogGraph(
      workspace.runtime.graph.exportDocument(),
      workspace.runtime.graph.library,
    ),
    new CatalogStorage(indexedDB, `adr248-g5-fresh-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: countingMeasure().measure,
    },
  );
  return snapshot(fresh);
}

describe("ADR-248 G5 leaf edit scope on a large page", () => {
  it("paint-only edits skip layout and sibling rewrap, while width edits still compute", async () => {
    const { measure, calls } = countingMeasure();
    const engine = await nodeLayoutEngine();
    let computes = 0;
    const compute = engine.computeLayout.bind(engine);
    engine.computeLayout = (...args) => {
      computes++;
      return compute(...args);
    };
    const workspace = await workspaceWith(
      [
        frame("row", {
          children: ["project:node:a", "project:node:b"],
          layout: { display: set("flex") },
          sizing: { width: set(400) },
        }),
        text("a"),
        text("b"),
      ],
      ["row"],
      measure,
      engine,
    );
    const scene = new CatalogCanvasScene(workspace.root);
    computes = 0;
    calls.count = 0;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:a" }],
        visual: { color: set("#ff0000") },
      }),
    );
    expect(computes).toBe(0);
    expect(scene.sync().kind).toBe("patched");
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
    workspace.undo();
    expect(computes).toBe(0);
    scene.sync();
    workspace.redo();
    expect(computes).toBe(0);
    scene.sync();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:a" }],
        sizing: { width: set(180) },
      }),
    );
    expect(computes).toBeGreaterThan(0);
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
    scene.dispose();
  });

  it("reorder/delete among 5k siblings plan only the parent and patch its subtree, including undo", async () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `leaf${i}`);
    const workspace = await workspaceWith(
      ids.map((id) =>
        frame(id, {
          sizing: { width: set(20), height: set(20) },
          placement: { kind: "absolute", x: 20, y: 20 },
        }),
      ),
      ids,
      countingMeasure().measure,
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const sync = () => {
      const result = scene.sync();
      expect(result.kind).toBe("patched");
      if (result.kind === "patched")
        expect(result.update.geometryQueries).toBeLessThanOrEqual(5003);
    };
    const target = "project:node:leaf0" as NodeEntry["id"];
    workspace.execute(
      moveNodes({
        ids: [target],
        parent: { kind: "node", id: BODY },
        newId: workspace.newId,
      }),
    );
    expect(workspace.root.metrics.layoutInputVisits).toBe(1);
    sync();
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: target }] }),
    );
    expect(workspace.root.metrics.layoutInputVisits).toBe(1);
    sync();
    workspace.undo();
    sync();
    workspace.undo();
    sync();
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
    const fresh = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    expect(Array.from(scene.stream.commands)).toEqual(
      Array.from(fresh.stream.commands),
    );
    expect(scene.stream.boundsMap).toEqual(fresh.stream.boundsMap);
    fresh.dispose();
    scene.dispose();
  });
  it("re-wraps and re-reads only the edited box among 300 absolutely placed leaves", async () => {
    const { measure, calls } = countingMeasure();
    const { engine, reads } = countingEngine(await nodeLayoutEngine());
    const ids = Array.from({ length: 300 }, (_, i) => `leaf${i}`);
    const workspace = await workspaceWith(
      ids.map((id, i) =>
        (i % 2 ? frame : text)(id, {
          sizing: { width: set(160), height: set(60) },
          placement: {
            kind: "absolute",
            x: 20 + (i % 6) * 200,
            y: 20 + Math.floor(i / 6) * 90,
          },
        }),
      ),
      ids,
      measure,
      engine,
    );
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );

    calls.count = 0;
    reads.handles = 0;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:leaf0" }],
        props: { children: set("Edited") },
      }),
    );
    const textEdit = { measures: calls.count, geometryReads: reads.handles };
    expect(canvas.update()).toMatchObject({ status: "patched" });

    calls.count = 0;
    reads.handles = 0;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:leaf0" }],
        sizing: { width: set(172) },
      }),
    );
    const widthEdit = { measures: calls.count, geometryReads: reads.handles };
    const resize = canvas.update();
    expect(resize).toMatchObject({ status: "patched" });

    // Was 150 measures / 150 reads (every text under the body) and 300 sibling rects compared.
    expect(textEdit.measures).toBeLessThanOrEqual(4);
    expect(textEdit.geometryReads).toBeLessThanOrEqual(4);
    expect(widthEdit.measures).toBeLessThanOrEqual(4);
    expect(widthEdit.geometryReads).toBeLessThanOrEqual(4);
    if (resize.status !== "patched") throw new Error("unreachable");
    expect(resize.geometryQueries).toBeLessThanOrEqual(3);
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
    // The patched Canvas stream equals a fresh bind of the same root.
    const fresh = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    expect(Array.from(canvas.stream.commands)).toEqual(
      Array.from(fresh.stream.commands),
    );
    expect(canvas.stream.boundsMap).toEqual(fresh.stream.boundsMap);
    fresh.dispose();
    canvas.dispose();
  });

  it.each(["flex", "grid"] as const)(
    "preserves %s flow geometry after reorder/delete and undo",
    async (display) => {
      const ids = Array.from({ length: 80 }, (_, i) => `flow${i}`);
      const workspace = await workspaceWith(
        [
          frame("container", {
            children: ids.map((id) => `project:node:${id}` as NodeEntry["id"]),
            layout: { display: set(display) },
            sizing: { width: set(400) },
          }),
          ...ids.map((id, i) =>
            frame(id, {
              sizing: { width: set(20 + (i % 7)), height: set(20 + (i % 9)) },
            }),
          ),
        ],
        ["container"],
        countingMeasure().measure,
      );
      const scene = new CatalogCanvasScene(workspace.root);
      const check = async () => {
        scene.sync();
        expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
        const fresh = bindCatalogCanvas(
          workspace.root,
          workspace.root.pageRootRecords(),
        );
        expect(Array.from(scene.stream.commands)).toEqual(
          Array.from(fresh.stream.commands),
        );
        expect(scene.stream.boundsMap).toEqual(fresh.stream.boundsMap);
        fresh.dispose();
      };
      workspace.execute(
        moveNodes({
          ids: ["project:node:flow0"],
          parent: { kind: "node", id: "project:node:container" },
          newId: workspace.newId,
        }),
      );
      await check();
      workspace.execute(
        removeTargets({
          targets: [{ kind: "node", id: "project:node:flow1" }],
        }),
      );
      await check();
      workspace.undo();
      await check();
      workspace.undo();
      await check();
      scene.dispose();
      workspace.dispose();
    },
  );

  it("keeps re-reading flex siblings: a resized item re-wraps the growing items", async () => {
    const { measure } = countingMeasure();
    const words = "aaaa bbbb cccc dddd eeee ffff gggg";
    const workspace = await workspaceWith(
      [
        frame("row", {
          children: [
            "project:node:a",
            "project:node:b",
            "project:node:c",
          ] as NodeEntry["id"][],
          layout: { display: set("flex"), flexDirection: set("row") },
          sizing: { width: set(400) },
        }),
        text("a", {
          props: { children: set(words) },
          sizing: { width: set(100) },
        }),
        text("b", {
          props: { children: set(words) },
          fillSizing: { width: { factor: 1 } },
        }),
        text("c", {
          props: { children: set(words) },
          fillSizing: { width: { factor: 1 } },
        }),
      ],
      ["row"],
      measure,
    );
    const before = snapshot(workspace);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:a" }],
        sizing: { width: set(300) },
      }),
    );
    const after = snapshot(workspace);
    // The growing siblings lost width and wrap to more lines.
    expect(after["project:node:b"]).not.toEqual(before["project:node:b"]);
    expect(after).toEqual(await freshSnapshot(workspace));
  });

  it("insert and reparent resolve only the affected branch, preserving unrelated records and Canvas spans", async () => {
    const unrelated = Array.from({ length: 1000 }, (_, i) => `untouched${i}`);
    const workspace = await workspaceWith(
      [
        frame("left", {
          children: ["project:node:a"],
          sizing: { width: set(200), height: set(200) },
        }),
        frame("right", { sizing: { width: set(200), height: set(200) } }),
        text("a"),
        frame("unrelated", {
          children: unrelated.map(
            (id) => `project:node:${id}` as NodeEntry["id"],
          ),
        }),
        ...unrelated.map((id) => text(id)),
      ],
      ["left", "right", "unrelated"],
      countingMeasure().measure,
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const untouchedId = workspace.root.recordsOfSource(
      "project:node:untouched0",
    )[0];
    const untouchedRecord = workspace.root.canvasInputs.get(untouchedId);
    let notified = 0;
    workspace.root.subscribeCanvas(untouchedId, () => notified++);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:right" },
        entries: [
          text("b", {
            definitionId: catalogPaletteDefinitionId(
              workspace.runtime.graph.library,
              "Text",
            ),
          }),
        ],
        rootIds: ["project:node:b"],
        newId: workspace.newId,
      }),
    );
    expect(workspace.root.metrics.resolverVisits).toBeLessThan(10);
    expect(scene.sync().kind).toBe("patched");
    workspace.execute(
      moveNodes({
        ids: ["project:node:a"],
        parent: { kind: "node", id: "project:node:right" },
        newId: workspace.newId,
      }),
    );
    expect(workspace.root.metrics.resolverVisits).toBeLessThan(15);
    expect(scene.sync().kind).toBe("patched");
    expect(notified).toBe(0);
    expect(workspace.root.canvasInputs.get(untouchedId)).toBe(untouchedRecord);
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
    const fresh = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    expect(Array.from(scene.stream.commands)).toEqual(
      Array.from(fresh.stream.commands),
    );
    expect(scene.stream.boundsMap).toEqual(fresh.stream.boundsMap);
    fresh.dispose();
    scene.dispose();
  });

  it("a failed structural layout restores graph, consumer indexes and the existing scene before retry", async () => {
    const engine = await nodeLayoutEngine();
    const compute = engine.computeLayout.bind(engine);
    let fail = false;
    engine.computeLayout = (...args) => {
      if (fail) {
        fail = false;
        throw new Error("structural layout failure");
      }
      return compute(...args);
    };
    const workspace = await workspaceWith(
      [text("a"), text("b")],
      ["a", "b"],
      countingMeasure().measure,
      engine,
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const document = workspace.runtime.graph.exportDocument();
    const before = snapshot(workspace);
    const remove = () =>
      workspace.execute(
        removeTargets({ targets: [{ kind: "node", id: "project:node:a" }] }),
      );
    fail = true;
    expect(remove).toThrow();
    expect(workspace.runtime.graph.exportDocument()).toEqual(document);
    expect(snapshot(workspace)).toEqual(before);
    expect(scene.sync().kind).toBe("unchanged");
    remove();
    expect(scene.sync().kind).toBe("patched");
    workspace.undo();
    expect(scene.sync().kind).toBe("patched");
    expect(snapshot(workspace)).toEqual(before);
    scene.dispose();
  });

  it("keeps in-flow block siblings exact when one leaf's text changes", async () => {
    const { measure } = countingMeasure();
    const words = "aaaa bbbb cccc dddd eeee ffff gggg";
    const workspace = await workspaceWith(
      [
        frame("column", {
          children: ["project:node:a", "project:node:b"] as NodeEntry["id"][],
          sizing: { width: set(120) },
        }),
        text("a", { props: { children: set(words) } }),
        text("b", { props: { children: set(words) } }),
      ],
      ["column"],
      measure,
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:a" }],
        props: { children: set(`${words} hhhh iiii`) },
      }),
    );
    expect(snapshot(workspace)).toEqual(await freshSnapshot(workspace));
  });
});
