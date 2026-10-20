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
 * ADR-275 Phase 7 (사용자 결정 6 — viewport = page root 원점 + 화면 크기, page 스크롤에 안 움직임): an
 * authored `position: fixed` node reaches both consumers — the engine places it in the page
 * viewport (Canvas), the DOM writes `position: fixed` (Preview) — and the Canvas draws it at its
 * page's level: out of its section, unmoved when the page scrolls.
 */
const BODY = "project:node:home-body" as NodeId;
const SECTION = "project:node:section" as NodeId;
const BAR = "project:node:bar" as NodeId;
const VIEWPORT = { width: 1000, height: 800 };

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
        projectId: "project:project:adr275-fixed" as EntryId<"project">,
        name: "Fixed",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr275-fixed-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: VIEWPORT,
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame(SECTION, {
          children: [BAR],
          layout: { marginTop: set("120px") },
          visual: {
            paddingTop: set(20),
            paddingLeft: set(30),
            overflow: set("hidden"),
          },
          sizing: { height: set(2000) },
        }),
        frame(BAR, {
          layout: {
            position: set("fixed"),
            insetLeft: set("0px"),
            insetRight: set("0px"),
            insetBottom: set("0px"),
          },
          sizing: { height: set(50) },
        }),
      ],
      rootIds: [SECTION],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const recordOf = (id: NodeId) => root.recordsOfSource(id)[0];
  /** A record's border-box origin from the page body's. */
  const inBody = (id: NodeId) => {
    let x = 0;
    let y = 0;
    for (
      let record = root.domInputs.get(recordOf(id));
      record && record.id !== recordOf(BODY);
      record = root.domInputs.get(record.parentId)
    ) {
      const rect = root.getGeometry([record.id]).get(record.id)!;
      x += rect.x;
      y += rect.y;
    }
    return { x, y };
  };
  return { workspace, root, recordOf, inBody };
}

describe("ADR-275 Phase 7 — an authored fixed node", () => {
  it("the engine places it at the viewport's bottom (not the section's); the DOM gets position fixed", async () => {
    const { root, recordOf, inBody } = await open();
    const bar = recordOf(BAR);
    expect(root.getLayoutInput(bar)).toMatchObject({ position: "fixed" });
    expect(inBody(BAR)).toEqual({ x: 0, y: VIEWPORT.height - 50 });
    expect(root.getGeometry([bar]).get(bar)).toMatchObject({
      width: VIEWPORT.width,
      height: 50,
    });
    expect(catalogDomStyle(root.domInputs.get(bar)!)).toMatchObject({
      position: "fixed",
      left: "0px",
      right: "0px",
      bottom: "0px",
    });
  });

  it("the Canvas draws it at the page's level with the page's scroll added back, and a page scroll leaves it", async () => {
    const { root, recordOf } = await open();
    const scene = new CatalogCanvasScene(root);
    try {
      scene.sync();
      const body = recordOf(BODY);
      const bar = recordOf(BAR);
      expect(getSkiaNode(bar)?.isFixed).toBe(true);
      expect(scene.stream.childElementIds.get(body)).toContain(bar);
      expect(
        scene.stream.childElementIds.get(recordOf(SECTION)) ?? [],
      ).not.toContain(bar);
      const bodyBox = scene.stream.boundsMap.get(body)!;
      const before = scene.stream.boundsMap.get(bar)!;
      expect(before.y - bodyBox.y).toBe(VIEWPORT.height - 50);
      // Not clipped away by its section (overflow hidden — the bar is outside it).
      expect(scene.stream.hitBoundsMap.get(bar)).toBeDefined();

      expect(scene.scrollable(body)).toBe(true);
      const section = scene.stream.boundsMap.get(recordOf(SECTION))!;
      scene.scrollBy(body, 0, 100);
      const scrolled = scene.sync();
      // Placed by the scroll's property node — nothing recorded again (the bar is left as is).
      expect(
        scrolled.kind === "patched" ? scrolled.update.subtreeBuilds : -1,
      ).toBe(0);
      expect(scene.stream.boundsMap.get(recordOf(SECTION))!.y).toBe(
        section.y - 100,
      );
      expect(scene.stream.boundsMap.get(bar)).toEqual(before);
    } finally {
      scene.dispose();
    }
  });

  it("an edit of the section or the bar on a bound scene keeps the bar at the page's level", async () => {
    const { workspace, root, recordOf } = await open();
    const scene = new CatalogCanvasScene(root);
    try {
      scene.sync();
      const bar = recordOf(BAR);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: SECTION }],
          visual: { paddingTop: set(40) },
        }),
      );
      scene.sync();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BAR }],
          sizing: { height: set(80) },
        }),
      );
      scene.sync();
      const body = recordOf(BODY);
      expect(scene.stream.childElementIds.get(body)).toContain(bar);
      // Drawn once, at the page's level — not again inside its section.
      expect(
        scene.stream.childElementIds.get(recordOf(SECTION)) ?? [],
      ).not.toContain(bar);
      expect(
        scene.stream.boundsMap.get(bar)!.y -
          scene.stream.boundsMap.get(body)!.y,
      ).toBe(VIEWPORT.height - 80);
    } finally {
      scene.dispose();
    }
  });
});
