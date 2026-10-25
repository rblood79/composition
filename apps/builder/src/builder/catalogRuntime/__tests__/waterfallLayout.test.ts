import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
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
import { catalogWaterfallLanes } from "../../../../../../packages/shared/src/catalog/runtime/waterfall";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-26 (사용자 「RAC photos · S2 CardView 의 waterfall(masonry) 누락 — 적용해」): a CardView ·
 * GridList with `layout: waterfall` keeps its grid columns and stacks each item under the shortest
 * column (RAC `WaterfallLayout`); the container is as tall as its longest column. The Canvas engine
 * does it from `grid-template-rows: masonry`, the DOM from `catalogWaterfallLanes` — same rule.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const id = (name: string) => `project:node:${name}` as NodeId;
const HEIGHTS = [100, 40, 30, 50];

const card = (name: string, height: number) =>
  ({
    kind: "node",
    id: id(name),
    definitionId: "lib:definition:type-frame",
    children: [],
    props: {},
    visual: {},
    sizing: { height: set(height) },
    descendantOverrides: [],
  }) as unknown as NodeEntry;

async function open(type: "CardView" | "GridList", layout: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:waterfall" as EntryId<"project">,
        name: "Waterfall",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `waterfall-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const cards = HEIGHTS.map((h, i) => card(`c${i}`, h));
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: id("view"),
          definitionId: `lib:definition:type-${type}`,
          children: cards.map((c) => c.id),
          props: { layout: set(layout) },
          visual: {
            gap: set(10),
            width: set(210),
            paddingTop: set(0),
            paddingBottom: set(0),
          },
          layout: {
            display: set("grid"),
            gridTemplateColumns: set("repeat(2, minmax(0, 1fr))"),
            gridTemplateRows: set("auto"),
          },
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
        ...cards,
      ],
      rootIds: [id("view")],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const rect = (name: string) => {
    const record = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === id(name),
    )!;
    return root.getGeometry([record.id]).get(record.id)!;
  };
  return { workspace, rect };
}

describe("waterfall layout", () => {
  it("catalogWaterfallLanes = the shortest column, a 1px tie → the leftmost", () => {
    const lanes = catalogWaterfallLanes(
      HEIGHTS.map((h) => [0, h, 0] as const),
      2,
      10,
    );
    expect(lanes).toEqual([0, 1, 1, 1]);
    expect(
      catalogWaterfallLanes(
        [
          [0, 40, 0],
          [0, 40.6, 0],
          [0, 10, 0],
        ],
        2,
        0,
      ),
    ).toEqual([0, 1, 0]);
  });

  for (const type of ["CardView", "GridList"] as const) {
    it(`${type} waterfall: Canvas stacks items under the shortest column`, async () => {
      const { rect } = await open(type, "waterfall");
      const left = rect("c0").x;
      const right = rect("c1").x;
      expect(right).toBeGreaterThan(left);
      // c0 100 left · c1 40 right · c2 → right (50 < 110) · c3 → right (90 < 110)
      expect(rect("c2").x).toBe(right);
      expect(rect("c2").y - rect("c1").y).toBe(50);
      expect(rect("c3").x).toBe(right);
      expect(rect("c3").y - rect("c1").y).toBe(90);
      const view = rect("view");
      // right column 40 + 10 + 30 + 10 + 50 = 140 > left 100
      expect(view.height - (rect("c1").y - view.y) * 2).toBeCloseTo(140, 0);
    });

    it(`${type} grid: rows stay a grid (no waterfall)`, async () => {
      const { rect } = await open(type, "grid");
      expect(rect("c2").x).toBe(rect("c0").x);
      expect(rect("c2").y - rect("c0").y).toBe(110);
    });
  }

  it("switching layout to waterfall re-lays the Canvas without a reload", async () => {
    const { workspace, rect } = await open("CardView", "grid");
    expect(rect("c2").x).toBe(rect("c0").x);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("view") }],
        props: { layout: set("waterfall") },
      }),
    );
    expect(rect("c2").x).toBe(rect("c1").x);
  });
});
