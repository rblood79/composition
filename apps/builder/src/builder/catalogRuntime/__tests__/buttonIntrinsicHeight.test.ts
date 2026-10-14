import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  insertNodes,
  setFields,
  setFillSizing,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import type { CatalogTextMeasure } from "../compositionRoot";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

const BODY = "project:node:home-body" as NodeId;
const CHILD = "project:node:button-height" as NodeId;
const types = [
  "Button",
  "IconButton",
  "ToggleButton",
  "ToggleButtonGroup",
  "ButtonGroup",
  "Toolbar",
  "Menu",
] as const;

describe("button intrinsic height across Body layout changes", () => {
  it.each(
    types.flatMap((type) =>
      ["row", "column"].map((direction) => ({ type, direction })),
    ),
  )(
    "$type keeps its default height in flex $direction",
    async ({ type, direction }) => {
      const library = await buildCodeCatalogLibrary();
      const options = {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
        textMeasure: measure,
      };
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:button-height",
            name: "Button height",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `button-height-${Math.random()}`),
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
      const height = () => workspace.root.getGeometry([id]).get(id)!.height;
      const initial = height();
      const check = (expected: number) => {
        scene.sync();
        expect(height()).toBeCloseTo(expected, 4);
        expect(getSkiaNode(id)!.height).toBeCloseTo(expected, 4);
      };
      let fresh: CatalogWorkspace | undefined;
      try {
        expect(initial).toBeGreaterThan(0);
        expect(initial).toBeLessThan(400);
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: BODY }],
            sizing: { height: { kind: "set", value: 400 } },
            layout: {
              display: { kind: "set", value: "flex" },
              flexDirection: { kind: "set", value: direction },
            },
          }),
        );
        check(initial);
        if (type === "ButtonGroup") {
          const dom = document.createElement("div");
          dom.innerHTML = renderToStaticMarkup(
            renderCatalogDom(workspace.root, id),
          );
          expect((dom.firstElementChild as HTMLElement).style.height).toBe(
            "fit-content",
          );
        }
        if (type !== "Menu")
          expect(workspace.root.getLayoutInput(id)?.height).toBe("fit-content");
        workspace.undo();
        check(initial);
        workspace.redo();
        check(initial);

        // Loading a saved instance must get the library default without a height override.
        fresh = new CatalogWorkspace(
          new CatalogGraph(workspace.runtime.graph.exportDocument(), library),
          new CatalogStorage(indexedDB, `button-height-load-${Math.random()}`),
          { ...options, engine: await nodeLayoutEngine() },
        );
        const [loaded] = fresh.root.recordsOfSource(CHILD);
        expect(
          fresh.root.getGeometry([loaded]).get(loaded)!.height,
        ).toBeCloseTo(initial, 4);
        if (type === "Menu") return; // MenuTrigger is display:contents; its Button owns the box.
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: CHILD }],
            sizing: { height: { kind: "set", value: 240 } },
          }),
        );
        check(240);
        workspace.undo();
        check(initial);
        workspace.execute(
          setFillSizing({
            targets: [{ kind: "node", id: CHILD }],
            axis: "height",
            value: { factor: 1 },
          }),
        );
        check(400);
        workspace.undo();
        check(initial);
        if (type !== "Toolbar") {
          for (const [size, expected] of Object.entries({
            XS: 20,
            S: 22,
            M: 30,
            L: 42,
            XL: 54,
          })) {
            workspace.execute(
              setFields({
                targets: [{ kind: "node", id: CHILD }],
                props: { size: { kind: "set", value: size } },
              }),
            );
            if (type === "IconButton") {
              // Its authored icon/label template metrics can exceed the type's line height.
              workspace.execute(
                setFields({
                  targets: [{ kind: "node", id: BODY }],
                  layout: { display: { kind: "set", value: "block" } },
                }),
              );
              const intrinsic = height();
              workspace.undo();
              check(intrinsic);
            } else check(expected);
          }
        }
      } finally {
        fresh?.dispose();
        scene.dispose();
        workspace.dispose();
      }
    },
  );
});
