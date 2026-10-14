import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const CHILD = "project:node:button-width" as NodeId;
const types = [
  "Button",
  "IconButton",
  "ToggleButton",
  "ToggleButtonGroup",
  "ButtonGroup",
] as const;

describe("button intrinsic width across Body layout changes", () => {
  it.each(types)(
    "%s keeps its default width in a flex column",
    async (type) => {
      const library = await buildCodeCatalogLibrary();
      const options = {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      };
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:button-width",
            name: "Button width",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `button-width-${Math.random()}`),
        options,
      );
      const entry: NodeEntry = {
        kind: "node",
        id: CHILD,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [entry],
          rootIds: [CHILD],
          newId: workspace.newId,
        }),
      );
      const scene = new CatalogCanvasScene(workspace.root);
      const [id] = workspace.root.recordsOfSource(CHILD);
      const width = () => workspace.root.getGeometry([id]).get(id)!.width;
      const initial = width();
      const check = (expected: number) => {
        scene.sync();
        expect(width()).toBeCloseTo(expected, 4);
        expect(getSkiaNode(id)!.width).toBeCloseTo(expected, 4);
      };
      let fresh: CatalogWorkspace | undefined;
      try {
        expect(initial).toBeGreaterThan(0);
        expect(initial).toBeLessThan(1920);
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: BODY }],
            layout: {
              display: { kind: "set", value: "flex" },
              flexDirection: { kind: "set", value: "column" },
            },
          }),
        );
        check(initial);
        expect(workspace.root.getLayoutInput(id)?.width).toBe("fit-content");
        workspace.undo();
        check(initial);
        workspace.redo();
        check(initial);

        // Loading a saved instance must get the library default without a width override.
        fresh = new CatalogWorkspace(
          new CatalogGraph(workspace.runtime.graph.exportDocument(), library),
          new CatalogStorage(indexedDB, `button-width-load-${Math.random()}`),
          { ...options, engine: await nodeLayoutEngine() },
        );
        const [loaded] = fresh.root.recordsOfSource(CHILD);
        expect(fresh.root.getGeometry([loaded]).get(loaded)!.width).toBeCloseTo(
          initial,
          4,
        );
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: CHILD }],
            sizing: { width: { kind: "set", value: 240 } },
          }),
        );
        check(240);
        workspace.undo();
        check(initial);
      } finally {
        fresh?.dispose();
        scene.dispose();
        workspace.dispose();
      }
    },
  );
});
