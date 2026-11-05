/**
 * An open overlay's arrow is its overlay's surface (RAC starter `OverlayArrow svg { fill:
 * var(--overlay-background); stroke: var(--border-color) }`): both consumers paint it from the
 * overlay's rule paint — its variant included — not from a fixed color of the manual sheet.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

async function openOverlay(type: string, bodyType: string, variant?: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:overlay-arrow" as EntryId<"project">,
        name: "Overlay arrow",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `overlay-arrow-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  const command = catalogPaletteInsertCommand(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: BODY }),
      newId: workspace.newId,
    },
    type,
    { isOpen: true },
  );
  workspace.execute(command!);
  const root = workspace.root;
  const body = [...root.canvasInputs.values()].find(
    (n) => root.typeOf(n) === bodyType,
  )!;
  if (variant)
    workspace.execute(
      (
        await import("../../../../../../packages/shared/src/catalog/commands")
      ).setFields({
        targets: [workspace.positionOfRecord(body.id)!.target],
        props: { variant: { kind: "set", value: variant } },
      }),
    );
  const arrow = [...root.canvasInputs.values()].find(
    (n) => n.bindingId === "overlayarrow" && !n.hidden,
  )!;
  return { workspace, root, body: root.canvasInputs.get(body.id)!, arrow };
}

describe("overlay arrow = its overlay's rule paint", () => {
  it.each([
    ["Tooltip", "Tooltip", undefined, "{color.neutral-subtle}", undefined],
    [
      "Tooltip",
      "Tooltip",
      "informative",
      "{color.informative-subtle}",
      undefined,
    ],
    [
      "Popover",
      "Popover",
      undefined,
      "{color.popover-background}",
      "{color.popover-outline}",
    ],
    ["Tooltip", "Tooltip", "negative", "{color.negative-subtle}", undefined],
  ])(
    "%s (%s variant %s): fill %s · stroke %s",
    async (type, bodyType, variant, fill, stroke) => {
      const { root, arrow } = await openOverlay(type, bodyType, variant);
      expect(arrow.derivedProps?._arrowFill).toBe(fill);
      expect(arrow.derivedProps?._arrowStroke).toBe(stroke);
    },
  );

  it("the Canvas arrow fills with the body's color and the DOM svg with its variable", async () => {
    const { root, body, arrow } = await openOverlay("Tooltip", "Tooltip");
    const scene = new CatalogCanvasScene(root);
    try {
      const bodyFill = Array.from(getSkiaNode(body.id)!.box!.fillColor!);
      // (The arrow node holds the converted shape: a box around the path.)
      const path = getSkiaNode(arrow.id)!.children![0].children![0].path!;
      const arrowFill = Array.from(path.fillColor as Float32Array);
      expect(arrowFill).toEqual(bodyFill);
    } finally {
      scene.dispose();
    }
    const html = renderToStaticMarkup(renderCatalogDom(root, arrow.id));
    expect(html).toContain("fill:var(--bg-muted)");
    expect(html).toContain("stroke:none");
  });

  it("a Popover arrow strokes with the body's border in both consumers", async () => {
    const { root, arrow } = await openOverlay("Popover", "Popover");
    expect(arrow.derivedProps?._arrowStrokeWidth).toBe(1);
    const html = renderToStaticMarkup(renderCatalogDom(root, arrow.id));
    expect(html).toContain("fill:var(--popover-background)");
    expect(html).toContain("stroke:var(--popover-outline)");
    expect(html).toContain("stroke-width:1");
  });
});
