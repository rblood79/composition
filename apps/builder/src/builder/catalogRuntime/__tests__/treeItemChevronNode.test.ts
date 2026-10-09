// @vitest-environment jsdom
/**
 * TreeItem chevron (ADR-256 Phase 5h — the reference's `TreeItem > TreeItemContent >
 * Button[slot=chevron] > ChevronRight + title`; before: a `TreeItemChevron` node, 2026-10-04, user
 * 「1안」). The chevron is an authored Button in the item's row content: RAC gives it the item's
 * expand button props, `Tree.css` styles it (`all: unset` — a bare 20px box + the level indent) and
 * hides it on an item without child items. On the Canvas the box is `catalogTreeChevronLayout`,
 * the glyph is its Icon child (hidden at rest on a leaf item, turned on an expanded one, the item's
 * text color — the DOM button's `all: unset` inherits the row's).
 *
 * Oracle: the row geometry of the `TreeItemChevron` node (main `7c806db22`) — the button and the
 * label sit where they sat, the glyph centers where the node's `leading_icon` centered it.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  groupNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogDomRendersNode, renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

const OWNER = "project:node:owner" as NodeId;

/** A node entry of `definitionId` with set props. */
const nodeEntry = (
  id: string,
  definitionId: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

/** A workspace whose home body holds `entries` (roots: the first). */
async function openWorkspace(
  entries: (library: CatalogLibrary) => NodeEntry[],
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tree-chevron" as const,
        name: "Tree chevron",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tree-chevron-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: entries(library),
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

async function openTree(props: Record<string, unknown> = {}) {
  const workspace = await openWorkspace((library) => [
    nodeEntry(OWNER, catalogPaletteDefinitionId(library, "Tree"), [], props),
  ]);
  const root = workspace.root;
  const record = (id: string) => root.layoutInputs.get(id)!;
  const tree = [...root.layoutInputs.values()].find(
    (entry) => entry.bindingId === "tree",
  )!;
  const kids = (id: string) => record(id).children.map(record);
  const [parentItem, leafItem] = kids(tree.id);
  return { workspace, root, record, kids, tree, parentItem, leafItem };
}

/** Icon glyph shapes under painted node data. */
function glyphs(data: SkiaNodeData | undefined): SkiaNodeData[] {
  if (!data) return [];
  return [
    ...(data.type === "icon_path" ? [data] : []),
    ...(data.children ?? []).flatMap(glyphs),
  ];
}

/** A record's rect relative to `ancestor` (geometry is parent-relative). */
function rectIn(
  root: CatalogWorkspace["root"],
  id: string,
  ancestor: string,
): [number, number, number, number] {
  const own = root.getGeometry([id]).get(id)!;
  let x = own.x;
  let y = own.y;
  let cursor = root.layoutInputs.get(id)!.parentId;
  while (cursor && cursor !== ancestor) {
    const rect = root.getGeometry([cursor]).get(cursor)!;
    x += rect.x;
    y += rect.y;
    cursor = root.layoutInputs.get(cursor)!.parentId;
  }
  return [x, y, own.width, own.height];
}

describe("TreeItem chevron — Button[slot=chevron] in the row content", () => {
  it.each([false, true])(
    "each TreeItem holds its row content (chevron Button > Icon, label); the button and label keep the old node's place (expanded %s)",
    async (expanded) => {
      const { workspace, root, kids, parentItem, leafItem } = await openTree(
        expanded ? { expandedKeys: ["item-1"] } : {},
      );
      expect(kids(parentItem.id).map((child) => child.bindingId)).toEqual([
        "treeitemcontent",
        "treeitem",
      ]);
      expect(kids(leafItem.id).map((child) => child.bindingId)).toEqual([
        "treeitemcontent",
      ]);
      const [content] = kids(parentItem.id);
      expect(kids(content.id).map((child) => child.bindingId)).toEqual([
        "button",
        "text",
      ]);
      expect(kids(kids(content.id)[0].id).map((c) => c.bindingId)).toEqual([
        "icon",
      ]);
      // The `TreeItemChevron` node's box and the label beside it (main `7c806db22`).
      const rows = expanded
        ? [
            // (Its row is the content node — the child item is the next row, not beside it: the
            // chevron is centered in the 32px row as when collapsed — ADR-256 후속 14.)
            { item: parentItem, chevron: [8, 8, 20, 16], labelX: 30 },
            // level 2: the button grows by its level padding (`(level − 1) × --padding`)
            {
              item: kids(parentItem.id)[1],
              chevron: [8, 8, 24, 16],
              labelX: 34,
            },
          ]
        : [
            { item: parentItem, chevron: [8, 8, 20, 16], labelX: 30 },
            { item: leafItem, chevron: [8, 8, 20, 16], labelX: 30 },
          ];
      for (const { item, chevron, labelX } of rows) {
        const [button, label] = kids(kids(item.id)[0].id);
        expect(rectIn(root, button.id, item.id)).toEqual(chevron);
        expect(rectIn(root, label.id, item.id)[0]).toBeCloseTo(labelX, 3);
      }
      workspace.dispose();
    },
  );

  it("the DOM row: one RAC chevron button per item (the Button node's), the content no element", async () => {
    const { workspace, root, kids, tree, parentItem, leafItem } =
      await openTree();
    const html = renderToStaticMarkup(renderCatalogDom(root, tree.id));
    for (const item of [parentItem, leafItem]) {
      const [content] = kids(item.id);
      const [button, label] = kids(content.id);
      expect(catalogDomRendersNode(root, content.id)).toBe(false);
      expect(html).not.toContain(`data-catalog-id="${content.id}"`);
      expect(html).toMatch(
        new RegExp(
          `<button[^>]*data-catalog-id="${button.id}"[^>]*slot="chevron"|<button[^>]*slot="chevron"[^>]*data-catalog-id="${button.id}"`,
        ),
      );
      expect(html).toContain(`data-catalog-id="${label.id}"`);
    }
    expect(html.match(/slot="chevron"/g)).toHaveLength(2);
    workspace.dispose();
  });

  it("the Icon paints the glyph centered in its button, in the item's text color; a leaf's rests hidden; expansion turns it", async () => {
    const { workspace, root, kids, parentItem, leafItem } = await openTree();
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const glyphOf = (
      item: (typeof kids extends (id: string) => infer R ? R : never)[number],
    ) => {
      const [content] = kids(item.id);
      const [button, label] = kids(content.id);
      return { button, label, icon: kids(button.id)[0] };
    };
    const { button, label, icon } = glyphOf(parentItem);
    const painted = glyphs(getSkiaNode(icon.id));
    expect(painted).toHaveLength(1);
    // (Centered as the old node's `leading_icon`: the button's 20px box, glyph 16.)
    const [bx, by] = rectIn(root, button.id, parentItem.id);
    const [ix, iy, iw, ih] = rectIn(root, icon.id, parentItem.id);
    expect([ix + iw / 2 - bx, iy + ih / 2 - by]).toEqual([10, 8]);
    expect(painted[0].iconPath?.size).toBe(16);
    // (The item's text color — not the Button variant's text color its Icon part rule names.)
    expect(icon.visual.color).not.toBe(label.visual.color);
    expect(icon.derivedProps?.color).toBe(label.visual.color);
    expect(glyphs(getSkiaNode(parentItem.id))).toHaveLength(0);
    expect(glyphs(getSkiaNode(button.id))).toHaveLength(0);
    // A leaf item's button is hidden (`visibility: hidden` without child items): no glyph.
    const leaf = glyphOf(leafItem);
    expect(leaf.icon.hidden).toBe(true);
    expect(glyphs(getSkiaNode(leaf.icon.id))).toHaveLength(0);
    // The Tree's expansion turns the glyph on a delta update.
    const before = JSON.stringify(painted[0].iconPath?.paths);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { expandedKeys: { kind: "set", value: ["item-1"] } },
      }),
    );
    canvas.update();
    const [turned] = glyphs(getSkiaNode(icon.id));
    expect(JSON.stringify(turned.iconPath?.paths)).not.toBe(before);
    canvas.dispose();
    workspace.dispose();
  });

  it("a chevron Button the author wraps in a frame stays the item's chevron (Round 12 — RAC context passes the frame)", async () => {
    const node = (
      id: string,
      type: string,
      children: string[],
      props: Record<string, unknown> = {},
    ) => nodeEntry(id, catalogTypeDefinitionId(type), children, props);
    const row = (key: string, items: string[] = []) => [
      node(
        `project:node:${key}`,
        "TreeItem",
        [`project:node:${key}-c`, ...items],
        {
          id: key,
        },
      ),
      node(`project:node:${key}-c`, "TreeItemContent", [
        `project:node:${key}-b`,
        `project:node:${key}-t`,
      ]),
      node(`project:node:${key}-b`, "Button", [`project:node:${key}-i`], {
        slot: "chevron",
        size: "S",
        children: "",
      }),
      node(`project:node:${key}-i`, "Icon", [], {
        iconName: "chevron-right",
        size: "XS",
      }),
      node(`project:node:${key}-t`, "Text", [], { children: key }),
    ];
    const workspace = await openWorkspace(() => [
      node(OWNER, "Tree", ["project:node:a", "project:node:b"]),
      ...row("a", ["project:node:a1"]),
      ...row("a1"),
      ...row("b"),
    ]);
    const root = workspace.root;
    const record = (sourceId: string) =>
      [...root.layoutInputs.values()].find(
        (entry) => entry.sourceId === sourceId,
      )!;
    const before = rectIn(
      root,
      record("project:node:b-b").id,
      record("project:node:b").id,
    );
    workspace.execute(
      groupNodes({
        ids: ["project:node:b-b" as NodeId],
        group: nodeEntry("project:node:wrap", "lib:definition:type-frame"),
        newId: workspace.newId,
      }),
    );
    const button = record("project:node:b-b");
    const icon = record("project:node:b-i");
    // A leaf item's chevron rests hidden; its box is the chevron box (size — the frame moves it).
    expect(icon.hidden).toBe(true);
    expect(
      rectIn(root, button.id, record("project:node:b").id).slice(2),
    ).toEqual(before.slice(2));
    // The DOM button is the bare RAC chevron (Tree.css), not a Button box with inline sizes.
    const html = renderToStaticMarkup(renderCatalogDom(root, record(OWNER).id));
    const tagOf = (id: string) =>
      html.match(new RegExp(`<button[^>]*data-catalog-id="${id}"[^>]*>`))![0];
    const tag = tagOf(button.id);
    const style = (t: string) => t.match(/style="([^"]*)"/)?.[1];
    expect(tag).toContain('slot="chevron"');
    expect(tag).not.toContain("button-base");
    // (The same box as an unwrapped chevron's — not the Button type's `min-width: 50px`.)
    expect(style(tag)).toBe(style(tagOf(record("project:node:a-b").id)));
    workspace.dispose();
  });

  it("a bare item (no row content) keeps the composed part and paints its own chevron", async () => {
    const node = (
      id: string,
      type: string,
      children: string[],
      props: Record<string, unknown> = {},
    ) => nodeEntry(id, catalogTypeDefinitionId(type), children, props);
    const workspace = await openWorkspace(() => [
      node(OWNER, "Tree", ["project:node:a", "project:node:b"]),
      node("project:node:a", "TreeItem", ["project:node:a-1"], { id: "a" }),
      node("project:node:a-1", "TreeItem", [], { id: "a-1" }),
      node("project:node:b", "TreeItem", [], { id: "b" }),
    ]);
    const root = workspace.root;
    const item = [...root.layoutInputs.values()].find(
      (entry) => entry.sourceId === "project:node:a",
    )!;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const [glyph] = glyphs(getSkiaNode(item.id));
    // The row's own `leading_icon` (at `paddingX + iconSize / 2`, as before the node).
    expect(glyph.iconPath).toMatchObject({ cx: 16, cy: 16, size: 16 });
    canvas.dispose();
    workspace.dispose();
  });
});
