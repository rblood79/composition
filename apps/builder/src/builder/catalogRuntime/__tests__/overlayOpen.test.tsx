import { catalogOpenOwnerOf } from "../../../../../../packages/shared/src/catalog/runtime/runtimeStateProps";
import { createCommandReader } from "../../workspace/canvas/skia/renderCommands";
import {
  catalogOverlayDescriptor,
  catalogOverlayPlacement,
  sameOverlayPlacement,
} from "../../../../../../packages/shared/src/catalog/runtime/overlayLayout";
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { editContractFixture } from "./support/editContractFixture";
import { CatalogCanvasScene } from "../canvasScene";

import { catalogRuleNodeData } from "../ruleShapes";

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

/** An open picker's Popover: its box, its placement and its anchor's box. */
function pickerOverlay(root: CatalogWorkspace["root"]) {
  const pop = [...root.canvasInputs.values()].find(
    (n) => n.ruleId === "Popover",
  )!;
  const descriptor = catalogOverlayDescriptor(
    pop,
    (id) => root.canvasInputs.get(id),
    root.typeOf,
  )!;
  const boxes = root.getGeometry([pop.id, descriptor.anchor!.id]);
  return {
    box: boxes.get(pop.id)!,
    place: root.getOverlayPlacement(pop.id)!,
    anchor: boxes.get(descriptor.anchor!.id)!,
  };
}

const cases = [
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

it("열린 Sheet는 Dialog의 Modal과 같은 그림자를 본체에만 그린다", async () => {
  const shadows = [];
  for (const [type, surfaceType] of [
    ["Sheet", "Sheet"],
    ["Dialog", "Modal"],
  ]) {
    const { workspace } = await fixture(type, { isOpen: true });
    const scene = new CatalogCanvasScene(workspace.root);
    try {
      const surface = [...workspace.root.canvasInputs.values()].find(
        (node) => node.ruleId === surfaceType,
      )!;
      const data = getSkiaNode(surface.id)!;
      const body = surfaceType === "Modal" ? data.children![1] : data;
      const effects = body.effects?.filter(
        (effect) => effect.type === "drop-shadow",
      );
      expect(effects).toHaveLength(3);
      shadows.push(effects);
      const backdrop = [...workspace.root.canvasInputs.values()].find(
        (node) => node.ruleId === "SheetBackdrop",
      );
      if (backdrop) expect(getSkiaNode(backdrop.id)?.effects).toBeUndefined();
      else {
        expect(data.children![0].effects).toBeUndefined();
        // (The Modal's scrim is the S2 underlay — #00000070, as the Sheet's.)
        const scrim = data.children![0].children?.[0] ?? data.children![0];
        expect(Array.from(scrim.box!.fillColor!)[3]).toBeCloseTo(112 / 255, 5);
      }
    } finally {
      scene.dispose();
    }
  }
  expect(shadows[0]).toEqual(shadows[1]);
});

describe("S2 Popover 표면", () => {
  it.each([
    ["S", 336],
    ["M", 416],
    ["L", 576],
  ] as const)(
    "%s 폭과 10px 모서리·8px 여백을 Canvas에 반영한다",
    async (size, width) => {
      const { workspace } = await fixture("Popover", { isOpen: true, size });
      const root = workspace.root;
      const popover = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === "Popover",
      )!;
      const scene = new CatalogCanvasScene(root);
      try {
        expect(root.getGeometry([popover.id]).get(popover.id)!.width).toBe(
          width,
        );
        expect(popover.visual).toMatchObject({ paddingX: 8, paddingY: 8 });
        expect(getSkiaNode(popover.id)!.box).toMatchObject({
          borderRadius: 10,
          outlineWidth: 1,
        });
        expect(
          getSkiaNode(popover.id)!.effects?.filter(
            (e) => e.type === "drop-shadow",
          ),
        ).toHaveLength(3);
        expect(getSkiaNode(popover.id)!.box!.outlineColor![3]).toBe(0);
      } finally {
        scene.dispose();
        workspace.dispose();
      }
    },
  );

  it("좁은 viewport에서는 양쪽 12px을 남기고 폭을 줄인다", async () => {
    const { workspace } = await fixture(
      "Popover",
      { isOpen: true, size: "L" },
      { width: 390, height: 844 },
    );
    try {
      const popover = [...workspace.root.canvasInputs.values()].find(
        (n) => n.ruleId === "Popover",
      )!;
      expect(
        workspace.root.getGeometry([popover.id]).get(popover.id)!.width,
      ).toBe(366);
    } finally {
      workspace.dispose();
    }
  });

  it("Menu는 Popover에만 표면·그림자를 그리고 목록 여백은 8px이다", async () => {
    const { workspace } = await fixture("Menu", { isOpen: true });
    const root = workspace.root;
    const scene = new CatalogCanvasScene(root);
    try {
      const popover = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === "Popover",
      )!;
      const menu = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === "Menu",
      )!;
      expect(
        root.getGeometry([popover.id]).get(popover.id)!.width,
      ).toBeLessThan(320);
      expect(getSkiaNode(popover.id)!.box!.borderRadius).toBe(10);
      expect(
        getSkiaNode(popover.id)!.effects?.filter(
          (e) => e.type === "drop-shadow",
        ),
      ).toHaveLength(3);
      expect(
        getSkiaNode(menu.id)!.effects?.filter(
          (e) => e.type === "drop-shadow",
        ) ?? [],
      ).toHaveLength(0);
      expect(menu.visual).toMatchObject({ paddingX: 8, paddingY: 8 });
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });
});

