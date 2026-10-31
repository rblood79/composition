import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { CatalogCanvasGestures } from "../canvasGesture";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const id = (name: string) => `project:node:${name}` as NodeId;
const frame = (name: string, children: string[] = []): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children: children.map(id),
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open(display: "flex" | "grid") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:visibility",
        name: "Visibility",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `layout-participation-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: id("home-body") },
      entries: [
        frame("parent", ["container"]),
        {
          ...frame("container", ["a", "b", "c"]),
          layout: {
            display: { kind: "set", value: display },
            flexDirection: { kind: "set", value: "column" },
            ...(display === "grid"
              ? {
                  gridTemplateColumns: {
                    kind: "set" as const,
                    value: "100px 100px",
                  },
                  gridTemplateRows: {
                    kind: "set" as const,
                    value: "40px 40px",
                  },
                }
              : {}),
          },
          visual: { gap: { kind: "set", value: 12 } },
        },
        ...["a", "b", "c"].map((name) => ({
          ...frame(name),
          sizing: { height: { kind: "set" as const, value: 40 } },
        })),
      ],
      rootIds: [id("parent")],
      newId: workspace.newId,
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0]!;
  const box = (name: string) => scene.stream.boundsMap.get(record(name))!;
  const gestures = new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (key) => scene.stream.boundsMap.get(key),
    pick: () => undefined,
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (key) => workspace.itemOfRecord(key),
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      scene.sync();
    },
    newId: workspace.newId,
  });
  const hide = (name: string) => {
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id(name) }],
        layout: { display: { kind: "set", value: "none" } },
      }),
    );
    scene.sync();
  };
  workspace.selectRecords([record("container")]);
  return {
    workspace,
    scene,
    record,
    box,
    gestures,
    hide,
    dispose: () => {
      scene.dispose();
      workspace.dispose();
    },
  };
}

describe("레이아웃 참여와 편집 표시·조작의 일치", () => {
  it("숨긴 flex 자식은 gap 표시·히트 영역을 만들지 않고 Undo로 복구된다", async () => {
    const f = await open("flex");
    try {
      f.hide("b");
      const gaps = () =>
        f.gestures.spacingBands().filter((band) => band.kind === "gap");
      expect(gaps()).toHaveLength(1);
      expect(gaps()[0].rect).toMatchObject({
        y: f.box("a").y + 40,
        height: 12,
      });
      expect(f.box("c").y).toBe(f.box("a").y + 52);
      f.workspace.undo();
      f.scene.sync();
      expect(gaps()).toHaveLength(2);
      f.workspace.redo();
      f.scene.sync();
      expect(gaps()).toHaveLength(1);
    } finally {
      f.dispose();
    }
  });

  it.each(["container", "parent"])(
    "%s 숨김 시 grid 셀·트랙·간격 표시를 없애고 Undo로 복구한다",
    async (target) => {
      const f = await open("grid");
      try {
        const cells = () => f.gestures.gridCellsOfRecord(f.record("container"));
        expect(cells()).toHaveLength(4);
        f.hide(target);
        expect(cells()).toEqual([]);
        expect(
          f.gestures.gridTracksOfRecord(f.record("container")),
        ).toBeUndefined();
        expect(f.gestures.spacingBands()).toEqual([]);
        f.workspace.undo();
        f.scene.sync();
        expect(cells()).toHaveLength(4);
      } finally {
        f.dispose();
      }
    },
  );

  it("grid 열 내용 삭제는 화면의 점유를 따르고 숨긴 자식은 보존한다 (Undo/Redo)", async () => {
    const f = await open("grid");
    try {
      f.hide("b");
      expect(f.box("c").x).toBe(f.box("a").x + 112);
      const host = createCatalogStylesHost(f.workspace);
      const children = () =>
        (f.workspace.runtime.graph.getEntry(id("container")) as NodeEntry)
          .children;
      const depth = f.workspace.runtime.historyDepth.undo;
      host.applyGridTracks?.(f.record("container"), [
        {
          axis: "column",
          template: "100px",
          removed: [1],
          deleteContents: true,
        },
      ]);
      expect(children()).toEqual([id("a"), id("b")]);
      expect(f.workspace.runtime.historyDepth.undo).toBe(depth + 1);
      f.workspace.undo();
      f.scene.sync();
      expect(children()).toEqual([id("a"), id("b"), id("c")]);
      expect(f.box("c").x).toBe(f.box("a").x + 112);
      f.workspace.redo();
      f.scene.sync();
      expect(children()).toEqual([id("a"), id("b")]);
    } finally {
      f.dispose();
    }
  });

  it("숨긴 자식의 명시적 grid line은 열 구조에 맞춰 갱신한다", async () => {
    const f = await open("grid");
    try {
      f.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("b") }],
          layout: { gridColumnStart: { kind: "set", value: "2" } },
        }),
      );
      f.hide("b");
      createCatalogStylesHost(f.workspace).applyGridTracks?.(
        f.record("container"),
        [{ axis: "column", template: "100px", removed: [0] }],
      );
      const b = f.workspace.runtime.graph.getEntry(id("b")) as NodeEntry;
      expect(b.layout?.gridColumnStart).toEqual({ kind: "set", value: "1" });
      expect(b.layout?.display).toEqual({ kind: "set", value: "none" });
    } finally {
      f.dispose();
    }
  });

  it("Hug 전환은 숨긴 자식 대신 실제로 해당 열을 채우는 자식의 크기를 고정한다", async () => {
    const f = await open("grid");
    try {
      f.hide("b");
      createCatalogStylesHost(f.workspace).applyGridTracks?.(
        f.record("container"),
        [{ axis: "column", template: "100px auto", removed: [], hugged: [1] }],
      );
      const entry = (name: string) =>
        f.workspace.runtime.graph.getEntry(id(name)) as NodeEntry;
      expect(entry("b").sizing.width).toBeUndefined();
      expect(entry("c").sizing.width).toEqual({ kind: "set", value: 100 });
    } finally {
      f.dispose();
    }
  });

  it("상위가 숨겨진 grid의 트랙 편집은 보이지 않는 자식을 삭제하거나 크기를 고정하지 않는다", async () => {
    const f = await open("grid");
    try {
      f.hide("parent");
      const host = createCatalogStylesHost(f.workspace);
      host.applyGridTracks?.(f.record("container"), [
        { axis: "column", template: "100px auto", removed: [], hugged: [1] },
      ]);
      for (const name of ["a", "b", "c"]) {
        expect(
          (f.workspace.runtime.graph.getEntry(id(name)) as NodeEntry).sizing
            .width,
        ).toBeUndefined();
      }
      host.applyGridTracks?.(f.record("container"), [
        {
          axis: "column",
          template: "100px",
          removed: [1],
          deleteContents: true,
        },
      ]);
      expect(
        (f.workspace.runtime.graph.getEntry(id("container")) as NodeEntry)
          .children,
      ).toEqual([id("a"), id("b"), id("c")]);
    } finally {
      f.dispose();
    }
  });
});
