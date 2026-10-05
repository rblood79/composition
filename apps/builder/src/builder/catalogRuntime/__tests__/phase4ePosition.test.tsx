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
import { useToastStore } from "../../stores/toast";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

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
    expect(node().placement).toEqual({ kind: "absolute", x: 6, y: 10 });
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

    // Left / Top edit the placement (the other axis stays); non-px is refused.
    host.updateStyle("left", "30px");
    expect(node().placement).toEqual({ kind: "absolute", x: 30, y: 10 });
    expect(rect().x).toBe(32);
    useToastStore.setState({ toasts: [] } as never);
    const edited = graph.revision;
    host.updateStyle("top", "10%");
    expect(graph.revision).toBe(edited);
    expect(
      (useToastStore.getState() as { toasts: unknown[] }).toasts.length,
    ).toBeGreaterThan(0);

    expect(host.applyAbsolute(record, false)).toBe(null);
    expect(node().placement).toBe(undefined);
    expect(host.readSelectedTarget().style.position).toBe(undefined);

    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(node().placement).toBe(undefined);
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
        entries: [frame(THIRD, { sizing: { height: { kind: "set", value: 30 } } })],
        rootIds: [THIRD],
        newId: workspace.newId,
      }),
    );
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([BOX, NEXT, THIRD]);
    const records = [BOX, NEXT].map((id) => workspace.root.recordsOfSource(id)[0]);
    workspace.selectRecords(records);
    const host = createCatalogStylesHost(workspace);
    expect(host.applyAbsolute(records[0], true)).toBe(null);
    expect((graph.getEntry(ROW) as NodeEntry).children).toEqual([THIRD, BOX, NEXT]);
    expect((graph.getEntry(BOX) as NodeEntry).placement?.kind).toBe("absolute");
    expect((graph.getEntry(NEXT) as NodeEntry).placement?.kind).toBe("absolute");
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