describe("Popover 목록의 S2 강조색", () => {
  it.each(["Menu", "Select", "ComboBox"])(
    "%s: hover와 focus는 같은 색이고 disabled는 강조하지 않는다",
    async (type) => {
      const { workspace } = await fixture(type, { isOpen: true });
      const root = workspace.root;
      try {
        const node = [...root.canvasInputs.values()].find(
          (n) => n.ruleId === (type === "Menu" ? "MenuItem" : "ListBoxItem"),
        )!;
        if (type !== "Menu") expect(node.derivedProps?._inPopover).toBe(true);
        for (const [theme, channel] of [
          ["light", 225],
          ["dark", 50],
        ] as const) {
          for (const state of ["hover", "focusVisible", "disabled"] as const) {
            const data = catalogRuleNodeData({
              node: { ...node, props: { ...node.props, ...node.derivedProps } },
              rule: root.runtime.graph.library.rules.get(node.ruleId!)!,
              type: node.ruleId!,
              rect: { width: 150, height: 32 },
              authoredVisual: {},
              state,
              theme,
            });
            const color = Array.from(data.box?.fillColor ?? []);
            if (state === "disabled") expect(color[3] ?? 0).toBe(0);
            else
              expect(color).toEqual([
                expect.closeTo(channel / 255, 5),
                expect.closeTo(channel / 255, 5),
                expect.closeTo(channel / 255, 5),
                1,
              ]);
          }
        }
      } finally {
        workspace.dispose();
      }
    },
  );
});

