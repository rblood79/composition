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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { catalogDomStyle } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-275 Phase 6 (사용자 결정 2026-10-20 — sticky 허용): an authored `layout.position: sticky` node
 * reaches both consumers — the engine's constraints in its scroll container (Canvas), the DOM's
 * `position: sticky` + `top` (Preview) — and paints over its in-flow siblings on the Canvas (CSS
 * positioned layer) without a z-index.
 */
const BODY = "project:node:home-body" as NodeId;
const SCROLL = "project:node:scroll" as NodeId;
const STICKY = "project:node:sticky" as NodeId;
const ITEMS = ["a", "b", "c"].map(
  (key) => `project:node:item-${key}` as NodeId,
);

const set = <T>(value: T) => ({ kind: "set" as const, value });
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
        projectId: "project:project:adr275-sticky" as EntryId<"project">,
        name: "Sticky",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr275-sticky-${Math.random()}`),
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
        frame(SCROLL, {
          children: [STICKY, ...ITEMS],
          layout: {
            display: set("flex"),
            flexDirection: set("column"),
          },
          visual: { overflow: set("scroll") },
          sizing: { width: set(200), height: set(100) },
        }),
        frame(STICKY, {
          layout: {
            position: set("sticky"),
            insetTop: set("0px"),
            flexShrink: set("0"),
          },
          sizing: { height: set(20) },
        }),
        ...ITEMS.map((id) => frame(id, {
            layout: { flexShrink: set("0") },
            sizing: { height: set(50) },
          })),
      ],
      rootIds: [SCROLL],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const recordOf = (id: NodeId) => root.recordsOfSource(id)[0];
  return { workspace, root, recordOf };
}

describe("ADR-275 Phase 6 — an authored sticky node", () => {
  it("the engine sticks it at Top 0 in its scroll container; the DOM gets position sticky + top", async () => {
    const { root, recordOf } = await open();
    const sticky = recordOf(STICKY);
    expect(root.getLayoutInput(sticky)).toMatchObject({
      position: "sticky",
      insetTop: "0px",
    });
    const constraints = root.getStickyConstraints().get(sticky);
    expect(constraints?.top).toBe(0);
    expect(constraints?.owner).toBe(recordOf(SCROLL));
    // In flow: the items follow it.
    expect(
      root.getGeometry([recordOf(ITEMS[0])]).get(recordOf(ITEMS[0]))?.y,
    ).toBe((root.getGeometry([sticky]).get(sticky)?.y ?? 0) + 20);
    expect(catalogDomStyle(root.domInputs.get(sticky)!)).toMatchObject({
      position: "sticky",
      top: "0px",
    });
  });

  it("the Canvas node carries the constraints and paints after its in-flow siblings (no z-index)", async () => {
    const { root, recordOf } = await open();
    const scene = new CatalogCanvasScene(root);
    try {
      scene.sync();
      const data = getSkiaNode(recordOf(STICKY))!;
      expect(data.sticky?.top).toBe(0);
      expect(data.zIndex).toBeUndefined();
    } finally {
      scene.dispose();
    }
  });

  // Live 2026-10-20: set on a bound scene, the box kept its tree slot (only its subtree was spliced
  // in place) and painted under the items scrolled over it.
  it("made sticky on a bound scene, it moves to the positioned layer; made static, back", async () => {
    const { workspace, root, recordOf } = await open();
    const target = { kind: "node" as const, id: STICKY };
    workspace.execute(
      setFields({
        targets: [target],
        layout: { position: { kind: "remove" }, insetTop: { kind: "remove" } },
      }),
    );
    const scene = new CatalogCanvasScene(root);
    const order = () =>
      scene.stream.childElementIds.get(recordOf(SCROLL))?.at(-1);
    try {
      scene.sync();
      expect(order()).toBe(recordOf(ITEMS[2]));
      workspace.execute(
        setFields({
          targets: [target],
          layout: { position: set("sticky"), insetTop: set("0px") },
        }),
      );
      scene.sync();
      expect(order()).toBe(recordOf(STICKY));
      workspace.execute(
        setFields({ targets: [target], layout: { position: { kind: "remove" } } }),
      );
      scene.sync();
      expect(order()).toBe(recordOf(ITEMS[2]));
    } finally {
      scene.dispose();
    }
  });
});
