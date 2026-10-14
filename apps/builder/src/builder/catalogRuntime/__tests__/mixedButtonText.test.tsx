// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
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
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BUTTON = "project:node:button" as NodeId;
const ICON = "project:node:icon" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, size: string, grouped = false) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:mixed-button-text" as const,
        name: "Mixed button text",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `mixed-button-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: (text, font, available) => {
        const width = (text.length * font.fontSize) / 2;
        const minWidth = Math.max(
          ...text.split(" ").map((word) => (word.length * font.fontSize) / 2),
        );
        return {
          width,
          exactWidth: width,
          minWidth,
          height:
            font.fontSize *
            font.lineHeight *
            (available !== undefined && available < width - 0.5 ? 2 : 1),
        };
      },
    },
  );
  const entry = (
    id: NodeId,
    type: string,
    nodeProps: Record<string, unknown>,
  ): NodeEntry =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library, type),
      children: [],
      props: Object.fromEntries(
        Object.entries(nodeProps).map(([key, value]) => [key, set(value)]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  const group = "project:node:group" as NodeId;
  if (grouped)
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [entry(group, "ToggleButtonGroup", { size })],
        rootIds: [group],
        newId: workspace.newId,
      }),
    );
  workspace.execute(
    insertNodes({
      parent: {
        kind: "node",
        id: grouped ? group : ("project:node:home-body" as NodeId),
      },
      entries: [entry(BUTTON, type, { children: "Save", size })],
      rootIds: [BUTTON],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BUTTON },
      entries: [entry(ICON, "Icon", { iconName: "check", size: "XS" })],
      rootIds: [ICON],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (sourceId: NodeId) =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === sourceId)!;
  return { workspace, root, record, entry };
}

const contents = (data: unknown): string[] => {
  const n = data as { text?: { content?: string }; children?: unknown[] };
  return [
    ...(n.text?.content ? [n.text.content] : []),
    ...(n.children ?? []).flatMap(contents),
  ];
};
describe("mixed button text and document children", () => {
  for (const type of ["Button", "ToggleButton"])
    for (const size of ["XS", "S", "M", "L", "XL"])
      for (const grouped of type === "ToggleButton" ? [false, true] : [false]) {
        it(`${type} ${size} grouped=${grouped}: text participates in layout and paint`, async () => {
          const { workspace, root, record } = await open(type, size, grouped);
          const button = record(BUTTON),
            icon = record(ICON);
          const canvas = bindCatalogCanvas(root, root.pageRootRecords());
          const part = root.composedPartInputs
            .get(button.id)!
            .find((p) => p.text)!;
          expect(part.text!.content).toBe("Save");
          expect(contents(getSkiaNode(button.id))).toContain("Save");
          const boxes = () => root.getGeometry([button.id, icon.id, part.id]);
          const before = boxes();
          const html = renderToStaticMarkup(
            renderCatalogDom(root, root.pageRootRecords()[0]),
          );
          expect(html).toContain("Save");
          const textWidth = Number(button.visual.fontSize) * 2;
          expect(before.get(part.id)!.width).toBeCloseTo(textWidth, 3);
          expect(before.get(button.id)!.width).toBeGreaterThan(
            textWidth + before.get(icon.id)!.width,
          );
          // Fixed parent dimensions do not hide a changed anonymous flex item's geometry.
          workspace.execute(
            setFields({
              targets: [workspace.itemOfRecord(button.id)!.target],
              visual: { width: { kind: "set", value: 320 } },
            }),
          );
          canvas.update();
          const fixedIconX = boxes().get(icon.id)!.x;
          workspace.execute(
            setFields({
              targets: [workspace.itemOfRecord(button.id)!.target],
              props: { children: { kind: "set", value: "Save document" } },
            }),
          );
          expect(canvas.update().status).not.toBe("rebind-required");
          expect(contents(getSkiaNode(button.id))).toContain("Save document");
          const after = boxes();
          expect(after.get(button.id)!.width).toBe(320);
          expect(after.get(icon.id)!.x).not.toBe(fixedIconX);
          expect(getSkiaNode(icon.id)!.x).toBeCloseTo(after.get(icon.id)!.x, 3);
          workspace.undo();
          canvas.update();
          expect(contents(getSkiaNode(button.id))).toContain("Save");
          canvas.dispose();
        });
      }
});

describe("resolved Icon box in DOM", () => {
  for (const [size, expected] of [
    ["XS", 16],
    ["S", 18],
    ["M", 24],
    ["L", 36],
    ["XL", 48],
  ] as const)
    it(size, async () => {
      const { workspace, root, record } = await open("ToggleButton", "M", true);
      const icon = record(ICON);
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(icon.id)!.target],
          props: { size: { kind: "set", value: size } },
        }),
      );
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(root, root.pageRootRecords()[0]),
      );
      const dom = host.querySelector<HTMLElement>(
        `[data-catalog-id="${icon.id}"]`,
      )!;
      expect(dom.style.height).toBe(`${expected}px`);
      expect(root.getGeometry([icon.id]).get(icon.id)!.height).toBe(expected);
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(icon.id)!.target],
          visual: {
            height: { kind: "set", value: 60 },
            width: { kind: "set", value: 70 },
          },
        }),
      );
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(root, root.pageRootRecords()[0]),
      );
      expect(
        host.querySelector<HTMLElement>(`[data-catalog-id="${icon.id}"]`)!.style
          .height,
      ).toBe("60px");
    });
});

describe("button Icon inherits text color", () => {
  for (const [type, grouped] of [
    ["Button", false],
    ["ToggleButton", false],
    ["ToggleButton", true],
  ] as const)
    it(`${type} grouped=${grouped}: default, selected and authored override`, async () => {
      const { workspace, root, record } = await open(type, "M", grouped);
      const owner = record(BUTTON),
        icon = record(ICON);
      const baseColor = icon.visual.color;
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const textColor = () => {
        const data = getSkiaNode(owner.id)!;
        return (
          data.text?.color ??
          data.children!.find((child) => child.text?.content === "Save")!.text!
            .color
        );
      };
      const glyphColor = () => getSkiaNode(icon.id)!.iconPath!.strokeColor;
      expect([...glyphColor()]).toEqual([...textColor()]);
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(owner.id)!.target],
          props:
            type === "Button"
              ? { variant: set("accent") }
              : { isSelected: set(true), isEmphasized: set(true) },
        }),
      );
      canvas.update();
      expect([...glyphColor()]).toEqual([...textColor()]);
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(root, root.pageRootRecords()[0]),
      );
      let element = host.querySelector<HTMLElement>(
        `[data-catalog-id="${icon.id}"]`,
      )!;
      if (type === "ToggleButton") expect(element.style.color).toBe("inherit");
      expect(element.querySelector("svg")!.getAttribute("stroke")).toBe(
        "currentColor",
      );
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(icon.id)!.target],
          visual: { color: set("#ff0000") },
        }),
      );
      canvas.update();
      expect([...glyphColor()]).toEqual([1, 0, 0, 1]);
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(root, root.pageRootRecords()[0]),
      );
      element = host.querySelector<HTMLElement>(
        `[data-catalog-id="${icon.id}"]`,
      )!;
      expect(element.style.color).toBe("rgb(255, 0, 0)");
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(icon.id)!.target],
          visual: { color: { kind: "remove" } },
        }),
      );
      canvas.update();
      expect([...glyphColor()]).toEqual([...textColor()]);
      workspace.undo();
      canvas.update();
      expect([...glyphColor()]).toEqual([1, 0, 0, 1]);
      if (type === "ToggleButton") {
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(icon.id)!.target],
            visual: { color: set(baseColor) },
          }),
        );
        canvas.update();
        expect(
          root.canvasInputs.get(icon.id)!.derivedProps?.color,
        ).toBeUndefined();
        host.innerHTML = renderToStaticMarkup(
          renderCatalogDom(root, root.pageRootRecords()[0]),
        );
        expect(
          host.querySelector<HTMLElement>(`[data-catalog-id="${icon.id}"]`)!
            .style.color,
        ).not.toBe("inherit");
      }
      canvas.dispose();
    });
});

it("standalone Icon keeps its glyph box in flex row and column", async () => {
  const { workspace, root, entry } = await open("ToggleButton", "M");
  const glyphId = "project:node:standalone-glyph" as NodeId;
  const bodyId = "project:node:home-body" as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: bodyId },
      entries: [entry(glyphId, "Icon", { iconName: "check", size: "L" })],
      rootIds: [glyphId],
      newId: workspace.newId,
    }),
  );
  const glyph = [...root.canvasInputs.values()].find(
    (node) => node.sourceId === glyphId,
  )!;
  const body = root.canvasInputs.get(glyph.parentId)!;
  for (const direction of ["row", "column"]) {
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(body.id)!.target],
        layout: { display: set("flex"), flexDirection: set(direction) },
      }),
    );
    const box = root.getGeometry([glyph.id]).get(glyph.id)!;
    expect(box.width).toBe(36);
    expect(box.height).toBe(36);
  }
});

it("grouped mixed text wraps at its own box and unwraps after widening", async () => {
  const { workspace, root, record } = await open("ToggleButton", "M", true);
  const button = record(BUTTON);
  const target = workspace.itemOfRecord(button.id)!.target;
  workspace.execute(
    setFields({
      targets: [target],
      props: { children: set("Toggle Button") },
      visual: { width: set(110) },
    }),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const part = root.composedPartInputs
    .get(button.id)!
    .find((item) => item.text)!;
  expect(root.textWraps(part.id)).toBe(true);
  expect(root.getGeometry([part.id]).get(part.id)!.height).toBe(40);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(50);
  expect(
    getSkiaNode(button.id)!.children!.some(
      (item) => item.text?.whiteSpace === "normal",
    ),
  ).toBe(true);
  workspace.execute(
    setFields({ targets: [target], visual: { width: set(300) } }),
  );
  canvas.update();
  expect(root.textWraps(part.id)).toBe(false);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(30);
  workspace.undo();
  canvas.update();
  expect(root.textWraps(part.id)).toBe(true);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(50);
  canvas.dispose();
});

it("mixed ToggleButton paints authored typography and Reset restores native text defaults", async () => {
  const { workspace, root, record } = await open("ToggleButton", "M", true);
  const button = record(BUTTON);
  const owner = workspace.itemOfRecord(button.id)!.target;
  const body = workspace.itemOfRecord(
    root.canvasInputs.get(button.parentId)!.parentId,
  )!.target;
  workspace.execute(
    setFields({ targets: [body], visual: { letterSpacing: set(1) } }),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  workspace.execute(
    setFields({
      targets: [owner],
      visual: {
        letterSpacing: set(2),
        textAlign: set("right"),
        textDecoration: set("underline"),
      },
    }),
  );
  canvas.update();
  const painted = () =>
    getSkiaNode(button.id)!.children!.find(
      (item) => item.text?.content === "Save",
    )!.text!;
  expect(painted().letterSpacing).toBe(2);
  expect(painted().align).toBe("right");
  expect(painted().decoration).toBeDefined();
  const html = renderToStaticMarkup(
    renderCatalogDom(root, root.pageRootRecords()[0]),
  );
  expect(html).toContain("letter-spacing:1px");
  expect(html).toContain("letter-spacing:2px");
  workspace.execute(
    setFields({ targets: [body], visual: { letterSpacing: set(4) } }),
  );
  workspace.execute(
    setFields({
      targets: [owner],
      visual: { letterSpacing: { kind: "remove" } },
    }),
  );
  canvas.update();
  expect(painted().letterSpacing).toBeUndefined();
  expect(
    renderToStaticMarkup(renderCatalogDom(root, root.pageRootRecords()[0])),
  ).toContain("letter-spacing:4px");
  workspace.undo();
  canvas.update();
  expect(painted().letterSpacing).toBe(2);
  canvas.dispose();
});

it("group staticColor updates its ToggleButton Icon through derived dependents", async () => {
  const { workspace, root, record } = await open("ToggleButton", "M", true);
  const owner = record(BUTTON),
    icon = record(ICON);
  const group = root.canvasInputs.get(owner.parentId)!;
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  for (const color of ["white", "black"]) {
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(group.id)!.target],
        props: { staticColor: set(color) },
      }),
    );
    canvas.update();
    const text = getSkiaNode(owner.id)!.children!.find(
      (child) => child.text?.content === "Save",
    )!.text!.color;
    expect([...getSkiaNode(icon.id)!.iconPath!.strokeColor]).toEqual([...text]);
  }
  canvas.dispose();
});
