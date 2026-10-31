// @vitest-environment jsdom
/**
 * ADR-295 후속 C3 (사용자 「ColorSwatchPicker 견본 색을 칠하지 않음 · 컴포넌트 패널에 없다」):
 * - the Canvas paints a ColorSwatch with its color — its own `color`, else its ColorSwatchPickerItem's
 *   (RAC `ColorSwatchPickerItem` → `ColorSwatchContext`); before, every swatch was the rule's white box;
 * - an item's color edit repaints its swatch (the derived value's dependents);
 * - the Components panel offers ColorSwatch · ColorSwatchPicker (Forms, after the Color controls).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  detachInstances,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const ROOT = "project:node:swatch-root" as NodeId;

async function open(type: string, props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:swatch-paint" as const,
        name: "Swatch paint",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `swatch-paint-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
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
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  /** Each ColorSwatch's Canvas fill (`#rrggbb` + alpha) and its DOM inline background. */
  const paint = () => {
    const root = workspace.root;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const swatches = [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === "ColorSwatch",
    );
    const out = swatches.map((record) => {
      const box = (
        getSkiaNode(record.id) as unknown as {
          box?: { fillColor?: ArrayLike<number> };
        }
      ).box;
      const rgba = box?.fillColor ? Array.from(box.fillColor) : [];
      const hex = rgba
        .slice(0, 3)
        .map((channel) =>
          Math.round(channel * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
      return `#${hex}`;
    });
    canvas.dispose();
    const dom = [...root.domInputs.values()].find(
      (record) => record.sourceId === ROOT,
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, dom.id));
    const host = document.createElement("div");
    host.innerHTML = html;
    const domColors = [
      ...host.querySelectorAll<HTMLElement>(".react-aria-ColorSwatch"),
    ].map((element) => element.style.backgroundColor);
    return { canvas: out, dom: domColors };
  };
  return { workspace, paint };
}

describe("S2 ColorSwatch paint (Canvas = the swatch's color)", () => {
  it("a swatch's color: Canvas fill = the DOM's RAC inline color", async () => {
    const { paint } = await open("ColorSwatch", { color: "#3366ff" });
    const { canvas, dom } = paint();
    expect(canvas).toEqual(["#3366ff"]);
    expect(dom).toEqual(["rgb(51, 102, 255)"]);
  });

  it("a ColorSwatchPicker's swatches: each its item's color (RAC ColorSwatchContext)", async () => {
    const { paint } = await open("ColorSwatchPicker");
    const { canvas, dom } = paint();
    expect(canvas).toHaveLength(6);
    expect(new Set(canvas).size).toBe(6);
    expect(canvas).not.toContain("#ffffff");
    // The Canvas colors are the DOM's (RAC writes `rgba(r, g, b, a)` inline).
    const toHex = (css: string) => {
      const [r, g, b] = (css.match(/\d+/g) ?? []).map(Number);
      return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
    };
    expect(dom.map(toHex)).toEqual(canvas);
  });

  it("an item's color edit repaints its swatch", async () => {
    const { workspace, paint } = await open("ColorSwatchPicker");
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "ColorSwatchPickerItem",
    )!;
    const first = paint().canvas[0];
    workspace.execute(
      setFields({
        // (The item is a position of the picker instance's template — its descendant address.)
        targets: [workspace.positionOfRecord(item.id)!.target],
        props: { color: { kind: "set", value: "#123456" } },
        label: "Edit properties",
      }),
    );
    const after = paint().canvas[0];
    expect(first).not.toBe("#123456");
    expect(after).toBe("#123456");
  });
  it("a detached picker (owned item nodes): an item's color edit repaints its swatch", async () => {
    const { workspace, paint } = await open("ColorSwatchPicker");
    workspace.execute(detachInstances({ ids: [ROOT], newId: workspace.newId }));
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "ColorSwatchPickerItem",
    )!;
    expect(workspace.positionOfRecord(item.id)!.target.kind).toBe("node");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(item.id)!.target],
        props: { color: { kind: "set", value: "#123456" } },
        label: "Edit properties",
      }),
    );
    expect(paint().canvas[0]).toBe("#123456");
  });
});

describe("Components panel", () => {
  it("offers ColorSwatch · ColorSwatchPicker in Forms, after ColorWheel", () => {
    const items = getPaletteItems();
    const types = items.map((item) => item.type);
    const wheel = types.indexOf("ColorWheel");
    expect(types.slice(wheel + 1, wheel + 3)).toEqual([
      "ColorSwatch",
      "ColorSwatchPicker",
    ]);
    for (const type of ["ColorSwatch", "ColorSwatchPicker"])
      expect(items.find((item) => item.type === type)?.category).toBe("forms");
  });
});
