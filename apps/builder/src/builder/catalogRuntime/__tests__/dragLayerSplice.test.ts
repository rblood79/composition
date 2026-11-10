import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setDragVisualOffset } from "../../workspace/canvas/skia/nodeRendererTree";
import type { RenderCommandStream } from "../../workspace/canvas/skia/renderCommands";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * CANVAS_PERF_SCALING_2026-11 B3: a drag moves its subtrees to the stream's top layer and back by a
 * splice (`dragLayerSplice.ts`). Oracle: the stream a full build gives for the same drag state —
 * commands in order and every map. And the splice visits only the dragged subtrees.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const node = (
  name: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${name}` as NodeId,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});
const text = (name: string) =>
  node(name, "lib:definition:text", {
    props: { children: set(`Text ${name}`) },
  });
const frame = (
  name: string,
  children: string[],
  extra: Partial<NodeEntry> = {},
) =>
  node(name, "lib:definition:type-frame", {
    children: children.map((child) => `project:node:${child}` as NodeId),
    sizing: { height: set(120) },
    ...extra,
  });

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:drag-layer" as EntryId<"project">,
        name: "Drag layer",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `drag-layer-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let next = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame("a", ["t1", "t2", "t3"], {
          visual: { paddingTop: set(10), paddingLeft: set(20), gap: set(4) },
        }),
        text("t1"),
        text("t2"),
        text("t3"),
        text("t4"),
        frame("b", ["t5", "c"], {
          visual: { overflow: set("hidden"), paddingTop: set(30) },
          sizing: { height: set(40) },
        }),
        text("t5"),
        frame("c", ["t6"]),
        text("t6"),
        frame("d", ["t7"]),
        node("t7", "lib:definition:type-frame", {
          layout: {
            position: set("fixed"),
            insetLeft: set("0px"),
            insetBottom: set("0px"),
          },
          sizing: { width: set(80), height: set(20) },
        }),
      ],
      rootIds: [
        "project:node:a" as NodeId,
        "project:node:t4" as NodeId,
        "project:node:b" as NodeId,
        "project:node:d" as NodeId,
      ],
      newId: <K extends EntryKind>(kind: K) =>
        `project:${kind}:d${++next}` as EntryId<K>,
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  scene.sync();
  const recordOf = (name: string) =>
    workspace.root.recordsOfSource(`project:node:${name}`)[0]!;
  return { workspace, scene, recordOf };
}

/** Every field of the stream: commands in order, maps and sets by key (insertion order differs). */
function snapshot(stream: RenderCommandStream) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stream)) {
    if (key.startsWith("presentationRevision")) continue;
    if (key === "commands")
      out[key] = Array.from({ length: stream.commands.length }, (_, i) => ({
        ...stream.commands[i]!,
      }));
    else if (value instanceof Map)
      out[key] = [...value.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    else if (value instanceof Set) out[key] = [...value].sort();
    else out[key] = value;
  }
  return out;
}

function visits(run: () => void): number {
  const debug = window.__composition_COMMIT_LANE_DEBUG__!;
  const before = debug.snapshot().totalVisits;
  run();
  return debug.snapshot().totalVisits - before;
}

afterEach(() => {
  setDragVisualOffset(null, 0, 0, true);
});

