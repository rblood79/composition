// @vitest-environment jsdom
/**
 * S2 1.8.0 Divider `staticColor` on our Separator (2026-10-09): the DOM element carries
 * `data-static-color` (the sheet's rule) and the Canvas divider paints the same white · black line.
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:separator" as NodeId;

async function open(props: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:separator-static" as const,
        name: "Separator static",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `separator-static-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Separator");
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
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const painted = getSkiaNode(record.id) as unknown as {
    box?: { fillColor?: Record<string, number> };
  };
  canvas.dispose();
  return { definitionId, html, painted };
}

describe("S2 Separator staticColor", () => {
  it("the Design panel offers Static Color (auto · white · black)", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "Separator").staticColor,
    ).toMatchObject({ kind: "enum", default: "auto" });
  });

  it.each([
    ["white", "M", 1, 0.14],
    ["black", "L", 0, 0.85],
  ])(
    "%s · %s: DOM data-static-color and the Canvas line (rgb %s) at %s",
    async (staticColor, size, rgb, alpha) => {
      const { html, painted } = await open({ staticColor, size });
      expect(html).toContain(`data-static-color="${staticColor}"`);
      const color = painted.box!.fillColor!;
      expect([color[0], color[1], color[2]]).toEqual([rgb, rgb, rgb]);
      expect(color[3]).toBeCloseTo(alpha, 5);
    },
  );
});
