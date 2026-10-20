import "fake-indexeddb/auto";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { absolutePlacementOf } from "./absoluteLayoutFixture";
import { catalogNextAxisConstraint } from "../positionConstraint";

/**
 * ADR-248 Phase 4e-4d-3 Position: the absolute toggle keeps where a node is drawn (its box offset
 * becomes `placement`), fixes a fill axis at its measured px and moves it to the front of its
 * siblings, as one step; Left / Top of a placed node edit its placement offsets.
 */
const BODY = "project:node:home-body" as NodeId;
const ROW = "project:node:row" as NodeId;
const BOX = "project:node:box" as NodeId;
const NEXT = "project:node:next" as NodeId;

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

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:position" as EntryId<"project">,
        name: "Position",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-position-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame(ROW, {
          children: [BOX, NEXT],
          layout: {
            display: { kind: "set", value: "flex" },
            flexDirection: { kind: "set", value: "column" },
          },
          visual: {
            borderWidth: { kind: "set", value: 2 },
            paddingTop: { kind: "set", value: 10 },
            paddingLeft: { kind: "set", value: 6 },
          },
          sizing: {
            width: { kind: "set", value: 400 },
            height: { kind: "set", value: 300 },
          },
        }),
        frame(BOX, {
          sizing: { height: { kind: "set", value: 50 } },
          fillSizing: { width: { factor: 1 } },
        }),
        frame(NEXT, { sizing: { height: { kind: "set", value: 40 } } }),
      ],
      rootIds: [ROW],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(BOX)[0];
  workspace.selectRecords([record]);
  const graph = workspace.runtime.graph;
  return {
    workspace,
    graph,
    record,
    node: () => graph.getEntry(BOX) as NodeEntry,
    rect: () => workspace.root.getGeometry([record]).get(record)!,
    host: createCatalogStylesHost(workspace),
  };
}

describe("ADR-248 Phase 4e-4d-3 Position", () => {
  it("absolute on keeps the drawn box, fixes a fill axis, fronts the node — one step; off returns it to the flow", async () => {
    const { workspace, graph, node, rect, host, record } = await open();
    const before = { ...rect() };
    expect(before).toMatchObject({ x: 8, y: 12, width: 390, height: 50 });
    const revision = graph.revision;
    expect(host.applyAbsolute(record, true)).toBe(null);
    expect(graph.revision).toBe(revision + 1);
    expect(absolutePlacementOf(node())).toEqual({
      kind: "absolute",
      x: 6,
      y: 10,
    });
    expect(node().fillSizing).toBe(undefined);
    expect(node().sizing.width).toEqual({ kind: "set", value: 390 });
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([NEXT, BOX]);
    expect(rect()).toMatchObject({
      x: before.x,
      y: before.y,
      width: 390,
      height: 50,
    });
    expect(host.readSelectedTarget().style).toMatchObject({
      position: "absolute",
      left: "6px",
      top: "10px",
    });

    // Left / Top edit the insets (the other axis stays); `%` is a unit of its own (ADR-275 — the
    // panel's units are the stored ones).
    host.updateStyle("left", "30px");
    expect(absolutePlacementOf(node())).toEqual({
      kind: "absolute",
      x: 30,
      y: 10,
    });
    expect(rect().x).toBe(32);
    const edited = graph.revision;
    host.updateStyle("top", "10%");
    expect(graph.revision).toBe(edited + 1);
    expect(node().layout?.insetTop).toEqual({ kind: "set", value: "10%" });
    workspace.undo();

    expect(host.applyAbsolute(record, false)).toBe(null);
    expect(absolutePlacementOf(node())).toBe(undefined);
    expect(host.readSelectedTarget().style.position).toBe(undefined);

    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(absolutePlacementOf(node())).toBe(undefined);
    expect(node().fillSizing).toEqual({ width: { factor: 1 } });
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([BOX, NEXT]);
    expect(host.applyAbsolute("other", true)).toBe("selection-changed");
  });

  // 2026-10-05 감사 — 여러 노드를 한 번에 absolute 로: 각 move 가 앞 move 의 결과 위에서 계획된다
  // (같은 reader 로 계획하면 부모 children 을 통째로 쓰는 마지막 move 가 앞 move 를 덮는다).
  it("absolute on for two siblings fronts both, keeping their order", async () => {
    const { workspace, graph } = await open();
    const THIRD = "project:node:third" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: ROW },
        entries: [
          frame(THIRD, { sizing: { height: { kind: "set", value: 30 } } }),
        ],
        rootIds: [THIRD],
        newId: workspace.newId,
      }),
    );
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([
      BOX,
      NEXT,
      THIRD,
    ]);
    const records = [BOX, NEXT].map(
      (id) => workspace.root.recordsOfSource(id)[0],
    );
    workspace.selectRecords(records);
    const host = createCatalogStylesHost(workspace);
    expect(host.applyAbsolute(records[0], true)).toBe(null);
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([
      THIRD,
      BOX,
      NEXT,
    ]);
    expect(absolutePlacementOf(graph.getEntry(BOX))?.kind).toBe("absolute");
    expect(absolutePlacementOf(graph.getEntry(NEXT))?.kind).toBe("absolute");
  });

  it("a section reads the placement as position / left / top and follows placement-only edits", async () => {
    const { workspace, host, record } = await open();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        {children}
      </CatalogWorkspaceProvider>
    );
    const { result, rerender } = renderHook(
      () => host.useElementStyleContext(record),
      { wrapper },
    );
    expect(result.current.style?.position).toBe(undefined);
    host.applyAbsolute(record, true);
    rerender();
    expect(result.current.style).toMatchObject({
      position: "absolute",
      left: "6px",
      top: "10px",
    });
    host.updateStyle("top", "44px");
    rerender();
    expect(result.current.style?.top).toBe("44px");
  });
});

