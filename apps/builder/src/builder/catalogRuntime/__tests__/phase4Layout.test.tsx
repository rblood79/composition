import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { catalogDomStyle } from "../domBinding";
import { CatalogStorage } from "../storage";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4a-3d: authored layout the Style panel writes — fill intent (ADR-224), insets on
 * all four edges, aspect ratio, max sizes — reaches the Rust layout input and the DOM style from
 * the same record fields, and a parent box edit re-projects its fill children.
 */
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const node = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId: "lib:definition:frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

async function scene(nodes: NodeEntry[], roots: string[]) {
  const projectId = "project:project:layout" as const;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 18,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "layout",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        name: "Main",
        route: "/",
        children: roots.map((id) => `project:node:${id}` as NodeEntry["id"]),
      },
      ...Object.fromEntries(nodes.map((item) => [item.id, item])),
    },
  };
  const graph = new CatalogGraph(document, createPencilFixtureLibrary());
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr248-phase4-layout-${roots.join("-")}`),
  );
  const root = new CatalogCompositionRoot(runtime, await nodeLayoutEngine(), {
    width: 1440,
    height: 900,
  });
  const idOf = (source: string) =>
    [...root.canvasInputs.values()].find(
      (item) => item.sourceId === `project:node:${source}`,
    )!.id;
  const rect = (source: string) =>
    root.getGeometry([idOf(source)]).get(idOf(source))!;
  return { root, idOf, rect };
}

describe("ADR-248 Phase 4a-3d authored layout", () => {
  it("projects fill intent against the parent box on both consumers and re-projects on a parent edit", async () => {
    const { root, idOf, rect } = await scene(
      [
        node("row", {
          children: ["project:node:fill", "project:node:fixed"],
          layout: { display: set("flex"), flexDirection: set("row") },
          sizing: { width: set(400), height: set(100) },
        }),
        node("fill", { fillSizing: { width: { factor: 1 } } }),
        node("fixed", { sizing: { width: set(100), height: set(20) } }),
      ],
      ["row"],
    );
    expect(rect("fill").width).toBeCloseTo(300, 1);
    const fill = root.canvasInputs.get(idOf("fill"))!;
    expect(fill.fillLayout).toMatchObject({
      flexGrow: 1,
      flexBasis: "0px",
      width: "auto",
    });
    expect(catalogDomStyle(fill)).toMatchObject({
      flexGrow: 1,
      flexBasis: "0px",
      width: "auto",
    });
    // Column parent: the width fill becomes a cross-axis stretch.
    root.dispatch("column", [
      {
        kind: "patchNodeLayout",
        id: "project:node:row",
        key: "flexDirection",
        write: set("column"),
      },
    ]);
    // A value edit: only the edited record and its fill dependents are re-planned.
    expect(root.metrics.traversedWholeInputGraph).toBe(false);
    expect(root.metrics.layoutInputVisits).toBeLessThanOrEqual(2);
    const after = root.canvasInputs.get(idOf("fill"))!;
    expect(after.fillLayout).toMatchObject({
      alignSelf: "stretch",
      width: "auto",
    });
    expect(after.fillLayout?.flexGrow).toBeUndefined();
    expect(rect("fill").width).toBeCloseTo(400, 1);
    expect(catalogDomStyle(after)).toMatchObject({ alignSelf: "stretch" });
  });

  it("lays out right/bottom insets, aspect ratio and max width in Rust and inlines the same CSS", async () => {
    const { root, idOf, rect } = await scene(
      [
        node("box", {
          children: [
            "project:node:pinned",
            "project:node:ratio",
            "project:node:capped",
          ],
          layout: { position: set("relative") },
          sizing: { width: set(400), height: set(300) },
        }),
        node("pinned", {
          layout: {
            position: set("absolute"),
            insetRight: set("10px"),
            insetBottom: set("20px"),
          },
          sizing: { width: set(50), height: set(30) },
        }),
        node("ratio", {
          visual: { aspectRatio: set("16 / 9") },
          sizing: { width: set(160) },
        }),
        node("capped", {
          sizing: { width: set(500), maxWidth: set(120), height: set(10) },
        }),
      ],
      ["box"],
    );
    expect(rect("pinned")).toMatchObject({
      x: 340,
      y: 250,
      width: 50,
      height: 30,
    });
    expect(rect("ratio").height).toBeCloseTo(90, 1);
    expect(rect("capped").width).toBeCloseTo(120, 1);
    expect(
      catalogDomStyle(root.canvasInputs.get(idOf("pinned"))!),
    ).toMatchObject({
      position: "absolute",
      right: "10px",
      bottom: "20px",
    });
    expect(
      catalogDomStyle(root.canvasInputs.get(idOf("ratio"))!).aspectRatio,
    ).toBe("16 / 9");
    expect(
      catalogDomStyle(root.canvasInputs.get(idOf("capped"))!).maxWidth,
    ).toBe("120px");
  });
});