describe("overlay authored Open parity", () => {
  it.each(cases)(
    "%s exposes Open and updates its %s portal through off/on/undo",
    async (type, bodyType) => {
      expect(
        editContractFixture(type).fields.map((field) => field.key),
      ).toContain("isOpen");
      const { workspace, id } = await fixture(type, { isOpen: true });
      const root = workspace.root;
      const body = () =>
        [...root.canvasInputs.values()].find(
          (node) => root.typeOf(node) === bodyType,
        )!;
      const scene = new CatalogCanvasScene(root);
      const bounds = () => {
        scene.sync();
        return scene.stream.boundsMap.get(body().id)!;
      };
      try {
        expect(body().hidden).not.toBe(true);
        expect(body().derivedProps?._overlayPortal).toBe(true);
        const initial = { ...bounds() };
        if (bodyType === "Modal") {
          expect(initial.x).toBe((1200 - initial.width) / 2);
          expect(initial.y).toBe((900 - initial.height) / 2);
          expect(getSkiaNode(body().id)?.children?.[0]).toMatchObject({
            width: 1200,
            height: 900,
          });
        }
        const arrow = [...root.canvasInputs.values()].find(
          (n) => n.bindingId === "overlayarrow",
        );
        if (arrow) {
          expect(arrow.hidden).not.toBe(true);
          expect(
            root.getGeometry([arrow.id]).get(arrow.id)?.width,
          ).toBeGreaterThan(0);
        }
        expect(initial.width).toBeGreaterThan(0);
        expect(initial.height).toBeGreaterThan(0);
        expect(getSkiaNode(body().id)?.isFixed).toBe(true);
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value: false } },
          }),
        );
        expect(body().hidden).toBe(true);
        expect(bounds().height).toBe(0);
        const grid = [...root.canvasInputs.values()].find(
          (n) => n.ruleId === "CalendarGrid",
        );
        if (grid) expect(getSkiaNode(grid.id)?.visible).toBe(false);
        // 숨겨진 portal 아래의 idle warmup이 이전 subtree span으로 되감기지 않아야 한다.
        const commandAt = createCommandReader(scene.stream.commands);
        for (let index = 0; index < scene.stream.commands.length; index++) {
          const command = commandAt(index);
          if (command?.type !== 0 || command.visible) continue;
          const span = scene.stream.subtreeSpans.get(command.elementId)!;
          expect(span.start).toBe(index);
          expect(span.end).toBeGreaterThan(index);
        }
        workspace.undo();
        expect(body().hidden).not.toBe(true);
        expect(bounds()).toEqual(initial);
      } finally {
        scene.dispose();
      }
    },
  );
  it.each(["Select", "ComboBox", "DatePicker", "DateRangePicker"])(
    "%s honors Initially Open but explicit Open=false wins",
    async (type) => {
      const { workspace, id } = await fixture(type, { defaultOpen: true });
      const body = () =>
        [...workspace.root.canvasInputs.values()].find(
          (n) => n.ruleId === "Popover",
        )!;
      expect(body().hidden).not.toBe(true);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: { isOpen: { kind: "set", value: false } },
        }),
      );
      expect(body().hidden).toBe(true);
    },
  );
});

// RAC와 동일하게 viewport가 부족한 방향에서는 반전하고 cross-axis를 경계 안으로 제한한다.
it("opens an initially closed Popover including its arrow", async () => {
  const { workspace, id } = await fixture("Popover");
  const arrow = () =>
    [...workspace.root.canvasInputs.values()].find(
      (n) => n.bindingId === "overlayarrow",
    )!;
  expect(arrow().hidden).toBe(true);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { isOpen: { kind: "set", value: true } },
    }),
  );
  expect(arrow().hidden).not.toBe(true);
  expect(workspace.root.getGeometry([arrow().id]).get(arrow().id)?.width).toBe(
    12,
  );
});