/**
 * ADR-275 G3 — the Position section's edits (`host.applyPosition`): a pin change keeps the box
 * where it is drawn, a value typed in an unpinned side moves the axis to that side (its opposite
 * goes), Left+Right drops the axis' size and leaving it fixes the drawn size, Fill pins four
 * sides at 0, and an absolute box's Center axis refuses margins (사용자 결정 2).
 */
describe("ADR-275 Position section edits", () => {
  const layoutOf = (node: NodeEntry) =>
    Object.fromEntries(
      Object.entries(node.layout ?? {}).map(([key, write]) => [
        key,
        write?.kind === "set" ? write.value : write?.kind,
      ]),
    );

  it("a pin change keeps the drawn box; an unpinned side takes a typed value and the axis moves there", async () => {
    const { node, rect, host, record } = await open();
    expect(host.applyAbsolute(record, true)).toBe(null);
    const before = { ...rect() };
    expect(layoutOf(node())).toMatchObject({
      insetLeft: "6px",
      insetTop: "10px",
    });

    // Right pin (Left+Right → back: press Right on a Left box = both; Left+Right stretches).
    expect(
      host.applyPosition(record, {
        kind: "constraint",
        axis: "x",
        constraint: "end",
      }),
    ).toBe(null);
    expect(rect()).toMatchObject({
      x: before.x,
      y: before.y,
      width: before.width,
    });
    expect(layoutOf(node())).toMatchObject({ insetRight: "0px" });
    expect(node().layout?.insetLeft).toBeUndefined();

    // Center keeps the place too: the offset is from the centred position.
    host.applyPosition(record, {
      kind: "constraint",
      axis: "y",
      constraint: "center",
    });
    expect(rect()).toMatchObject({ x: before.x, y: before.y });
    expect(layoutOf(node())).toMatchObject({ alignSelf: "unsafe center" });

    // A value typed in the unpinned Left field: the axis is Left, Right goes.
    host.applyPosition(record, { kind: "inset", side: "left", value: "20" });
    expect(layoutOf(node())).toMatchObject({ insetLeft: "20px" });
    expect(node().layout?.insetRight).toBeUndefined();
    expect(rect().x).toBe(22);

    // The Center axis' start field is the offset (both sides move).
    host.applyPosition(record, { kind: "inset", side: "top", value: "-8" });
    expect(layoutOf(node())).toMatchObject({
      insetTop: "-8px",
      insetBottom: "8px",
      alignSelf: "unsafe center",
    });
  });

  it("Left+Right drops the axis' size; leaving it fixes the drawn size; Fill pins four sides at 0", async () => {
    const { node, rect, host, record } = await open();
    host.applyAbsolute(record, true);
    host.applyPosition(record, {
      kind: "constraint",
      axis: "x",
      constraint: "both",
    });
    expect(node().sizing.width).toBeUndefined();
    const stretched = rect();
    // Padding box 396 (border 2): Left 6 · Right 0 (the drawn box) → 390, stretched, no width.
    expect(stretched).toMatchObject({ x: 8, width: 390 });
    host.applyPosition(record, { kind: "inset", side: "right", value: "" });
    expect(node().sizing.width).toEqual({
      kind: "set",
      value: Math.round(stretched.width),
    });
    expect(rect()).toMatchObject({ x: stretched.x, width: stretched.width });

    host.applyPosition(record, { kind: "fill" });
    expect(layoutOf(node())).toMatchObject({
      insetLeft: "0px",
      insetRight: "0px",
      insetTop: "0px",
      insetBottom: "0px",
    });
    expect(rect()).toMatchObject({ x: 2, y: 2, width: 396, height: 296 });
  });

  // Live 2026-10-20 (Phase 7): on a breakpoint layer, Left+Right wrote a sizing mask — refused by
  // the document (`SIZING_MASK_FORBIDDEN`), so the pin did nothing.
  it("Left+Right on a breakpoint layer clears the size with null (auto), not a mask", async () => {
    const { workspace, node, host, record } = await open();
    host.applyAbsolute(record, true);
    workspace.setBreakpoint("tablet");
    const tabletRecord = workspace.root.recordsOfSource(BOX)[0];
    workspace.selectRecords([tabletRecord]);
    const tabletHost = createCatalogStylesHost(workspace);
    expect(
      tabletHost.applyPosition(tabletRecord, {
        kind: "constraint",
        axis: "x",
        constraint: "both",
      }),
    ).toBe(null);
    expect(node().responsive?.tablet?.sizing?.width).toEqual({
      kind: "set",
      value: null,
    });
    expect(node().responsive?.tablet?.layout?.insetRight).toBeDefined();
  });

  it("an absolute box's Center axis refuses a margin (사용자 결정 2); the other axis takes one", async () => {
    const { graph, host, record } = await open();
    host.applyAbsolute(record, true);
    host.applyPosition(record, {
      kind: "constraint",
      axis: "x",
      constraint: "center",
    });
    const revision = graph.revision;
    host.updateStyle("marginLeft", "10px");
    expect(graph.revision).toBe(revision);
    host.updateStyle("marginTop", "4px");
    expect(graph.revision).toBe(revision + 1);
  });

  it("emptying a pinned side that cannot let go writes nothing and reports no error", async () => {
    const { graph, host, record } = await open();
    host.applyAbsolute(record, true);
    const revision = graph.revision;
    expect(
      host.applyPosition(record, { kind: "inset", side: "left", value: "" }),
    ).toBe(null);
    expect(graph.revision).toBe(revision);
  });

  /**
   * ADR-275 Phase 6 (사용자 결정 2026-10-20 — sticky 허용): Sticky puts the box back in the flow at
   * Top 0 (its absolute past's insets and Center alignment go); each side is its own stick distance
   * and an empty side is auto. Relative · Absolute leave it as they leave any flow box.
   */
  it("Sticky: back in the flow at Top 0; each side on its own; Relative · Absolute leave it", async () => {
    const { graph, node, rect, host, record } = await open();
    host.applyAbsolute(record, true);
    host.applyPosition(record, {
      kind: "constraint",
      axis: "x",
      constraint: "center",
    });
    host.applyPosition(record, {
      kind: "constraint",
      axis: "y",
      constraint: "end",
    });
    expect(host.applyPosition(record, { kind: "sticky" })).toBe(null);
    expect(layoutOf(node())).toEqual({ position: "sticky", insetTop: "0px" });
    // In flow after NEXT (absolute on fronted it): border 2 + padding 10 + NEXT 40.
    expect(rect()).toMatchObject({ x: 8, y: 52 });
    expect(host.readSelectedTarget().style).toMatchObject({
      position: "sticky",
      top: "0px",
    });

    const revision = graph.revision;
    expect(host.applyPosition(record, { kind: "sticky" })).toBe(null);
    expect(graph.revision).toBe(revision);

    host.applyPosition(record, {
      kind: "stickyInset",
      side: "bottom",
      value: "8",
    });
    host.applyPosition(record, { kind: "stickyInset", side: "top", value: "" });
    expect(layoutOf(node())).toEqual({
      position: "sticky",
      insetBottom: "8px",
    });
    const unchanged = graph.revision;
    expect(
      host.applyPosition(record, {
        kind: "stickyInset",
        side: "left",
        value: "auto",
      }),
    ).toBe(null);
    expect(graph.revision).toBe(unchanged);
    expect(() =>
      host.applyPosition(record, {
        kind: "stickyInset",
        side: "left",
        value: "1em",
      }),
    ).toThrow();

    const flow = { ...rect() };
    expect(host.applyAbsolute(record, true)).toBe(null);
    expect(node().layout?.position).toEqual({ kind: "set", value: "absolute" });
    expect(rect()).toMatchObject({ x: flow.x, y: flow.y });
    host.applyPosition(record, { kind: "sticky" });
    expect(host.applyAbsolute(record, false)).toBe(null);
    expect(node().layout?.position).toBeUndefined();
  });

  /**
   * ADR-275 Phase 7 (사용자 결정 6): Fixed keeps the drawn box, its insets from the page viewport
   * (the body's origin, the breakpoint's screen 1000 × 800); a side typed moves the axis there in the
   * viewport; Absolute and back put it in the parent again.
   */
  it("Fixed: the drawn box kept, insets from the page viewport; a typed side is in the viewport", async () => {
    const { workspace, node, rect, host, record } = await open();
    const rowRecord = workspace.root.recordsOfSource(ROW)[0];
    const row = workspace.root.getGeometry([rowRecord]).get(rowRecord)!;
    const before = { ...rect() };
    expect(host.applyAbsolute(record, true, "fixed")).toBe(null);
    expect(layoutOf(node())).toMatchObject({
      position: "fixed",
      insetLeft: `${row.x + before.x}px`,
      insetTop: `${row.y + before.y}px`,
    });
    expect(rect()).toMatchObject({ x: before.x, y: before.y, width: 390 });
    expect(host.readSelectedTarget().style.position).toBe("fixed");

    host.applyPosition(record, { kind: "inset", side: "right", value: "10" });
    expect(layoutOf(node())).toMatchObject({ insetRight: "10px" });
    expect(node().layout?.insetLeft).toBeUndefined();
    expect(row.x + rect().x).toBe(1000 - 10 - 390);

    host.applyPosition(record, {
      kind: "constraint",
      axis: "y",
      constraint: "center",
    });
    expect(row.y + rect().y).toBe(
      (800 - 50) / 2 + (row.y + before.y - (800 - 50) / 2),
    );

    const fixedPlace = { ...rect() };
    expect(host.applyAbsolute(record, true, "absolute")).toBe(null);
    expect(node().layout?.position).toEqual({ kind: "set", value: "absolute" });
    expect(rect()).toMatchObject({ x: fixedPlace.x, y: fixedPlace.y });
  });

  it("an axis is never empty — pressing its last pin keeps it, a centre press toggles back to start", () => {
    expect(catalogNextAxisConstraint("start", "start")).toBe("start");
    expect(catalogNextAxisConstraint("start", "end")).toBe("both");
    expect(catalogNextAxisConstraint("both", "start")).toBe("end");
    expect(catalogNextAxisConstraint("both", "end")).toBe("start");
    expect(catalogNextAxisConstraint("end", "start")).toBe("both");
    expect(catalogNextAxisConstraint("center", "end")).toBe("end");
    expect(catalogNextAxisConstraint("center", "center")).toBe("start");
    expect(catalogNextAxisConstraint("end", "center")).toBe("center");
  });
});
