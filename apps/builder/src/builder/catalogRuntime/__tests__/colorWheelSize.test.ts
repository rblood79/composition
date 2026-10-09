// @vitest-environment jsdom
/**
 * S2 1.8.0 ColorWheel `size` (2026-10-10): the wheel's outer diameter in px (S2: default 192,
 * floor 175, track 24; ours: default 180 — the Canvas M box before — track 26, the shared
 * wrapper's 100/74 ring ratio). DOM gets real RAC radii (`outerRadius`/`innerRadius` — the
 * catalog path passed none before, so RAC drew nothing), the Canvas box is the same square.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:wheel" as NodeId;

async function open(props: Record<string, string | number>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:wheel-size" as const,
        name: "Wheel size",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `wheel-size-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "ColorWheel");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  const box = root.getGeometry([record.id]).get(record.id) as {
    width: number;
    height: number;
  };
  return { definitionId, html, box };
}

describe("S2 ColorWheel size", () => {
  it("the Design panel offers Size (px)", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "ColorWheel").size,
    ).toMatchObject({ kind: "number" });
  });

  it("unset: the wheel keeps its box (180 — the Canvas M box before) in both consumers", async () => {
    const { html, box } = await open({});
    expect(html).toMatch(/width:180px;height:180px/);
    expect(box.width).toBe(180);
    expect(box.height).toBe(180);
  });

  it("size 240: the wheel is a 240 square in both consumers (no raw size on the DOM)", async () => {
    const { html, box } = await open({ size: 240 });
    expect(html).toMatch(/width:240px;height:240px/);
    expect(html).not.toContain('size="240"');
    expect(box.width).toBe(240);
    expect(box.height).toBe(240);
  });

  it("size under the S2 floor is lifted to 175", async () => {
    const { box } = await open({ size: 100 });
    expect(box.width).toBe(175);
    expect(box.height).toBe(175);
  });
});
