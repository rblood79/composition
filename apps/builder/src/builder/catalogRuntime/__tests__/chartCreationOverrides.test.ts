import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  createChartInitialProps,
} from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { readPropSource } from "../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A palette Chart starts with only what differs from its origin (2026-11-16 /fix — every kind
 * listed ~30 Overrides the moment it was placed). The Chart origin is a composite whose values
 * live on its template root (`defaults: {}`), so comparing a creation prop with the definition's
 * defaults kept every one of them as the instance's own write.
 */
const BODY = "project:node:home-body" as NodeId;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

async function placeAll() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:chart-creation" as EntryId<"project">,
        name: "Chart creation",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `chart-creation-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Chart");
  const placed = CHART_DESCRIPTORS.map((descriptor, index) => {
    const id = `project:node:chart-${index}` as NodeId;
    const initial = createChartInitialProps(
      descriptor.chartType,
      descriptor.paletteId,
    ) as unknown as Record<string, unknown>;
    return {
      id,
      paletteId: descriptor.paletteId,
      initial,
      entry: {
        kind: "node" as const,
        id,
        definitionId,
        children: [],
        props: catalogCreationProps(
          workspace.runtime.graph,
          definitionId,
          "Chart",
          initial,
        ),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    };
  });
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: placed.map((item) => item.entry),
      rootIds: placed.map((item) => item.id),
      newId: workspace.newId,
    }),
  );
  return { graph: workspace.runtime.graph, placed };
}

describe("palette Chart creation props", () => {
  // (The origin is the direct Chart — `CHART_DEFAULT_PROPS`, grid off; the palette's cartesian kinds
  // turn the grid on.)
  it("a Bar Chart writes only its grid — the rest is its origin", async () => {
    const { graph, placed } = await placeAll();
    const bar = placed.find((item) => item.paletteId === "chart-bar")!;
    const node = graph.getEntry(bar.id);
    expect(node?.kind === "node" && Object.keys(node.props)).toEqual([
      "showGrid",
    ]);
  });

  it("a Line Chart writes only what differs from the bar origin", async () => {
    const { graph, placed } = await placeAll();
    const line = placed.find((item) => item.paletteId === "chart-line")!;
    const node = graph.getEntry(line.id);
    const keys = node?.kind === "node" ? Object.keys(node.props).sort() : [];
    expect(keys).toEqual(["chartType", "curve", "showGrid"]);
  });

  it("every kind shows its palette values, and each own write differs from what shows without it", async () => {
    const { graph, placed } = await placeAll();
    for (const { id, paletteId, initial } of placed) {
      const target = { kind: "node" as const, id };
      for (const [key, value] of Object.entries(initial)) {
        if (value === undefined) continue;
        const reading = readPropSource(graph, target, key);
        expect(same(reading.value, value), `${paletteId}.${key}`).toBe(true);
        if (reading.own)
          expect(
            same(reading.inherited.value, value),
            `${paletteId}.${key} kept though inherited`,
          ).toBe(false);
      }
    }
  });
});
