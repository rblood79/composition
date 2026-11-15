import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogGridLayoutCells } from "../../../../../../packages/shared/src/catalog/runtime/gridLayoutCells";
import { catalogVirtualGridOptions } from "../../../../../../packages/shared/src/catalog/runtime/virtualGrid";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 G8 (사용자 결정 7) — a virtual-scrolled grid on the Canvas places its items where RAC's
 * `GridLayout` does at the list's width (the Preview's `Virtualizer` — `catalogVirtualGridOptions`):
 * the item width, each column's x and the first row's y. The grid follows its width (S2 CardView
 * drops a size two columns do not fit) and Undo gives the CSS grid back.
 */
const LIST = "project:node:list" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: "CardView" | "GridList", width: number) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:virtual-grid" as const,
        name: "Virtual grid",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `virtual-grid-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1600, height: 900 },
      autosaveSchedule: () => {},
      locale: "en-US",
    },
  );
  const list = {
    kind: "node",
    id: LIST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    // (GridList's palette origin is `stack` — the grid layout is the one a GridLayout places.)
    props: type === "GridList" ? { layout: set("grid") } : {},
    visual: {},
    sizing: { width: set(width), height: set(400) },
    descendantOverrides: [],
  } as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [list],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = () =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === LIST)!;
  const items = () =>
    record().children.filter((id) => {
      const type = root.typeOf(root.canvasInputs.get(id)!);
      return type === "Card" || type === "GridListItem";
    });
  const rects = () => {
    const own = root.getGeometry([record().id]).get(record().id)!;
    return items().map((id) => {
      const rect = root.getGeometry([id]).get(id)!;
      return { x: rect.x - own.x, y: rect.y - own.y, width: rect.width };
    });
  };
  return { workspace, root, record, rects };
}

describe("ADR-310 G8 — a virtual grid's Canvas items = RAC GridLayout", () => {
  const cases: ["CardView" | "GridList", number][] = [
    ["CardView", 700],
    ["CardView", 430],
    ["GridList", 900],
  ];
  for (const [type, width] of cases)
    it(`${type} ${width}: columns · x · first row as RAC places them; Undo restores the CSS grid`, async () => {
      const { workspace, root, record, rects } = await open(type, width);
      const before = rects();
      workspace.execute(setRowDisplay(LIST, { mode: "virtual" }));
      // (The `GridLayout` lays out in the scroll box's client width — inside the list's border.)
      const border = (root as unknown as { usedBorder(id: string): { left: number; right: number } })
        .usedBorder(record().id);
      const inner = width - border.left - border.right;
      const cells = catalogGridLayoutCells(
        inner,
        rects().length,
        catalogVirtualGridOptions(type, record().props, inner)!,
      );
      expect(rects()).toEqual(
        cells.cells.map((cell, index) => ({
          x: cell.x + border.left,
          // (Rows are as tall as their items — the first row starts at the vertical space.)
          y: index < cells.columns ? cell.y + border.left : expect.any(Number),
          width: cell.width,
        })),
      );
      expect(rects()).not.toEqual(before);
      workspace.undo();
      expect(rects()).toEqual(before);
    });
});