describe("overlay viewport placement", () => {
  it("flips a menu near the bottom edge and honors shouldFlip=false", async () => {
    const { workspace } = await fixture("Menu", { isOpen: true });
    const root = workspace.root;
    const body = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "Popover",
    )!;
    const descriptor = catalogOverlayDescriptor(
      body,
      (id) => root.canvasInputs.get(id),
      root.typeOf,
    )!;
    const anchor = { x: 1100, y: 850, width: 80, height: 32 };
    const box = { x: 0, y: 0, width: 150, height: 120 };
    const position = catalogOverlayPlacement(
      body,
      descriptor,
      anchor,
      box,
      root.viewport,
      "en-US",
    );
    expect(position).toMatchObject({ x: 1038, y: 722, placement: "top" });
    const noFlip = catalogOverlayPlacement(
      { ...body, props: { ...body.props, shouldFlip: false } },
      descriptor,
      anchor,
      box,
      root.viewport,
      "en-US",
    );
    expect(noFlip.placement).toBe("bottom");
    expect(noFlip.maxHeight).toBe(0);
  });
  it.each(["Select", "ComboBox"])(
    "%s: viewport-wide menus match trigger edges with parent padding 0/4/40",
    async (type) => {
      for (const padding of [0, 4, 40]) {
        const { workspace } = await fixture(
          type,
          { isOpen: true },
          { width: 390, height: 844 },
        );
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: BODY }],
            sizing: { width: { kind: "set", value: 390 } },
            visual: {
              paddingLeft: { kind: "set", value: padding },
              paddingRight: { kind: "set", value: padding },
            },
          }),
        );
        const { box, place, anchor } = pickerOverlay(workspace.root);
        expect(box.width).toBe(anchor.width);
        expect(place.x).toBe(padding);
        expect(place.x + box.width).toBe(390 - padding);
      }
    },
  );

  it("uses the trigger width as a Select minimum and a ComboBox width", async () => {
    for (const type of ["Select", "ComboBox"]) {
      const { workspace } = await fixture(type, { isOpen: true });
      const { place, anchor } = pickerOverlay(workspace.root);
      expect(type === "Select" ? place.minWidth : place.width).toBe(
        anchor.width,
      );
    }
  });
});

it("routes ComboBox open actions to its owner and explicit body Open to the body", async () => {
  const { workspace } = await fixture("ComboBox");
  const root = workspace.root;
  const pop = [...root.domInputs.values()].find((n) => n.ruleId === "Popover")!;
  const owner = [...root.domInputs.values()].find(
    (n) => n.ruleId === "ComboBox",
  )!;
  expect(catalogOpenOwnerOf(root, pop.id, root.typeOf)).toBe(owner.id);
  workspace.execute(
    setFields({
      targets: [workspace.positionOfRecord(pop.id)!.target],
      props: { isOpen: { kind: "set", value: true } },
    }),
  );
  expect(catalogOpenOwnerOf(root, pop.id, root.typeOf)).toBeUndefined();
  expect(root.canvasInputs.get(pop.id)?.hidden).not.toBe(true);
});

