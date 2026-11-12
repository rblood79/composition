import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setDragVisualOffset } from "../../workspace/canvas/skia/nodeRendererTree";
import {
  commandBufferSegmentCount,
  createCommandReader,
  type RenderCommandStream,
} from "../../workspace/canvas/skia/renderCommands";
import { CANVAS_BUFFER_PIECE_LIMIT, CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-246 ratchet 조사 (2026-11-12) — a drag's splice leaves the command buffer in two more
 * pieces and nothing joined them until the scene was bound again (20 drags that change nothing
 * over 30 nodes: 32 pieces — every index read and span cursor walks the pieces). Past
 * `CANVAS_BUFFER_PIECE_LIMIT` the scene joins them (`compactFragmented` — the fill's `compact`,
 * VS Code's "normalization step"); the Canvas asks on every frame outside a gesture and a fill.
 */
const BODY = "project:node:home-body" as NodeId;
const NAMES = Array.from({ length: 30 }, (_, index) => `t${index}`);
const text = (name: string): NodeEntry =>
  ({
    kind: "node",
    id: `project:node:${name}`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: name } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:piece-limit" as EntryId<"project">,
        name: "Piece limit",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `piece-limit-${Math.random()}`),
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
      entries: NAMES.map(text),
      rootIds: NAMES.map((name) => `project:node:${name}` as NodeId),
      newId: <K extends EntryKind>(kind: K) =>
        `project:${kind}:d${++next}` as EntryId<K>,
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  scene.sync();
  const drag = (index: number) => {
    const record = workspace.root.recordsOfSource(
      `project:node:${NAMES[index]}`,
    )[0]!;
    setDragVisualOffset(new Set([record]), 12, 16, true);
    scene.refreshPresentation({ holdImages: true });
    setDragVisualOffset(null, 0, 0, true);
    scene.refreshPresentation();
  };
  return { workspace, scene, drag };
}

const pieces = (scene: CatalogCanvasScene) =>
  commandBufferSegmentCount(scene.stream.commands);
function drawn(stream: RenderCommandStream) {
  const at = createCommandReader(stream.commands);
  return {
    commands: Array.from({ length: stream.commands.length }, (_, i) => at(i)),
    subtree: [...stream.subtreeSpans.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  };
}

describe("command buffer — pieces past the limit are joined", () => {
  it("drags leave pieces; past the limit a join keeps the stream and makes it one piece", async () => {
    const { workspace, scene, drag } = await open();
    try {
      expect(scene.compactFragmented()).toBe(false);
      let peak = 0;
      for (let turn = 0; turn < 20; turn += 1) {
        drag((turn * 7) % NAMES.length);
        peak = Math.max(peak, pieces(scene));
        // (The Canvas asks every frame, outside a gesture and a fill.)
        const before = drawn(scene.stream);
        if (scene.compactFragmented()) {
          expect(pieces(scene)).toBe(1);
          expect(drawn(scene.stream)).toEqual(before);
        } else
          expect(pieces(scene)).toBeLessThanOrEqual(CANVAS_BUFFER_PIECE_LIMIT);
      }
      // (A drag adds two pieces — the peak is the limit and one drag over it.)
      expect(peak).toBeGreaterThan(CANVAS_BUFFER_PIECE_LIMIT);
      expect(peak).toBeLessThanOrEqual(CANVAS_BUFFER_PIECE_LIMIT + 2);
      // The joined stream is the one a bind gives.
      const joined = drawn(scene.stream);
      scene.rebuild();
      expect(joined).toEqual(drawn(scene.stream));
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });
});
