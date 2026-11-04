import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeId,
  EntryId,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const bodyId = (p: number) => `project:node:body${p}` as NodeId;
const leafId = (p: number, i: number) => `project:node:n${p}-${i}` as NodeId;
async function fixture(pages: number) {
  const library = await buildCodeCatalogLibrary();
  const doc = newCatalogProjectDocument({
    projectId: "project:project:filtered",
    name: "Filtered scene",
  });
  const project = doc.entries[doc.projectId];
  if (project.kind !== "project") throw Error("project required");
  const pageIds: EntryId<"page">[] = [];
  const entries = { ...doc.entries };
  delete entries["project:page:home"];
  delete entries["project:node:home-body"];
  const types = [
    "Button",
    "Checkbox",
    "Select",
    "DatePicker",
    "TextField",
    "GridList",
  ];
  for (let p = 0; p < pages; p++) {
    const pageId = `project:page:p${p}` as EntryId<"page">;
    pageIds.push(pageId);
    entries[pageId] = {
      kind: "page",
      id: pageId,
      name: `Page ${p}`,
      route: `/p${p}`,
      children: [bodyId(p)],
    };
    const children: NodeId[] = [];
    const body: NodeEntry = {
      kind: "node",
      id: bodyId(p),
      definitionId: "lib:definition:type-body",
      children,
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    entries[body.id] = body;
    for (let i = 0; i < 12; i++) {
      const id = leafId(p, i);
      children.push(id);
      entries[id] = {
        ...body,
        id,
        children: [],
        definitionId: catalogPaletteDefinitionId(
          library,
          types[i % types.length],
        )!,
      };
    }
  }
  entries[doc.projectId] = { ...project, pageIds };
  return new CatalogWorkspace(
    new CatalogGraph({ ...doc, entries }, library),
    new CatalogStorage(indexedDB, `filtered-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
}

describe("Canvas page filter ownership", () => {
  it.each([1, 10, 50])(
    "%i page 문서에서 표시한 page만 geometry·등록·구독한다",
    async (pages) => {
      const workspace = await fixture(pages);
      const root = workspace.root;
      const original = root.getGeometry.bind(root);
      const geometryIds: string[][] = [];
      vi.spyOn(root, "getGeometry").mockImplementation((ids) => {
        const list = [...ids];
        geometryIds.push(list);
        return original(list);
      });
      const subscribe = vi.spyOn(root, "subscribeCanvas");
      const scene = new CatalogCanvasScene(root, (roots) => roots.slice(0, 1));
      try {
        const drawn = new Set(scene.stream.subtreeSpans.keys());
        expect(drawn.size).toBe(141);
        expect(subscribe.mock.calls.map(([id]) => id).sort()).toEqual(
          [...drawn].sort(),
        );
        // The initial bulk geometry read has the same ownership boundary.
        expect(geometryIds[0].sort()).toEqual([...drawn].sort());
        const hidden = root.recordsOfSource(leafId(pages > 1 ? 1 : 0, 0))[0];
        if (pages > 1) expect(getSkiaNode(hidden)).toBeUndefined();
      } finally {
        scene.dispose();
        workspace.dispose();
      }
    },
  );

  it("필터 밖 수정은 재등록하지 않고, page 전환·구조 추가·Undo·Open이 최신 상태를 그린다", async () => {
    const workspace = await fixture(3);
    const root = workspace.root;
    let active = 0;
    const scene = new CatalogCanvasScene(root, (roots) => [roots[active]]);
    const old = root.recordsOfSource(leafId(0, 0))[0];
    try {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: leafId(1, 0) }],
          props: { children: { kind: "set", value: "Updated offscreen" } },
        }),
      );
      expect(scene.sync().kind).toBe("unchanged");
      active = 1;
      expect(scene.sync().kind).toBe("rebound");
      expect(getSkiaNode(old)).toBeUndefined();
      const owner = root.recordsOfSource(leafId(1, 2))[0];
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: leafId(1, 2) }],
          props: { isOpen: { kind: "set", value: true } },
        }),
      );
      scene.sync();
      const portal = [...root.canvasInputs.values()].find(
        (n) => n.ruleId === "Popover" && n.instancePath.includes(leafId(1, 2)),
      )!;
      expect(portal).toBeDefined();
      expect(scene.stream.boundsMap.get(portal.id)?.height).toBeGreaterThan(0);
      expect(scene.stream.boundsMap.has(owner)).toBe(true);
      const entry: NodeEntry = {
        kind: "node",
        id: "project:node:added",
        definitionId: "lib:definition:type-frame",
        children: [],
        props: {},
        sizing: {},
        visual: {},
        descendantOverrides: [],
      };
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: bodyId(1) },
          entries: [entry],
          rootIds: [entry.id],
          newId: workspace.newId,
        }),
      );
      scene.sync();
      const id = root.recordsOfSource(entry.id)[0];
      expect(scene.stream.boundsMap.has(id)).toBe(true);
      workspace.undo();
      scene.sync();
      expect(scene.stream.boundsMap.has(id)).toBe(false);
      const before = [...scene.stream.boundsMap];
      scene.rebuild();
      expect([...scene.stream.boundsMap]).toEqual(before);
    } finally {
      scene.dispose();
      workspace.dispose();
    }
  });
});