describe("overlay incremental work", () => {
  it("rejects ordinary nodes before looking up ancestors", async () => {
    const { workspace } = await fixture("Button");
    const node = [...workspace.root.canvasInputs.values()].find(
      (n) => n.bindingId === "button",
    )!;
    const get = vi.fn((id: string) => workspace.root.canvasInputs.get(id));
    expect(
      catalogOverlayDescriptor(node, get, workspace.root.typeOf),
    ).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("reads each geometry once in one batch when open placement is unchanged", async () => {
    const { workspace } = await fixture("Select", { isOpen: true });
    const root = workspace.root;
    const read = vi.spyOn(root, "getGeometry");
    const settle = () =>
      (root as unknown as { settleOverlays(): string[] }).settleOverlays();
    // 가장 최근 패스의 크기 입력까지 정착시킨 후 무관한 갱신을 재현한다.
    settle();
    read.mockClear();
    expect(settle()).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
    const ids = [...read.mock.calls[0][0]];
    expect(ids.length).toBe(new Set(ids).size);
    expect(ids.length).toBeGreaterThan(1);
    read.mockRestore();
  });

  it("shares ancestor visibility checks during a bind and refreshes after close/open", async () => {
    const { workspace, id } = await fixture("Select", { isOpen: true });
    const root = workspace.root;
    const checks = vi.spyOn(root, "tagRowCollapsed");
    const scene = new CatalogCanvasScene(root);
    try {
      const ids = checks.mock.calls.map(([id]) => id);
      expect(ids.length).toBe(new Set(ids).size);
      const body = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === "Popover",
      )!;
      for (const isOpen of [false, true, false, true]) {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value: isOpen } },
          }),
        );
        scene.sync();
        expect(root.canvasInputs.get(body.id)?.hidden === true).toBe(!isOpen);
        if (isOpen)
          expect(scene.stream.boundsMap.get(body.id)?.height).toBeGreaterThan(
            0,
          );
      }
    } finally {
      scene.dispose();
      checks.mockRestore();
    }
  });

  it("refreshes cached placement when an ancestor moves the anchor", async () => {
    const { workspace } = await fixture("Select", { isOpen: true });
    const root = workspace.root;
    const body = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "Popover",
    )!;
    const before = root.getOverlayPlacement(body.id)!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        visual: { paddingTop: { kind: "set", value: 40 } },
      }),
    );
    expect(root.getOverlayPlacement(body.id)!.y).toBe(before.y + 40);
    workspace.undo();
    expect(root.getOverlayPlacement(body.id)!.y).toBe(before.y);
  });

  it("keeps a fixed anchor in page coordinates under an offset parent", async () => {
    const { workspace } = await fixture("Select", { isOpen: true });
    const root = workspace.root;
    const body = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "Popover",
    )!;
    const descriptor = catalogOverlayDescriptor(
      body,
      (id) => root.canvasInputs.get(id),
      root.typeOf,
    )!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        visual: { paddingTop: { kind: "set", value: 40 } },
      }),
    );
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(descriptor.anchor!.id)!.target],
        layout: {
          position: { kind: "set", value: "fixed" },
          insetTop: { kind: "set", value: "100px" },
          insetLeft: { kind: "set", value: "20px" },
        },
      }),
    );
    const scene = new CatalogCanvasScene(root);
    try {
      const anchor = scene.stream.boundsMap.get(descriptor.anchor!.id)!;
      expect(anchor.y).toBe(100);
      const expected = catalogOverlayPlacement(
        root.canvasInputs.get(body.id)!,
        descriptor,
        anchor,
        root.getGeometry([body.id]).get(body.id)!,
        { width: 1200, height: 900 },
        "en-US",
      );
      expect(root.getOverlayPlacement(body.id)!.y).toBe(expected.y);
    } finally {
      scene.dispose();
    }
  });

  it("rolls back placement inputs after an engine failure and releases them on close", async () => {
    const { workspace, id } = await fixture("Select", { isOpen: true });
    const root = workspace.root;
    const internal = root as unknown as {
      overlayPlacementInputs: Map<string, readonly unknown[]>;
      layout: {
        updateNodeStyle(id: string, style: Record<string, unknown>): void;
      };
    };
    const body = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "Popover",
    )!;
    const before = root.getOverlayPlacement(body.id)!;
    const beforeInputs = internal.overlayPlacementInputs.get(body.id);
    const original = internal.layout.updateNodeStyle.bind(internal.layout);
    let failed = false;
    const write = vi
      .spyOn(internal.layout, "updateNodeStyle")
      .mockImplementation((id, style) => {
        original(id, style);
        if (
          !failed &&
          id === body.id &&
          internal.overlayPlacementInputs.get(id) !== beforeInputs
        ) {
          failed = true;
          throw new Error("overlay placement failure");
        }
      });
    const change = () =>
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(body.id)!.target],
          props: { offset: { kind: "set", value: 40 } },
        }),
      );
    expect(change).toThrow();
    write.mockRestore();
    expect(failed).toBe(true);
    expect(root.getOverlayPlacement(body.id)).toEqual(before);
    expect(internal.overlayPlacementInputs.get(body.id)).toBe(beforeInputs);
    change();
    expect(root.getOverlayPlacement(body.id)!.y).toBeGreaterThan(before.y);
    for (let repeat = 0; repeat < 5; repeat++) {
      for (const isOpen of [false, true]) {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value: isOpen } },
          }),
        );
        expect(internal.overlayPlacementInputs.size).toBe(isOpen ? 1 : 0);
      }
    }
  });

  it("detects removed placement width and arrow fields", () => {
    const base = { x: 1, y: 2, maxHeight: 100, placement: "bottom" };
    expect(sameOverlayPlacement({ ...base, width: 50 }, base)).toBe(false);
    expect(
      sameOverlayPlacement({ ...base, arrow: { x: 1, y: 2, size: 8 } }, base),
    ).toBe(false);
    expect(sameOverlayPlacement({ ...base }, base)).toBe(true);
  });
});
