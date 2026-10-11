// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { CatalogCanvasGestures } from "../canvasGesture";
import { pickTopmostRecord } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-258 후속 (사용자 2026-10-12 「colorwheel width, height resize 해도 colorwheeltrack 이 부모의
 * 크기에 맞게 크기조절이 안된다」): a ColorWheel is its diameter square — S2 1.8.0 sets the wheel's
 * width/height from `size` over any style (ColorWheel.tsx). So a box resize (Styles width / height,
 * a Canvas handle) is a `size` edit, and the box, the track and the thumb's radius move together in
 * both consumers (the Column precedent — ADR-257: a Styles width is its S2 width prop).
 */
const BODY = "project:node:home-body" as NodeId;
const WHEEL = "project:node:wheel" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(sizing: NodeEntry["sizing"] = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr258-wheel" as EntryId<"project">,
        name: "Wheel",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr258-wheel-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: WHEEL,
          definitionId: "lib:definition:origin-component-colorwheel",
          children: [],
          props: {},
          visual: {},
          sizing,
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [WHEEL],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const scene = new CatalogCanvasScene(workspace.root);
  const gestures = new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (record) => scene.stream.boundsMap.get(record),
    pick: (x, y) =>
      pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
    selection: () => workspace.session.getSnapshot().selection,
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      scene.sync();
    },
    newId: workspace.newId,
    guideLines: () => ({ x: [], y: [] }),
    reflow: (target, patch) => {
      workspace.root.previewRecord(target, patch);
      scene.sync();
    },
  });
  const root = workspace.root;
  const rect = (type: string) => {
    const record = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    )!;
    return root.getGeometry([record.id]).get(record.id)!;
  };
  const wheelRecord = () => workspace.root.recordsOfSource(WHEEL)[0];
  const entry = () => {
    const e = workspace.runtime.graph.getEntry(WHEEL);
    return e?.kind === "node" ? e : undefined;
  };
  const dom = () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(root, wheelRecord()),
    );
    const wheel = host.firstElementChild as HTMLElement;
    const track = wheel.querySelector(
      ".react-aria-ColorWheelTrack",
    ) as HTMLElement;
    return { wheel: wheel.style, track: track.style };
  };
  return { workspace, scene, gestures, rect, wheelRecord, entry, dom };
}

describe("ADR-258 후속 — a ColorWheel's box resize is its S2 size (box · track · thumb together)", () => {
  it("Styles width → `size` (no box sizing): the Canvas box and track and the DOM wheel follow", async () => {
    const { workspace, rect, wheelRecord, entry, dom } = await open();
    workspace.selectRecords([wheelRecord()]);
    const host = createCatalogStylesHost(workspace);
    const revision = workspace.runtime.graph.revision;
    host.updateStyle("width", "240px");
    expect(entry()?.props.size).toEqual({ kind: "set", value: 240 });
    expect(entry()?.sizing).toEqual({});
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(rect("ColorWheel")).toMatchObject({ width: 240, height: 240 });
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 240, height: 240 });
    expect(dom().wheel.width).toBe("240px");
    expect(dom().track.clipPath).toContain("120");

    host.updateStyle("height", "200");
    expect(entry()?.props.size).toEqual({ kind: "set", value: 200 });
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 200, height: 200 });
    // The panel shows the diameter as the box's width and height.
    expect(host.readSelectedTarget().style).toMatchObject({
      width: "200px",
      height: "200px",
    });
    // The Size section's length (`applySizing` — css) and reset write `size` too; Fill is refused.
    const id = wheelRecord();
    host.applySizing(id, { axis: "width", mode: "css", value: "260px" });
    expect(entry()?.props.size).toEqual({ kind: "set", value: 260 });
    host.applySizing(id, { axis: "height", mode: "reset" });
    expect(entry()?.props.size).toBeUndefined();
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 180, height: 180 });
    const before = workspace.runtime.graph.revision;
    host.applySizing(id, { axis: "width", mode: "fill" });
    expect(workspace.runtime.graph.revision).toBe(before);
    expect(entry()?.sizing).toEqual({});
    expect(entry()?.fillSizing).toBeUndefined();
  });

  it("a Canvas corner handle drag writes `size` (the larger side) — one step, no box sizing", async () => {
    const { workspace, scene, gestures, rect, wheelRecord, entry } =
      await open();
    workspace.selectRecords([wheelRecord()]);
    scene.sync();
    const start = scene.stream.boundsMap.get(wheelRecord())!;
    expect(start.width).toBe(180);
    const corner = { x: start.x + start.width, y: start.y + start.height };
    const revision = workspace.runtime.graph.revision;
    expect(gestures.beginResize(corner.x, corner.y, 1)).toBe(true);
    gestures.update(corner.x + 60, corner.y + 20, 1);
    gestures.finish();
    expect(entry()?.props.size).toEqual({ kind: "set", value: 240 });
    expect(entry()?.sizing).toEqual({});
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(rect("ColorWheel")).toMatchObject({ width: 240, height: 240 });
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 240, height: 240 });
  });

  it("a wheel with box sizing from before (width 300 · height 220) is still its diameter square in both consumers", async () => {
    const { rect, dom, workspace } = await open({
      width: { kind: "set", value: 300 },
      height: { kind: "set", value: 220 },
    });
    expect(rect("ColorWheel")).toMatchObject({ width: 180, height: 180 });
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 180, height: 180 });
    expect(dom().wheel.width).toBe("180px");
    expect(dom().wheel.height).toBe("180px");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: WHEEL }],
        props: { size: { kind: "set", value: 260 } },
      }),
    );
    expect(rect("ColorWheel")).toMatchObject({ width: 260, height: 260 });
    expect(rect("ColorWheelTrack")).toMatchObject({ width: 260, height: 260 });
  });
});
