// @vitest-environment jsdom
/**
 * S2 1.8.0 ColorSwatch `rounding` (2026-10-10): the swatch's corner — `full` (our box's shape
 * before, the default), `default` (S2 `sm`), `none` (square). DOM carries `data-rounding` (the
 * generated sheet's `[data-rounding]` blocks), the Canvas box paints the same radius from the
 * rule's `containerVariants` (S2 itself: borderRadius sm · none · full — ColorSwatch.tsx).
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

const OWNER = "project:node:swatch" as NodeId;

async function open(props: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:swatch-rounding" as const,
        name: "Swatch rounding",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `swatch-rounding-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "ColorSwatch");
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
    box?: { borderRadius?: number | number[] };
  };
  const geometry = root.getGeometry([record.id]).get(record.id) as {
    width: number;
    height: number;
  };
  canvas.dispose();
  return { definitionId, html, painted, geometry };
}

const radiusOf = (painted: {
  box?: { borderRadius?: number | number[] };
}): number | undefined => {
  const value = painted.box?.borderRadius;
  return Array.isArray(value) ? value[0] : value;
};

describe("S2 ColorSwatch rounding", () => {
  it("the Design panel offers Rounding — full (the swatch's shape before) by default", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "ColorSwatch").rounding,
    ).toMatchObject({ kind: "enum", default: "full" });
  });

  it("unset: the swatch stays a circle (data-rounding full, Canvas radius full)", async () => {
    const { html, painted, geometry } = await open({});
    expect(html).toContain('data-rounding="full"');
    expect(radiusOf(painted)).toBe(9999);
    // The rounding variants live on the rule's top level: under structure.composition they flip
    // `catalogSizeAxisSkip`'s ownsContainerBox and the per-size height stops reaching the Canvas
    // (live: a 2×2 swatch). The swatch is square (S2 size × size — the DOM sheet's aspect-ratio).
    expect(geometry.height).toBe(28);
    expect(geometry.width).toBe(28);
  });

  it.each([
    ["none", 0],
    ["default", 4],
  ] as const)(
    "rounding %s: DOM data-rounding and the Canvas box radius %s",
    async (rounding, radius) => {
      const { html, painted } = await open({ rounding });
      expect(html).toContain(`data-rounding="${rounding}"`);
      expect(radiusOf(painted)).toBe(radius);
    },
  );
});

describe("S2 ColorSwatch colorName (2026-10-11)", () => {
  it("the Design panel offers Color Name; the DOM swatch's accessible name is it (RAC aria-label), the Canvas box unchanged", async () => {
    const plain = await open({ color: "#ff0000" });
    const named = await open({ color: "#ff0000", colorName: "Pantone 7621 C" });
    expect(
      catalogSemanticContracts(named.definitionId, "ColorSwatch").colorName,
    ).toMatchObject({ kind: "string" });
    expect(named.html).toContain('aria-label="Pantone 7621 C"');
    expect(plain.html).not.toContain("Pantone");
    expect(named.html).not.toMatch(/colorname=/i);
    expect(named.geometry).toEqual(plain.geometry);
    expect(radiusOf(named.painted)).toBe(radiusOf(plain.painted));
  });
});
