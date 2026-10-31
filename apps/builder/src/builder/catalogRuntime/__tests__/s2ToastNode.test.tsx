// @vitest-environment jsdom
/**
 * 295 후속 C9 (사용자 「Toast 컴포넌트가 컴포넌트 패널에 없다 · S2 원본대로」) — the palette 「toast」 is one
 * S2 1.8.1 Toast (`Toast.tsx` `toastStyle`):
 * - the Components panel offers it in Content, after InlineAlert; its origin is Text + the S2 action
 *   Button (`variant="secondary" fillStyle="outline" staticColor="white"`);
 * - the box: variant solid color, no border, min height 56, start padding 16 + icon M + 8 (neutral 16 —
 *   no icon), end padding 8 + close (control M) + 16, 24 between the text and the button;
 * - the Toast draws its variant icon and its close cross itself (Canvas glyphs · DOM `toast-variant-icon` ·
 *   `toast-close-button`); its text is white, the action Button's text is its own rule's.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogToastChromeShapes } from "../ruleShapes";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const ROOT = "project:node:toast-root" as NodeId;

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toast-node" as const,
        name: "Toast node",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toast-node-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, "Toast"),
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
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const toast = () => records().find((r) => root.typeOf(r) === "Toast")!;
  const child = (type: string) =>
    records().find(
      (r) => root.typeOf(r) === type && r.parentId === toast().id,
    )!;
  /** A child's offset in the Toast (Canvas layout). */
  const offset = (id: string) => {
    const rects = workspace.root.getGeometry([toast().id, id]);
    const box = rects.get(toast().id)!;
    const own = rects.get(id)!;
    return { x: own.x - box.x, y: own.y - box.y, box, own };
  };
  const dom = () => {
    const html = renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === ROOT)!.id,
      ),
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    return host.querySelector<HTMLElement>(".react-aria-Toast")!;
  };
  const glyphs = () =>
    catalogToastChromeShapes({
      type: "Toast",
      node: toast(),
      rect: offset(toast().id).box,
    } as never).filter((shape) => shape.type === "icon_font") as unknown as {
      iconName: string;
      x: number;
      y: number;
    }[];
  return { workspace, root, toast, child, offset, dom, glyphs };
}

describe("S2 Toast node (palette 「toast」)", () => {
  it("the Library draws its card in Content after InlineAlert; the Components panel does not insert it (user 2026-11-01 — the app's one toast shape)", () => {
    const items = getPaletteItems();
    const types = items.map((item) => item.type);
    expect(types[types.indexOf("InlineAlert") + 1]).toBe("Toast");
    const toast = items.find((item) => item.type === "Toast")!;
    expect(toast.category).toBe("content");
    expect(toast.libraryOnly).toBe(true);
  });

  it("its origin: Text + the S2 action Button; info by default", async () => {
    const { root, toast, child } = await open();
    expect(toast().props.variant).toBe("info");
    const text = child("Text");
    const button = child("Button");
    expect(text.props.children).toBe("Toast message");
    // (S2 `font: 'ui'` = text-sm — the Text's S.)
    expect(text.props.size).toBe("S");
    expect(button.props).toMatchObject({
      variant: "secondary",
      fillStyle: "outline",
      staticColor: "white",
    });
    // (The text is white — S2 `color: 'white'`; the button's text is the Button rule's, not forced.)
    expect(text.derivedProps?.color ?? text.props.color).toBe("#ffffff");
    const buttonText = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Text" && r.parentId === button.id,
    );
    if (buttonText) expect(buttonText.derivedProps?.color).not.toBe("#ffffff");
  });

  it("the box: min height 56, start 16 + icon 18 + 8 = 42, end 8 + close 32 + 16 = 56, 24 to the button", async () => {
    const { toast, child, offset } = await open();
    const text = offset(child("Text").id);
    const button = offset(child("Button").id);
    expect(text.box.height).toBe(56);
    expect(text.x).toBe(42);
    expect(button.x - (text.x + text.own.width)).toBe(24);
    expect(text.box.width - (button.x + button.own.width)).toBe(56);
    expect(toast().visual?.borderWidth ?? 0).toBe(0);
  });

  it("neutral: no icon, start padding 16 (S2 `ICONS` has no neutral)", async () => {
    const { workspace, child, offset, glyphs } = await open({
      variant: "neutral",
    });
    expect(offset(child("Text").id).x).toBe(16);
    expect(glyphs().map((g) => g.iconName)).toEqual(["x"]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ROOT }],
        props: { variant: { kind: "set", value: "positive" } },
        label: "Edit properties",
      }),
    );
    expect(offset(child("Text").id).x).toBe(42);
    expect(glyphs().map((g) => g.iconName)).toEqual(["circle-check", "x"]);
  });

  it("Canvas glyphs: the icon 16 + 9 from the start, the cross 8 + 16 from the end, both centred", async () => {
    const { glyphs, offset, toast } = await open();
    const box = offset(toast().id).box;
    expect(glyphs()).toEqual([
      expect.objectContaining({ iconName: "info", x: 25, y: 28 }),
      expect.objectContaining({ iconName: "x", x: box.width - 24, y: 28 }),
    ]);
  });

  it("DOM: the rule's class · variant, the icon and S2's close button (its name), then the children", async () => {
    const { dom } = await open({ variant: "negative" });
    const element = dom();
    expect(element.getAttribute("data-variant")).toBe("negative");
    expect(element.getAttribute("role")).toBe("alert");
    expect(
      element.querySelector(":scope > .toast-variant-icon svg"),
    ).not.toBeNull();
    const close = element.querySelector(":scope > button.toast-close-button");
    expect(close?.getAttribute("aria-label")).toBe("Close");
    expect(element.textContent).toContain("Toast message");
    expect(element.querySelector(".react-aria-Button")?.textContent).toBe(
      "Action",
    );
  });

  it("Canvas: the action Button is S2 static white outline — white border · text (the DOM `[data-static-color]` sheet)", async () => {
    const { root, child } = await open();
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const rgb = (color?: ArrayLike<number>) =>
      color
        ? Array.from(color)
            .slice(0, 3)
            .map((c) => Math.round(c * 255))
        : [];
    const button = child("Button");
    const buttonText = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Text" && r.parentId === button.id,
    )!;
    const box = (
      getSkiaNode(button.id) as unknown as {
        box: { strokeColor?: ArrayLike<number> };
      }
    ).box;
    const text = (
      getSkiaNode(buttonText.id) as unknown as {
        text: { color?: ArrayLike<number> };
      }
    ).text;
    // (The Toast's own glyphs reach the Canvas scene — white icon · cross, centred.)
    const toastNode = getSkiaNode(
      [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Toast")!
        .id,
    ) as unknown as {
      width: number;
      children?: {
        iconPath?: { cx: number; cy: number; strokeColor: ArrayLike<number> };
      }[];
    };
    const glyphs = (toastNode.children ?? [])
      .map((child) => child.iconPath)
      .filter(Boolean)
      .map((g) => [g!.cx, g!.cy, rgb(g!.strokeColor)]);
    expect(glyphs).toEqual([
      [25, 28, [255, 255, 255]],
      [toastNode.width - 24, 28, [255, 255, 255]],
    ]);
    canvas.dispose();
    expect(rgb(box.strokeColor)).toEqual([255, 255, 255]);
    expect(rgb(text.color)).toEqual([255, 255, 255]);
  });
});
