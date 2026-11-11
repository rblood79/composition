import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { CatalogCanvasScene } from "../canvasScene";
import {
  commandBufferSegmentCount,
  createCommandReader,
} from "../../workspace/canvas/skia/renderCommands";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  authorStagedFixture,
  buildStagedRoot,
  stagedGraph,
  stagedNodeId,
} from "./support/stagedLoadFixture";

/**
 * ADR-307 G3 — the Canvas scene follows a staged root by patches: a fill task never binds the
 * whole scene again (a page that holds a fixed box or an overlay is recorded again as a page), and
 * the patched stream is the one a fresh bind of the same records gives.
 */
const round = (value: number) => Math.round(value * 100) / 100;
function signature(scene: CatalogCanvasScene) {
  const { stream } = scene;
  const boxes = (
    map: ReadonlyMap<
      string,
      { x: number; y: number; width: number; height: number }
    >,
  ) =>
    [...map]
      .map(([id, box]) => [
        id,
        [box.x, box.y, box.width, box.height].map(round),
      ])
      .sort(([a], [b]) => String(a).localeCompare(String(b)));
  const at = createCommandReader(stream.commands);
  const commands: string[] = [];
  for (let index = 0; index < stream.commands.length; index++) {
    const command = at(index) as unknown as Record<string, unknown>;
    const numbers = ["x", "y", "width", "height"]
      .map((key) =>
        typeof command[key] === "number" ? round(command[key] as number) : "",
      )
      .join(",");
    commands.push(
      `${command.type}:${command.elementId ?? command.ownerId ?? ""}:${numbers}:${command.unscrollOwnerId ?? ""}`,
    );
  }
  return {
    bounds: boxes(stream.boundsMap),
    hit: boxes(stream.hitBoundsMap),
    commands,
    topLayer: [...stream.topLayerElementIds].sort(),
  };
}

describe("ADR-307 staged load on the Canvas scene (G3)", () => {
  beforeAll(async () => {
    await authorStagedFixture();
  }, 60_000);

  for (const unitLimit of [75, 3])
    it(`fill tasks patch the scene, unit limit ${unitLimit}: no full bind, the stream of a fresh bind`, async () => {
      const root = await buildStagedRoot({ unitLimit });
      const scene = new CatalogCanvasScene(root);
      const kinds = new Map<string, number>();
      for (const rootId of root.pendingFillRoots())
        for (;;) {
          let units = 0;
          const report = root.fill(rootId, { deadline: () => ++units >= 2 });
          expect(report.errors).toEqual([]);
          const sync = scene.sync() as { kind: string; reason?: string };
          const key = sync.reason ? `${sync.kind}:${sync.reason}` : sync.kind;
          kinds.set(key, (kinds.get(key) ?? 0) + 1);
          if (report.status !== "partial") break;
        }
      expect([...kinds.keys()].filter((kind) => kind !== "patched")).toEqual(
        [],
      );
      const patched = signature(scene);
      // The fixture holds fixed boxes and overlays (the grid's Select · the positioned page).
      expect(patched.topLayer.length).toBeGreaterThan(0);
      // The page-by-page patches leave the buffer in pieces: joined, the stream is the same and
      // goes on taking patches.
      expect(commandBufferSegmentCount(scene.stream.commands)).toBeGreaterThan(
        1,
      );
      expect(scene.compact()).toBe(true);
      expect(commandBufferSegmentCount(scene.stream.commands)).toBe(1);
      expect(signature(scene)).toEqual(patched);
      expect(scene.compact()).toBe(false);
      // An edit after the join is patched as before (the spans' cursors were made again).
      const graph = stagedGraph(root);
      const body = graph.getEntry(stagedNodeId("flex-body"));
      const column = body?.kind === "node" ? body.children[0] : undefined;
      root.execute(
        setFields({
          targets: [{ kind: "node", id: column! }],
          visual: { gap: { kind: "set", value: 40 } },
        }),
      );
      expect((scene.sync() as { kind: string }).kind).toBe("patched");
      const edited = signature(scene);
      scene.rebuild();
      expect(edited).toEqual(signature(scene));
      root.undo();
      scene.sync();
      scene.rebuild();
      expect(patched).toEqual(signature(scene));
      // … and it is the batch build's scene.
      const batch = new CatalogCanvasScene(await buildStagedRoot());
      expect(patched).toEqual(signature(batch));
    });
});
