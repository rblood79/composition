// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「staticColor auto 를 S2 방식으로」 · 「칠한 단색 바탕도 포함」) S2 1.8.2
 * `style/tokens.ts` `autoStaticColor`: `staticColor="auto"` picks the black or the white scheme from the
 * background it sits on — CIE LCH lightness under 49.44 is white, else black. The background is the
 * nearest ancestor's: a static black · white scheme, an opaque solid fill (composition — S2 reads only
 * its containers), a layer container (`--s2-container-bg`), else the page base. No `staticColor` is the
 * theme paint. The Canvas paint and the DOM `data-static-color` read the one resolved scheme.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogFillLayer,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogAutoStaticTone } from "../../../../../../packages/shared/src/catalog/runtime/staticBackdrop";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const FRAME = "project:node:backdrop" as NodeId;
const fill = (color: string): CatalogFillLayer => ({
  id: "fill-1",
  kind: "color",
  color,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
});
const node = (
  id: string,
  definitionId: string,
  children: string[] = [],
  patch: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...patch,
  }) as NodeEntry;

/** A frame (with `frameFill`) holding one palette instance per entry of `types`. */
async function open(
  types: ReadonlyArray<{ type: string; staticColor?: string }>,
  frameFill?: string,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:static-auto" as const,
        name: "staticColor auto",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `static-auto-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const ids = types.map((_, index) => `project:node:item-${index}`);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(
          FRAME,
          catalogPaletteDefinitionId(library, "frame"),
          ids,
          frameFill ? { fills: [fill(frameFill)] } : {},
        ),
        ...types.map(({ type }, index) =>
          node(ids[index], catalogPaletteDefinitionId(library, type)),
        ),
      ],
      rootIds: [FRAME],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () =>
    ids.map((id) =>
      [...root.canvasInputs.values()].find(
        (record) =>
          record.parentId ===
            [...root.canvasInputs.values()].find(
              (each) => each.sourceId === FRAME || each.id === FRAME,
            )?.id &&
          (record.sourceId === id || record.id === id),
      )!,
    );
  types.forEach(({ staticColor }, index) => {
    if (staticColor === undefined) return;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(records()[index].id)!.target],
        props: { staticColor: { kind: "set", value: staticColor } } as never,
      }),
    );
  });
  const frameRecord = () =>
    [...root.canvasInputs.values()].find(
      (each) => each.sourceId === FRAME || each.id === FRAME,
    )!;
  /** What the Canvas draws: the box fill and its words' color (the Text part's paragraph). */
  const paintOf = (index: number) => {
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    try {
      const record = records()[index];
      const words = record.children
        .map((id) => root.canvasInputs.get(id)!)
        .find((child) => root.typeOf(child) === "Text" && !child.hidden);
      const box = getSkiaNode(record.id)?.box;
      return {
        fill: Array.from(box?.fillColor ?? []),
        text: Array.from(
          (words ? getSkiaNode(words.id)?.text?.color : undefined) ?? [],
        ),
      };
    } finally {
      binding.dispose();
    }
  };
  const domOf = (index: number) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(root, records()[index].id),
    );
    return host.firstElementChild as HTMLElement;
  };
  const setFrameFill = (color: string) =>
    workspace.execute(
      setWholeField({
        targets: [workspace.itemOfRecord(frameRecord().id)!.target],
        field: "fills",
        value: [fill(color)],
      }),
    );
  return { workspace, root, records, paintOf, domOf, setFrameFill };
}

describe("staticColor auto (S2 autoStaticColor)", () => {
  it("picks white under LCH lightness 49.44 and black at or over it", () => {
    expect(catalogAutoStaticTone("#ffffff")).toBe("black");
    expect(catalogAutoStaticTone("#f8f8f8ff")).toBe("black");
    expect(catalogAutoStaticTone("#111111")).toBe("white");
    expect(catalogAutoStaticTone("#1b1b1bff")).toBe("white");
    // (L* 49.0 · 50.0 — the boundary in between)
    expect(catalogAutoStaticTone("#757575")).toBe("white");
    expect(catalogAutoStaticTone("#777777")).toBe("black");
    expect(catalogAutoStaticTone("#0265dc")).toBe("white");
    expect(catalogAutoStaticTone("#ffeb3b")).toBe("black");
  });

  it("a Button on a dark solid fill paints the white scheme — Canvas and DOM", async () => {
    const { workspace, records, paintOf, domOf } = await open(
      [
        { type: "Button", staticColor: "auto" },
        { type: "Button", staticColor: "white" },
        { type: "Button", staticColor: "black" },
      ],
      "#111111ff",
    );
    try {
      expect(records()[0].derivedProps?.staticColor).toBe("white");
      expect(paintOf(0)).toEqual(paintOf(1));
      expect(paintOf(0)).not.toEqual(paintOf(2));
      expect(domOf(0).getAttribute("data-static-color")).toBe("white");
    } finally {
      workspace.dispose();
    }
  });

  it("a ProgressCircle on a dark fill draws the white static track — the Canvas primitive's props", async () => {
    const { workspace, root, records, domOf } = await open(
      [
        { type: "ProgressCircle", staticColor: "auto" },
        { type: "ProgressCircle", staticColor: "white" },
      ],
      "#111111ff",
    );
    try {
      const draw = (index: number) => {
        const binding = bindCatalogCanvas(root, root.pageRootRecords());
        try {
          return JSON.stringify(getSkiaNode(records()[index].id));
        } finally {
          binding.dispose();
        }
      };
      const strip = (json: string) =>
        json.replace(/"(elementId|id|x|y)":[^,}]*,?/g, "");
      expect(strip(draw(0))).toBe(strip(draw(1)));
      expect(domOf(0).getAttribute("data-static-color")).toBe("white");
    } finally {
      workspace.dispose();
    }
  });

  it("with no backdrop it reads the page base — black in the light theme", async () => {
    const { workspace, records, paintOf, domOf } = await open([
      { type: "Button", staticColor: "auto" },
      { type: "Button", staticColor: "black" },
    ]);
    try {
      expect(records()[0].derivedProps?.staticColor).toBe("black");
      expect(paintOf(0)).toEqual(paintOf(1));
      expect(domOf(0).getAttribute("data-static-color")).toBe("black");
    } finally {
      workspace.dispose();
    }
  });

  it("follows an edit of the backdrop's fill in one step, and back on undo", async () => {
    const { workspace, records, domOf, setFrameFill } = await open(
      [{ type: "Button", staticColor: "auto" }],
      "#111111ff",
    );
    try {
      expect(records()[0].derivedProps?.staticColor).toBe("white");
      setFrameFill("#ffffffff");
      expect(records()[0].derivedProps?.staticColor).toBe("black");
      expect(domOf(0).getAttribute("data-static-color")).toBe("black");
      workspace.undo();
      expect(records()[0].derivedProps?.staticColor).toBe("white");
    } finally {
      workspace.dispose();
    }
  });

  it("no staticColor is the theme paint — no `data-static-color`", async () => {
    const { workspace, records, paintOf, domOf } = await open(
      [{ type: "Button" }, { type: "Button", staticColor: "white" }],
      "#111111ff",
    );
    try {
      expect(records()[0].props.staticColor).toBeUndefined();
      expect(records()[0].derivedProps?.staticColor).toBeUndefined();
      expect(paintOf(0)).not.toEqual(paintOf(1));
      expect(domOf(0).hasAttribute("data-static-color")).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  it("a group's auto reaches its buttons resolved; a static ancestor is the backdrop", async () => {
    const { workspace, root, records } = await open(
      [
        { type: "ActionButtonGroup", staticColor: "auto" },
        { type: "ProgressBar", staticColor: "auto" },
      ],
      "#111111ff",
    );
    try {
      const [group, progress] = records();
      const buttons = group.children
        .map((id) => root.canvasInputs.get(id)!)
        .filter((child) => root.typeOf(child) === "ActionButton");
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons)
        expect(button.derivedProps?.staticColor).toBe("white");
      expect(progress.derivedProps?.staticColor).toBe("white");
      const label = progress.children
        .map((id) => root.canvasInputs.get(id)!)
        .find((child) => root.typeOf(child) === "Label");
      if (label) expect(label.derivedProps?.staticColor).toBe("white");
    } finally {
      workspace.dispose();
    }
  });
});
