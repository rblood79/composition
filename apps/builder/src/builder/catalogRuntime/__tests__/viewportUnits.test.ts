import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * `vw` · `vh` resolve against the breakpoint's viewport — the page the Preview iframe shows
 * (Blink `CSSToLengthConversionData::ViewportSize`). The engine's default (1920×1080) applied on
 * every breakpoint since the old pipeline's `setViewport` call was deleted (`78469745d`):
 * `min-width: 50vw` was 960 on a 390 page (2026-10-19 Chromium re-audit A-NEW-1).
 */
const set = <T>(value: T) => ({ kind: "set" as const, value });
const BODY = "project:node:home-body" as NodeEntry["id"];
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

async function minSizeAt(breakpoint: keyof typeof VIEWPORTS) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:vw" as const,
        name: "VW",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `vw-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: VIEWPORTS.desktop,
      viewportOf: (name) => VIEWPORTS[name as keyof typeof VIEWPORTS],
      autosaveSchedule: () => {},
      root: { breakpoint },
    },
  );
  const id = "project:node:f" as NodeEntry["id"];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(
            workspace.runtime.graph.library,
            "frame",
          ) as NodeEntry["definitionId"],
          children: [],
          props: {},
          visual: { minWidth: set("50vw"), minHeight: set("10vh") },
          sizing: { width: set(10), height: set(10) },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const record = [...workspace.root.canvasInputs.values()].find(
    (r) => r.sourceId === id,
  )!;
  const rect = workspace.root.getGeometry([record.id]).get(record.id)!;
  return [rect.width, rect.height];
}

describe("vw · vh = the breakpoint viewport", () => {
  it("mobile 390×844", async () => {
    expect(await minSizeAt("mobile")).toEqual([195, 84.4]);
  });
  it("tablet 768×1024", async () => {
    const [width, height] = await minSizeAt("tablet");
    expect(width).toBe(384);
    expect(height).toBeCloseTo(102.4, 3);
  });
});