describe("drag layer splice (B3)", () => {
  it.each([
    ["a middle child", ["t2"]],
    ["a last child (anchored at its parent's end)", ["t3"]],
    ["adjacent siblings", ["t1", "t2"]],
    ["a container with its children", ["a"]],
    ["a child of a clipping container (unclipped on the top layer)", ["t5"]],
    ["roots under different parents", ["t4", "t1"]],
    [
      "a nested container and a root inside another dragged root",
      ["c", "t6", "b"],
    ],
  ])("enter and exit give the full build's stream — %s", async (_, names) => {
    const { workspace, scene, recordOf } = await open();
    try {
      const ids = new Set(names.map(recordOf));
      const size = (id: string) => {
        const span = scene.stream.subtreeSpans.get(id)!;
        let count = 0;
        for (let i = span.start; i < span.end; i += 1)
          if (scene.stream.commands[i]!.type === 0) count += 1;
        return count;
      };
      const dragged = [...ids].reduce((sum, id) => sum + size(id), 0);
      const total = scene.stream.subtreeSpans.size;

      setDragVisualOffset(ids, 12, 16, true);
      const enterVisits = visits(() =>
        expect(scene.refreshPresentation({ holdImages: true }).kind).toBe(
          "presented",
        ),
      );
      const spliced = snapshot(scene.stream);
      scene.rebuild();
      expect(spliced).toEqual(snapshot(scene.stream));
      // Visits only what it records (nested dragged ids are inside the outer one).
      expect(enterVisits).toBeLessThanOrEqual(dragged);
      expect(enterVisits).toBeLessThan(total);

      // Exit from a spliced enter (the rebuild above replaced the stream — enter again).
      setDragVisualOffset(null, 0, 0, true);
      scene.rebuild();
      const resting = snapshot(scene.stream);
      setDragVisualOffset(ids, 12, 16, true);
      scene.refreshPresentation({ holdImages: true });
      setDragVisualOffset(null, 0, 0, true);
      const exitVisits = visits(() => scene.refreshPresentation());
      expect(snapshot(scene.stream)).toEqual(resting);
      expect(exitVisits).toBeLessThan(total);
      // Again — the segments a splice leaves keep the spans exact.
      setDragVisualOffset(ids, 12, 16, true);
      scene.refreshPresentation({ holdImages: true });
      setDragVisualOffset(null, 0, 0, true);
      scene.refreshPresentation();
      expect(snapshot(scene.stream)).toEqual(resting);
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });

  it("a subtree with a fixed descendant (drawn at the page's level) is built in full", async () => {
    const { workspace, scene, recordOf } = await open();
    try {
      const total = scene.stream.subtreeSpans.size;
      setDragVisualOffset(new Set([recordOf("d")]), 12, 16, true);
      expect(
        visits(() => scene.refreshPresentation({ holdImages: true })),
      ).toBeGreaterThanOrEqual(total);
      const built = snapshot(scene.stream);
      scene.rebuild();
      expect(built).toEqual(snapshot(scene.stream));
      setDragVisualOffset(null, 0, 0, true);
      scene.refreshPresentation();
      const after = snapshot(scene.stream);
      scene.rebuild();
      expect(after).toEqual(snapshot(scene.stream));
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });

  it("an edit after the drag patches the spliced stream (no bind again)", async () => {
    const { workspace, scene, recordOf } = await open();
    try {
      setDragVisualOffset(new Set([recordOf("t2")]), 12, 16, true);
      scene.refreshPresentation({ holdImages: true });
      setDragVisualOffset(null, 0, 0, true);
      scene.refreshPresentation();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:t2" as NodeId }],
          props: { children: set("Edited") },
        }),
      );
      const result = scene.sync();
      expect(result.kind === "rebound" ? result.reason : result.kind).toBe(
        "patched",
      );
      const patched = snapshot(scene.stream);
      scene.rebuild();
      expect(patched).toEqual(snapshot(scene.stream));
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });

  it("an edit after a drag that was built in full patches too (the patch revision follows)", async () => {
    const { workspace, scene, recordOf } = await open();
    try {
      setDragVisualOffset(new Set([recordOf("d")]), 12, 16, true);
      scene.refreshPresentation({ holdImages: true });
      setDragVisualOffset(null, 0, 0, true);
      scene.refreshPresentation();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:t1" as NodeId }],
          props: { children: set("Edited") },
        }),
      );
      const result = scene.sync();
      expect(result.kind === "rebound" ? result.reason : result.kind).toBe(
        "patched",
      );
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });
});
