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
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e: overflow on the catalog Canvas binding — every overflow but `visible` clips
 * (a rule-backed node too), a scroll/auto box carries its scrollbar, and an edit that changes the
 * scroll range redraws the box's scrollbar through the patch path.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const sized = (
  name: string,
  definitionId: string,
  width: number,
  height: number,
  children: NodeId[] = [],
  visual: NodeEntry["visual"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual,
  sizing: {
    width: { kind: "set", value: width },
    height: { kind: "set", value: height },
  },
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:o${++next}` as EntryId<K>;
};

async function open(overflow: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:overflow" as EntryId<"project">,
        name: "Overflow",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-overflow-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        sized("box", "lib:definition:type-frame", 200, 100, [id("tall")], {
          overflow: { kind: "set", value: overflow },
        }),
        sized("tall", "lib:definition:type-frame", 150, 300),
        sized("list", "lib:definition:type-ListBox", 200, 120),
      ],
      rootIds: [id("box"), id("list")],
      newId: allocator(),
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  return { workspace, scene, record };
}

/** The box's children-end command, which draws its scrollbar (only that command carries one). */
const childrenEnd = (
  scene: CatalogCanvasScene,
  record: string,
): { scrollbar?: unknown } | undefined =>
  (
    scene.stream.commands as unknown as Array<{
      scrollbarNode?: { elementId: string };
      scrollbar?: unknown;
    }>
  ).find((cmd) => cmd.scrollbarNode?.elementId === record);

describe("ADR-248 Phase 4e catalog Canvas overflow binding", () => {
  it("clips for clip / scroll / auto as for hidden, and not for visible", async () => {
    for (const overflow of ["hidden", "clip", "scroll", "auto", "visible"]) {
      const { record } = await open(overflow);
      expect([overflow, getSkiaNode(record("box"))?.clipChildren]).toEqual([
        overflow,
        overflow !== "visible",
      ]);
    }
  });

  it("clips a rule-backed node by its definition's overflow (ListBox)", async () => {
    const { workspace, record } = await open("visible");
    const overflow = workspace.root.canvasInputs.get(record("list"))?.visual
      .overflow;
    expect(overflow).toBe("auto");
    expect(getSkiaNode(record("list"))?.clipChildren).toBe(true);
  });

  it("gives a scroll/auto box the scrollbar of its overflowing content, and redraws it on a range edit", async () => {
    const { workspace, scene, record } = await open("auto");
    // 300 px of content in a 100 px box: thumb = 100 / 300 of the track.
    expect(getSkiaNode(record("box"))?.scrollbar).toEqual({
      vertical: {
        trackHeight: 100,
        thumbHeight: expect.closeTo(100 / 3, 6),
        thumbY: 0,
      },
    });
    expect(childrenEnd(scene, record("box"))?.scrollbar).toBeDefined();
    expect(getSkiaNode(record("box"))?.scrollbar?.horizontal).toBeUndefined();
    // The child shrinks inside the box: no scrollbar (the box itself did not change).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("tall") }],
        sizing: { height: { kind: "set", value: 50 } },
      }),
    );
    scene.sync();
    expect(getSkiaNode(record("box"))?.scrollbar).toBeUndefined();
    expect(childrenEnd(scene, record("box"))).toBeUndefined();
    // hidden clips but does not scroll.
    const hidden = await open("hidden");
    expect(getSkiaNode(hidden.record("box"))?.scrollbar).toBeUndefined();
  });
});
