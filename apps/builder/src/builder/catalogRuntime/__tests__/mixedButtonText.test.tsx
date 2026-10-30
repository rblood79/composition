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

/**
 * ADR-276: a Button · ToggleButton's words and glyph are its template's Text{label} · Icon{icon}
 * positions (the IconButton template) — the records below are those positions inside the
 * instance, found by their template source id.
 */
const BUTTON = "project:node:button" as NodeId;
const ICON = (type: string) =>
  `lib:template:component-${type.toLowerCase()}__icon` as NodeId;
const LABEL = (type: string) =>
  `lib:template:component-${type.toLowerCase()}__label` as NodeId;
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
      entries: [entry(BUTTON, type, { label: "Save", icon: "check", size })],
      rootIds: [BUTTON],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (sourceId: NodeId) =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === sourceId)!;
  // (In a group the items are ToggleButton instances with the same template positions — the
  // records inside this instance only.)
  const within = (sourceId: NodeId) =>
    [...root.canvasInputs.values()].find(
      (item) => item.sourceId === sourceId && item.instancePath.includes(BUTTON),
    )!;
  const icon = () => within(ICON(type));
  const label = () => within(LABEL(type));
  return { workspace, root, record, entry, icon, label };
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
          const { workspace, root, record, icon: iconOf, label } = await open(
            type,
            size,
            grouped,
          );
          const button = record(BUTTON),
            icon = iconOf(),
            part = label();
          const canvas = bindCatalogCanvas(root, root.pageRootRecords());
          expect(part.props.children).toBe("Save");
          expect(contents(getSkiaNode(part.id))).toContain("Save");
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
              props: { label: { kind: "set", value: "Save document" } },
            }),
          );
          expect(canvas.update().status).not.toBe("rebind-required");
          expect(contents(getSkiaNode(part.id))).toContain("Save document");
          const after = boxes();
          expect(after.get(button.id)!.width).toBe(320);
          expect(after.get(icon.id)!.x).not.toBe(fixedIconX);
          expect(getSkiaNode(icon.id)!.x).toBeCloseTo(after.get(icon.id)!.x, 3);
          workspace.undo();
          canvas.update();
          expect(contents(getSkiaNode(part.id))).toContain("Save");
          canvas.dispose();
        });
      }
});

// ADR-276: the glyph takes the ToggleButton's scale (the rule's `iconSize` per size — the
// `buttonChildScaleRules` part rule), as a Button's Icon child does.
describe("resolved Icon box in DOM", () => {
  for (const [size, expected] of [
    ["XS", 14],
    ["S", 16],
    ["M", 18],
    ["L", 24],
    ["XL", 28],
  ] as const)
    it(size, async () => {
      const { workspace, root, record, icon: iconOf } = await open(
        "ToggleButton",
        "M",
        true,
      );
      const icon = iconOf();
      // (In a group the item's size is the group's — `CATALOG_SIZE_PROPAGATION`.)
      const group = root.canvasInputs.get(record(BUTTON).parentId)!;
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(group.id)!.target],
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
      const { workspace, root, record, icon: iconOf, label } = await open(
        type,
        "M",
        grouped,
      );
      const owner = record(BUTTON),
        icon = iconOf(),
        text = label();
      const baseColor = icon.visual.color;
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const textColor = () => getSkiaNode(text.id)!.text!.color;
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
      // (The label Text too — 2026-10-30 사용자 「Preview 에서 수동 토글로 선택하면 글자가 안 보임」:
      //  an inline resting color stays when RAC selects it at runtime; the sheet's selected color
      //  must reach it through `inherit`.)
      if (type === "ToggleButton")
        expect(
          host.querySelector<HTMLElement>(`[data-catalog-id="${text.id}"]`)!
            .style.color,
        ).toBe("inherit");
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
  const { workspace, root, record, label } = await open("ToggleButton", "M", true);
  const button = record(BUTTON);
  const target = workspace.itemOfRecord(button.id)!.target;
  workspace.execute(
    setFields({
      targets: [target],
      props: { label: set("Toggle Button") },
      visual: { width: set(110) },
    }),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const part = label();
  expect(root.textWraps(part.id)).toBe(true);
  // (ADR-295 Phase 3: two S2 lines 18 + the centring padding 6 × 2 + border 2; one line = the S2
  //   control height 32.)
  expect(root.getGeometry([part.id]).get(part.id)!.height).toBe(36);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(50);
  expect(getSkiaNode(part.id)!.text?.whiteSpace).toBe("normal");
  workspace.execute(
    setFields({ targets: [target], visual: { width: set(300) } }),
  );
  canvas.update();
  expect(root.textWraps(part.id)).toBe(false);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(32);
  workspace.undo();
  canvas.update();
  expect(root.textWraps(part.id)).toBe(true);
  expect(root.getGeometry([button.id]).get(button.id)!.height).toBe(50);
  canvas.dispose();
});

it("mixed ToggleButton paints authored typography and Reset restores native text defaults", async () => {
  const { workspace, root, record, label } = await open("ToggleButton", "M", true);
  const button = record(BUTTON);
  const text = label();
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
  const painted = () => getSkiaNode(text.id)!.text!;
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
  const { workspace, root, record, icon: iconOf, label } = await open(
    "ToggleButton",
    "M",
    true,
  );
  const owner = record(BUTTON),
    icon = iconOf(),
    text = label();
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
    const painted = getSkiaNode(text.id)!.text!.color;
    expect([...getSkiaNode(icon.id)!.iconPath!.strokeColor]).toEqual([
      ...painted,
    ]);
  }
  canvas.dispose();
});
