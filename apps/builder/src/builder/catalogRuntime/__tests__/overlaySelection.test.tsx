import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  setFields,
  updatePage,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { CatalogCanvasScene } from "../canvasScene";

import { CatalogCanvasPicking } from "../canvasPick";
import { CatalogCanvasGestures } from "../canvasGesture";
import { catalogSelectionSurface } from "../canvasSelectionGeometry";
import { catalogNewPageCommand } from "../pageTree";

const BODY = "project:node:home-body" as NodeId;
async function fixture(
  type: string,
  props: Record<string, unknown> = {},
  viewport = { width: 1200, height: 900 },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rac-additions" as EntryId<"project">,
        name: "RAC additions",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `rac-additions-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport,
      autosaveSchedule: () => {},
    },
  );
  const command = catalogPaletteInsertCommand(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: BODY }),
      newId: workspace.newId,
    },
    type,
    props,
  );
  expect(command).toBeDefined();
  const id = workspace.execute(command!).plan.selectAfter![0];
  return { workspace, library, id };
}

const families = [
  ["Sheet", "Sheet"],
  ["Dialog", "Modal"],
  ["Popover", "Popover"],
  ["Tooltip", "Tooltip"],
  ["Menu", "Popover"],
  ["Select", "Popover"],
  ["ComboBox", "Popover"],
  ["DatePicker", "Popover"],
  ["DateRangePicker", "Popover"],
  ["ContextualHelp", "Popover"],
  ["PreviewTrigger", "Popover"],
] as const;

describe("열린 overlay의 선택 표시 경계", () => {
  it.each(families)(
    "%s: 닫힘/열림/닫힘/undo와 본체 선택을 일치시킨다",
    async (type, surfaceType) => {
      const { workspace, id } = await fixture(
        type,
        { isOpen: false },
        { width: 390, height: 844 },
      );
      const root = workspace.root;
      const scene = new CatalogCanvasScene(root);
      const owner = [...root.canvasInputs.values()].find(
        (n) => n.sourceId === id,
      )!;
      const surface = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === surfaceType,
      )!;
      const open = (value: boolean) => {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value } },
          }),
        );
        scene.sync();
      };
      try {
        const closed = { ...scene.selectionBounds(owner.id)! };
        expect(scene.selectionTarget(owner.id)).toBe(owner.id);
        open(true);
        expect(scene.selectionTarget(owner.id)).toBe(surface.id);
        expect(scene.selectionBounds(owner.id)).toEqual(
          scene.stream.boundsMap.get(surface.id),
        );
        expect(scene.selectionHitBounds(owner.id)).toEqual(
          scene.selectionBounds(owner.id),
        );
        expect(scene.selectionBounds(surface.id)).toEqual(
          scene.stream.boundsMap.get(surface.id),
        );
        const shown = { ...scene.selectionBounds(owner.id)! };
        expect(shown.height).toBeGreaterThan(0);
        open(false);
        expect(scene.selectionTarget(owner.id)).toBe(owner.id);
        expect(scene.selectionBounds(owner.id)).toEqual(closed);
        workspace.undo();
        scene.sync();
        expect(scene.selectionBounds(owner.id)).toEqual(shown);
        scene.rebuild();
        expect(scene.selectionBounds(owner.id)).toEqual(shown);
      } finally {
        scene.dispose();
      }
    },
  );

  it("일반 노드는 자손이나 다른 페이지를 탐색하지 않는다", async () => {
    const { workspace, id } = await fixture("Button");
    const root = workspace.root;
    const owner = [...root.canvasInputs.values()].find(
      (n) => n.sourceId === id,
    )!;
    const get = vi.spyOn(root.canvasInputs, "get");
    const iterate = vi.spyOn(root.canvasInputs, "values");
    expect(catalogSelectionSurface(root, owner.id)).toBe(owner.id);
    expect(get).toHaveBeenCalledTimes(1);
    expect(iterate).not.toHaveBeenCalled();
  });
});

it.each(["Sheet", "Dialog", "Popover"])(
  "%s의 선택 핸들은 트리거 대신 본체를 resize하고 undo한다",
  async (type) => {
    const { workspace, id } = await fixture(type, { isOpen: true });
    const scene = new CatalogCanvasScene(workspace.root);
    const owner = workspace.root.recordsOfSource(id)[0];
    workspace.selectRecords([owner]);
    const target = scene.selectionTarget(owner);
    const targetItem = workspace.itemOfRecord(target)!;
    const ownBefore = structuredClone(
      workspace.readModel.ownFields(targetItem.target),
    );
    const ownerBefore = workspace.runtime.graph.getEntry(id)!;
    const gestures = new CatalogCanvasGestures({
      get records() {
        return workspace.root.domInputs;
      },
      graph: workspace.runtime.graph,
      bounds: (id) => scene.stream.boundsMap.get(id),
      selectionTarget: (id) => scene.selectionTarget(id),
      pick: () => target,
      selection: () => workspace.session.getSnapshot().selection,
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      editingContext: () => undefined,
      selectRecords: (ids) => workspace.selectRecords(ids),
      breakpoint: () => workspace.session.getSnapshot().breakpoint,
      execute: (command) => {
        workspace.execute(command);
        scene.sync();
      },
      newId: workspace.newId,
      reflow: (id, patch) => {
        workspace.root.previewRecord(id, patch);
        scene.sync();
      },
      ownFields: (target) => workspace.readModel.ownFields(target),
      viewport: () => workspace.root.viewport,
    });
    try {
      const start = scene.selectionBounds(owner)!;
      expect(gestures.beginMove(start.x + 10, start.y + 10, owner)).toBe(false);
      const x = start.x + start.width,
        y = start.y + start.height;
      expect(gestures.handleAt(x, y, 1)?.position).toBe("bottom-right");
      expect(gestures.beginResize(x, y, 1)).toBe(true);
      gestures.update(x - 20, y + 20, 1);
      gestures.cancel();
      scene.sync();
      expect(workspace.readModel.ownFields(targetItem.target)).toEqual(
        ownBefore,
      );
      expect(scene.selectionBounds(owner)).toEqual(start);
      expect(gestures.beginResize(x, y, 1)).toBe(true);
      gestures.update(x - 20, y + 20, 1);
      expect(gestures.finish()).toBe(true);
      const after = workspace.readModel.ownFields(targetItem.target);
      expect(after.sizing.width).toEqual({
        kind: "set",
        value: Math.round(start.width - 20),
      });
      const ownerAfter = workspace.runtime.graph.getEntry(id)!;
      if (ownerBefore.kind !== "node" || ownerAfter.kind !== "node")
        throw Error("node");
      expect(ownerAfter.sizing).toEqual(ownerBefore.sizing);
      expect(workspace.session.getSnapshot().selection[0].identity).toBe(owner);
      workspace.undo();
      scene.sync();
      expect(workspace.readModel.ownFields(targetItem.target)).toEqual(
        ownBefore,
      );
      expect(scene.selectionBounds(owner)).toEqual(start);
    } finally {
      scene.dispose();
    }
  },
);

it("다른 페이지의 열린 Dialog 경계는 해당 페이지 이동을 따라간다", async () => {
  const { workspace, id } = await fixture("Dialog", { isOpen: true });
  const graph = workspace.runtime.graph;
  const home = graph.getEntry("project:page:home")!;
  if (home.kind !== "page") throw Error("page");
  const { command, pageId } = catalogNewPageCommand([home], workspace.newId);
  workspace.execute(command);
  const page = graph.getEntry(pageId)!;
  if (page.kind !== "page") throw Error("page");
  const insert = catalogPaletteInsertCommand(
    {
      graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: page.children[0] }),
      newId: workspace.newId,
    },
    "Dialog",
    { isOpen: true },
  )!;
  const otherId = workspace.execute(insert).plan.selectAfter![0];
  const scene = new CatalogCanvasScene(workspace.root);
  try {
    const first = workspace.root.recordsOfSource(id)[0],
      other = workspace.root.recordsOfSource(otherId)[0];
    const firstBox = { ...scene.selectionBounds(first)! };
    workspace.execute(
      updatePage({
        id: pageId,
        fields: {
          placement: {
            base: { position: "absolute", left: 2100, top: 200 },
            breakpoints: {},
          },
        },
      }),
    );
    scene.sync();
    expect(scene.selectionBounds(first)).toEqual(firstBox);
    const second = scene.selectionBounds(other)!;
    expect(second).toEqual({
      ...firstBox,
      x: firstBox.x + 2100,
      y: firstBox.y + 200,
    });
    expect(scene.selectionTarget(first)).not.toBe(scene.selectionTarget(other));
    const moved = { ...second };
    const pointer = { x: 2100, y: 200, width: 1200, height: 900 };
    expect(scene.stream.hitBoundsMap.get(scene.selectionTarget(other))).toEqual(
      pointer,
    );
    scene.rebuild();
    expect(scene.selectionBounds(other)).toEqual(moved);
    expect(scene.stream.hitBoundsMap.get(scene.selectionTarget(other))).toEqual(
      pointer,
    );
  } finally {
    scene.dispose();
  }
});

it("표시 본체 아래의 컬렉션은 선택 경계 조회에서 순회하지 않는다", async () => {
  const { workspace, id } = await fixture("Select", { isOpen: true });
  const root = workspace.root;
  const owner = root.recordsOfSource(id)[0];
  const surface = [...root.canvasInputs.values()].find(
    (n) => n.ruleId === "Popover",
  )!;
  const get = vi.spyOn(root.canvasInputs, "get");
  const values = vi.spyOn(root.canvasInputs, "values");
  expect(catalogSelectionSurface(root, owner)).toBe(surface.id);
  expect(values).not.toHaveBeenCalled();
  for (const child of surface.children)
    expect(get).not.toHaveBeenCalledWith(child);
});

it.each(families)(
  "%s 열린 본체는 뒤에 추가한 배경보다 먼저 선택된다",
  async (type) => {
    const { workspace, id } = await fixture(type, { isOpen: false });
    const root = workspace.root;
    const command = catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      "Button",
    )!;
    const behind = workspace.execute(command).plan.selectAfter![0];
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: behind }],
        sizing: {
          width: { kind: "set", value: 1000 },
          height: { kind: "set", value: 800 },
        },
      }),
    );
    const scene = new CatalogCanvasScene(root);
    const picking = new CatalogCanvasPicking({
      records: root.domInputs,
      session: workspace.session,
      get stream() {
        return scene.stream;
      },
      query: () => scene.stream.hitBoundsMap.keys(),
      selectRecords: (ids) => workspace.selectRecords(ids),
      itemOf: (id) => workspace.itemOfRecord(id),
    });
    try {
      const owner = root.recordsOfSource(id)[0];
      const open = (value: boolean) => {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value } },
          }),
        );
        scene.sync();
      };
      open(true);
      const box = scene.selectionBounds(owner)!;
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      const assertOverlay = () => {
        const shown = scene.selectionBounds(owner)!;
        const x = shown.x + shown.width / 2,
          y = shown.y + shown.height / 2;
        workspace.session.exitContext();
        workspace.selectRecords([root.recordsOfSource(behind)[0]]);
        expect(picking.targetKeepingSelection(x, y, false)?.id).toBe(owner);
        expect(picking.click(x, y)).toBe(owner);
        picking.hover(x, y);
        expect(workspace.session.getSnapshot().hover?.identity).toBe(owner);
        const picked = picking.pick(x, y)!;
        expect(picking.target(x, y, true)?.id).toBe(picked);
      };
      assertOverlay();
      if (type === "Dialog") {
        expect(picking.click(100, 400)).toBe(owner);
        expect(scene.selectionHitBounds(owner)).toEqual(
          scene.selectionBounds(owner),
        );
      }
      scene.rebuild();
      assertOverlay();
      open(false);
      expect(picking.click(x, y)).not.toBe(owner);
      workspace.undo();
      scene.sync();
      assertOverlay();
      // 일반 fixed와 큰 z-index도 portal보다 아래에 남는다.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: behind }],
          layout: { position: { kind: "set", value: "fixed" } },
          visual: { zIndex: { kind: "set", value: 9999 } },
        }),
      );
      scene.sync();
      assertOverlay();
    } finally {
      scene.dispose();
    }
  },
);
