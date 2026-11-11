import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogCanvasScene } from "../canvasScene";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { createCommandReader } from "../../workspace/canvas/skia/renderCommands";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-307 Phase 3 — a region that holds a fixed box or an overlay is recorded again as its page
 * (not the whole scene). The page's fixed boxes are drawn from the binding's rects, and a fixed
 * box's rect is recorded from its direct parent: an ancestor that moves or resizes changes it
 * though no record of the box changed. Every edit's patched stream must be the one a fresh bind
 * of the same records gives (review H1: the stale rect drew the bar where its ancestor had moved).
 */
const BODY = "project:node:home-body" as NodeId;
const WRAP = "project:node:wrap" as NodeId;
const ABOVE = "project:node:above" as NodeId;
const SECTION = "project:node:section" as NodeId;
const INNER = "project:node:inner" as NodeId;
const BAR = "project:node:bar" as NodeId;
const OTHER = "project:node:other" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const node = (id: NodeId) => ({ kind: "node" as const, id });
const frame = (id: NodeId, extra: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id,
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});
const fixedBar = () =>
  frame(BAR, {
    layout: {
      position: set("fixed"),
      insetLeft: set("0px"),
      insetTop: set("0px"),
    },
    sizing: { width: set(100), height: set(50) },
  });
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
      .map(
        ([id, box]) =>
          `${id}:${[box.x, box.y, box.width, box.height].map(round)}`,
      )
      .sort();
  const at = createCommandReader(stream.commands);
  const commands: string[] = [];
  for (let index = 0; index < stream.commands.length; index++) {
    const command = at(index) as unknown as Record<string, unknown>;
    commands.push(
      `${command.type}:${command.elementId ?? command.ownerId ?? ""}:${["x", "y", "width", "height"].map((key) => (typeof command[key] === "number" ? round(command[key] as number) : "")).join(",")}:${command.unscrollOwnerId ?? ""}:${command.isFixed ?? ""}`,
    );
  }
  return {
    bounds: boxes(stream.boundsMap),
    hit: boxes(stream.hitBoundsMap),
    commands,
    topLayer: [...stream.topLayerElementIds].sort(),
    context: [...stream.subtreeBuildContextByElement]
      .map(
        ([id, context]) =>
          `${id}:${context.parentElementId}:${round(context.parentAbsX)},${round(context.parentAbsY)}:${context.zOrderKey}`,
      )
      .sort(),
    children: [...stream.childElementIds]
      .map(([id, ids]) => `${id}:${ids.join(",")}`)
      .sort(),
  };
}
async function open(entries: NodeEntry[], rootIds: NodeId[]) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:splice" as EntryId<"project">,
        name: "Splice",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr307-splice-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: node(BODY),
      entries,
      rootIds,
      newId: workspace.newId,
    }),
  );
  return workspace;
}
const palette = (
  workspace: CatalogWorkspace,
  type: string,
  props: Record<string, unknown>,
) =>
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => node(BODY),
        newId: workspace.newId,
      },
      type,
      props,
    )!,
  ).plan.selectAfter![0] as NodeId;

describe("a page recorded again with its fixed layer (ADR-307 Phase 3)", () => {
  it("every edit's patched stream is a fresh bind's: fixed box, overlays, ancestors that move", async () => {
    const workspace = await open(
      [
        frame(WRAP, {
          children: [ABOVE, SECTION],
          sizing: { height: set(500) },
        }),
        frame(ABOVE, { sizing: { height: set(100) } }),
        frame(SECTION, { children: [INNER], sizing: { height: set(60) } }),
        frame(INNER, { children: [BAR], sizing: { height: set(30) } }),
        fixedBar(),
      ],
      [WRAP],
    );
    const sheet = palette(workspace, "Sheet", { isOpen: true });
    const dialog = palette(workspace, "Dialog", { isOpen: false });
    const scene = new CatalogCanvasScene(workspace.root);
    scene.sync();
    const fields = (id: NodeId, input: Record<string, unknown>) =>
      workspace.execute(setFields({ targets: [node(id)], ...input }));
    const edits: Array<[string, () => void]> = [
      ["bar inset", () => fields(BAR, { layout: { insetTop: set("30px") } })],
      ["bar height", () => fields(BAR, { sizing: { height: set(80) } })],
      ["above height", () => fields(ABOVE, { sizing: { height: set(200) } })],
      [
        "insert in section",
        () =>
          workspace.execute(
            insertNodes({
              parent: node(SECTION),
              index: 0,
              entries: [
                frame("project:node:added" as NodeId, {
                  sizing: { height: set(20) },
                }),
              ],
              rootIds: ["project:node:added" as NodeId],
              newId: workspace.newId,
            }),
          ),
      ],
      ["dialog open", () => fields(dialog, { props: { isOpen: set(true) } })],
      ["sheet close", () => fields(sheet, { props: { isOpen: set(false) } })],
      ["dialog close", () => fields(dialog, { props: { isOpen: set(false) } })],
      ["sheet open", () => fields(sheet, { props: { isOpen: set(true) } })],
      [
        "bar static",
        () => fields(BAR, { layout: { position: set("static") } }),
      ],
      ["bar fixed", () => fields(BAR, { layout: { position: set("fixed") } })],
      [
        "section padding",
        () => fields(SECTION, { visual: { paddingTop: set(40) } }),
      ],
      ["undo", () => void workspace.undo()],
      ["undo again", () => void workspace.undo()],
      ["undo a third time", () => void workspace.undo()],
    ];
    const failures: string[] = [];
    for (const [name, run] of edits) {
      run();
      scene.sync();
      const patched = signature(scene);
      scene.rebuild();
      const fresh = signature(scene);
      const keys = (Object.keys(fresh) as (keyof typeof fresh)[]).filter(
        (key) => JSON.stringify(patched[key]) !== JSON.stringify(fresh[key]),
      );
      if (keys.length) failures.push(`${name}: ${keys.join(",")}`);
    }
    scene.dispose();
    expect(failures).toEqual([]);
  });

  it("a fixed bar stays in the viewport through edits that move its ancestors, with no bind in between", async () => {
    const workspace = await open(
      [
        frame(ABOVE, { sizing: { height: set(100) } }),
        frame(SECTION, { children: [BAR], sizing: { height: set(60) } }),
        fixedBar(),
        frame(OTHER, { sizing: { height: set(10) } }),
      ],
      [ABOVE, SECTION, OTHER],
    );
    const root = workspace.root;
    const record = (id: NodeId) => root.recordsOfSource(id)[0]!;
    const scene = new CatalogCanvasScene(root);
    scene.sync();
    const barTop = () =>
      scene.stream.boundsMap.get(record(BAR))!.y -
      scene.stream.boundsMap.get(record(BODY))!.y;
    const kinds: string[] = [];
    const edit = (id: NodeId, input: Record<string, unknown>) => {
      workspace.execute(setFields({ targets: [node(id)], ...input }));
      kinds.push((scene.sync() as { kind: string }).kind);
      return barTop();
    };
    expect(barTop()).toBe(0);
    // The section moves down: the bar's rect (from its parent) changes, its place does not.
    expect(edit(ABOVE, { sizing: { height: set(200) } })).toBe(0);
    expect(edit(OTHER, { sizing: { height: set(20) } })).toBe(0);
    // A paint-only edit of the bar's ancestor records the region — the page — again.
    expect(edit(SECTION, { visual: { opacity: set(0.5) } })).toBe(0);
    // (No edit bound the whole scene again.)
    expect(kinds).toEqual(["patched", "patched", "patched"]);
    scene.dispose();
  });
});
